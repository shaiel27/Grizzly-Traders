import { NextResponse } from 'next/server'
import { requireEditor } from '@/lib/auth'
import { revalidatePosts } from '@/lib/cache'
import { createEditorClient } from '@/lib/supabase/admin'
import { isOwnStorageImage } from '@/lib/sanitize'
import { asistirSchema, asistirWebhookSchema, firstIssue } from '@/lib/validation'

// La generacion asistida encadena analisis + portada + insercion + traduccion en una sola
// llamada: es lenta por diseno (el contrato pide soportar al menos 120 s). El corte propio de
// 150 s queda por debajo de este limite para que el editor reciba siempre un JSON nuestro, con
// su etapa, en vez del corte seco de la plataforma.
export const maxDuration = 180

const WEBHOOK_TIMEOUT_MS = 150_000

// Regla de autoria por origen: lo que entra por el CMS lo firma la PERSONA (Moises Orraiz, id 6).
// Lo fija el servidor; el cliente no puede elegir autor aunque mande el campo.
const AUTOR_MANUAL_ID = 6

// Una generacion cuesta una imagen y dos llamadas a GPT. Un doble click, o dos pestanas del
// mismo editor, no deben pagarla dos veces: mientras haya una en vuelo, la siguiente se rechaza.
let enCurso = false

// La URL del webhook es lo unico que da acceso a disparar el pipeline editorial, asi que vive
// solo en el servidor: ni se devuelve, ni se registra, ni aparece en los mensajes de error.
function webhookUrl(): string | null {
  const url = process.env.N8N_WEBHOOK_EDITORIAL?.trim()
  return url ? url : null
}

// Si el webhook de n8n tiene autenticacion por cabecera, la clave viaja desde aqui. Opcional:
// sin la variable, la peticion sale sin Authorization y funciona igual contra un webhook abierto.
function authHeader(): Record<string, string> {
  const token = process.env.N8N_WEBHOOK_EDITORIAL_TOKEN?.trim()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Solo dice SI hay asistente configurado, nunca donde esta. Con esto el CMS deshabilita el boton
// y explica por que, en lugar de dejar al editor esperar dos minutos a un endpoint inexistente.
export async function GET() {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  return NextResponse.json({ success: true, configured: webhookUrl() !== null, busy: enCurso })
}

export async function POST(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  const url = webhookUrl()
  if (!url) {
    return NextResponse.json(
      { success: false, code: 'no_configurado', error: 'Falta configurar N8N_WEBHOOK_EDITORIAL en el servidor' },
      { status: 503 }
    )
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ success: false, code: 'json_invalido', error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = asistirSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ success: false, code: 'entrada_invalida', error: firstIssue(parsed.error) }, { status: 400 })
  }

  // Las imágenes solo pueden ser del bucket propio (las subió el editor del CMS): lo mismo que exige el saneador
  if (parsed.data.imagenes.some((imagen) => !isOwnStorageImage(imagen.url))) {
    return NextResponse.json({ success: false, code: 'entrada_invalida', error: 'Hay una imagen que no es de la web: súbela de nuevo desde el editor' }, { status: 400 })
  }

  if (enCurso) {
    return NextResponse.json(
      { success: false, code: 'ocupado', error: 'Ya hay una generación en marcha' },
      { status: 429 }
    )
  }
  enCurso = true

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({
        titular: parsed.data.titular,
        cuerpo: parsed.data.cuerpo,
        imagenes: parsed.data.imagenes,
        author_id: AUTOR_MANUAL_ID,
        solicitado_por: auth.user.email ?? '',
      }),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      cache: 'no-store',
    })

    const raw = await response.text()
    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      body = null
    }

    // "Respond to Webhook" de n8n puede devolver el objeto envuelto en un array de un elemento.
    // Desenvolverlo aqui es tolerancia de lectura, no un cambio del contrato.
    const payload = Array.isArray(body) && body.length === 1 ? body[0] : body
    const result = asistirWebhookSchema.safeParse(payload)

    if (!result.success) {
      // Sin cuerpo de contrato que interpretar: lo unico cierto es el codigo HTTP. Se informa ese
      // dato tecnico y nada mas, para no inventar una etapa que el asistente no ha reportado.
      console.error('Asistir: respuesta fuera de contrato', response.status)
      return NextResponse.json(
        {
          success: false,
          code: response.ok ? 'respuesta_invalida' : response.status === 404 ? 'webhook_inactivo' : 'webhook_caido',
          error: 'El asistente respondió fuera de contrato',
          detalle: `HTTP ${response.status}`,
        },
        { status: 502 }
      )
    }

    const data = result.data

    if (!data.ok || !data.post_id) {
      // El contrato trae la etapa donde se rompio: se pasa tal cual para que el CMS la marque.
      return NextResponse.json(
        {
          success: false,
          code: 'fallo_upstream',
          error: data.error ?? 'El asistente no pudo generar el borrador',
          etapa: data.etapa ?? null,
        },
        { status: 502 }
      )
    }

    // El flujo de n8n no conoce "destacado": se aplica aquí, sobre el borrador ya creado
    let destacado = false
    if (parsed.data.destacado) {
      const { error } = await (await createEditorClient()).from('posts').update({ is_featured: true }).eq('id', data.post_id)
      if (error) console.error('Asistir: no se pudo destacar el artículo', error.code)
      else {
        destacado = true
        revalidatePosts()
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        destacado,
        post_id: data.post_id,
        slug: data.slug ?? null,
        status: data.status ?? null,
        original_locale: data.original_locale ?? null,
        cover_image_url: data.cover_image_url ?? null,
        traducciones: data.traducciones ?? [],
      },
    })
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error'
    const timedOut = name === 'TimeoutError' || name === 'AbortError'
    // Solo el tipo de fallo: el mensaje (y el `cause`) de un fetch fallido arrastra el host del
    // webhook, y estos logs se leen en sitios donde esa URL no deberia acabar.
    console.error('Asistir: webhook inalcanzable', timedOut ? 'timeout' : name)
    return NextResponse.json(
      {
        success: false,
        code: timedOut ? 'timeout' : 'webhook_caido',
        error: timedOut ? 'El asistente no respondió a tiempo' : 'No se pudo contactar con el asistente',
      },
      { status: timedOut ? 504 : 502 }
    )
  } finally {
    enCurso = false
  }
}
