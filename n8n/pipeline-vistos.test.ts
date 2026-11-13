import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// El pipeline no deja filas de error en `posts`: recuerda lo ya visto en `pipeline_vistos` (migración 0015, docs/cms-articulos.md).

interface Nodo {
  name: string
  type: string
  parameters: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}
const flujo = JSON.parse(readFileSync('n8n/pipeline-noticias.json', 'utf8')) as { nodes: Nodo[]; connections: Record<string, { main: { node: string }[][] }> }
const nodo = (n: string) => flujo.nodes.find((x) => x.name === n)!
const RPC = 'https://pudzvatuubywmwdmboiq.supabase.co/rest/v1/rpc/'

// Evalúa una expresión de n8n (`={{ ... }}`) con los datos dados
function evaluar(expr: string, datos: { json?: unknown; normalizar?: unknown }) {
  const cuerpo = expr.replace(/^=\{\{/, '').replace(/\}\}$/, '')
  const f = new Function('$json', '$', `return (${cuerpo})`)
  return JSON.parse(f(datos.json ?? {}, (n: string) => ({ item: { json: datos.normalizar }, first: () => ({ json: datos.normalizar }) }))) as Record<string, unknown>
}

describe('el pipeline recuerda lo visto sin dejar filas de error', () => {
  it('«Publicados recientes» pide lo tratado (artículos + lo visto) de los últimos 10 días por la función de la base', () => {
    const n = nodo('Publicados recientes')
    expect(n.parameters.method).toBe('POST')
    expect(n.parameters.url).toBe(RPC + 'pipeline_tratados')
    expect(evaluar(n.parameters.jsonBody, {})).toEqual({ p_horas: 240 })
    // La respuesta sigue siendo una lista en `body`: «Descartar ya tratados» no cambia
    expect(n.parameters.options.response.response.fullResponse).toBe(true)
  })

  it('«Marcar fallo en post» recuerda la noticia (y borra el borrador) en vez de marcar el borrador', () => {
    const n = nodo('Marcar fallo en post')
    expect(n.parameters.method).toBe('POST')
    expect(n.parameters.url).toBe(RPC + 'pipeline_registrar_fallo')
    const fallo = { post_id: 'abc', source_url: 'https://x/1', titulo: 'Nota', pipeline_error: 'error: HTTP 500 al leer', log_status: 'failed' }
    expect(evaluar(n.parameters.jsonBody, { json: fallo })).toEqual({ p_post_id: 'abc', p_source_url: 'https://x/1', p_titulo: 'Nota', p_detalle: 'HTTP 500 al leer', p_motivo: 'fallo' })
    const checklist = { ...fallo, pipeline_error: 'checklist: El titulo es copia literal', log_status: 'draft_checklist' }
    expect(evaluar(n.parameters.jsonBody, { json: checklist })).toMatchObject({ p_detalle: 'El titulo es copia literal', p_motivo: 'checklist' })
  })

  it('«Guardar duplicado» solo recuerda la URL: ya no crea un borrador «duplicado-…»', () => {
    const n = nodo('Guardar duplicado')
    expect(n.parameters.url).toBe(RPC + 'pipeline_registrar_duplicado')
    expect(JSON.stringify(n.parameters)).not.toContain('duplicado-')
    expect(evaluar(n.parameters.jsonBody, { json: { titulo_similar: 'La libra cae' }, normalizar: { link: 'https://x/2', title: 'La libra se deprecia' } })).toEqual({
      p_source_url: 'https://x/2',
      p_titulo: 'La libra se deprecia',
      p_similar: 'La libra cae',
    })
  })

  it('el flujo no escribe ningún borrador de error en posts', () => {
    const texto = JSON.stringify(flujo.nodes.map((n) => n.parameters))
    expect(texto).not.toContain("'duplicado-'")
    expect(texto).not.toMatch(/pipeline_error: \$json\.pipeline_error/)
    // las conexiones no cambian: el fallo sigue pasando por Marcar fallo → Log fallo → siguiente noticia
    // un fallo de la nota se marca; un fallo de infraestructura (Firecrawl sin saldo) libera la reserva sin gastar intentos; los dos acaban en Log fallo
    expect(flujo.connections['Registrar fallo'].main[0].map((c) => c.node)).toEqual(['¿Fallo de infraestructura?'])
    expect(flujo.connections['¿Fallo de infraestructura?'].main.map((s) => s.map((c) => c.node))).toEqual([['Liberar reserva'], ['Marcar fallo en post']])
    expect(flujo.connections['Liberar reserva'].main[0].map((c) => c.node)).toEqual(['Log fallo'])
    expect(flujo.connections['Marcar fallo en post'].main[0].map((c) => c.node)).toEqual(['Log fallo'])
    expect(flujo.connections['Guardar duplicado'].main[0].map((c) => c.node)).toEqual(['Loop Over Items'])
  })

  describe('«Descartar ya tratados» con lo que devuelve la función (artículos y marcas de «visto»)', () => {
    const codigo = nodo('Descartar ya tratados').parameters.jsCode as string
    const correr = (tratados: unknown[], enlaces: string[]) => {
      const entrada = enlaces.map((l) => ({ json: { link: l } }))
      const f = new Function('$', '$input', codigo)
      const salida = f(
        (n: string) => (n === 'Publicados recientes' ? { first: () => ({ json: { statusCode: 200, body: tratados } }) } : { itemMatching: (i: number) => ({ json: entrada[i].json }) }),
        { all: () => entrada }
      ) as { json: { link: string } }[]
      return salida.map((s) => s.json.link)
    }
    const visto = (source_url: string, pipeline_attempts: number, pipeline_error: string) => ({ source_url, status: 'draft', origen: 'rss', pipeline_attempts, pipeline_error })

    it('deja pasar lo nuevo y lo que falló una sola vez; descarta duplicados, rechazados por el checklist, agotados y ya publicados', () => {
      const tratados = [
        visto('https://x/fallo1', 1, 'error: HTTP 500'),
        visto('https://x/fallo2', 2, 'error: HTTP 500'),
        visto('https://x/dup', 2, 'duplicado: La libra cae'),
        visto('https://x/check', 2, 'checklist: copia literal'),
        { source_url: 'https://x/pub', status: 'published', origen: 'rss', pipeline_attempts: 1, pipeline_error: null },
      ]
      const enlaces = ['https://x/nueva', 'https://x/fallo1', 'https://x/fallo2', 'https://x/dup', 'https://x/check', 'https://x/pub']
      expect(correr(tratados, enlaces)).toEqual(['https://x/nueva', 'https://x/fallo1'])
    })

    it('si la lista de tratados no se pudo leer, no deja pasar nada (falla cerrado)', () => {
      const f = new Function('$', '$input', codigo)
      const salida = f(() => ({ first: () => ({ json: { statusCode: 500, body: null } }) }), { all: () => [{ json: { link: 'x' } }] })
      expect(salida).toEqual([])
    })
  })
})
