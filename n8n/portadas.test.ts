import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Cableado y lógica del tramo de portadas (Higgsfield con respaldo en OpenAI) y del ritmo del pipeline (3 notas cada 45 min),
// tal como están versionados en n8n/pipeline-noticias.json.

interface Nodo {
  name: string
  type: string
  credentials?: Record<string, { id: string }>
  parameters: { jsCode?: string; conditions?: { conditions: { leftValue: string; rightValue: unknown }[] } }
}
type Conexiones = Record<string, { main: ({ node: string }[] | null)[] }>
const texto = readFileSync('n8n/pipeline-noticias.json', 'utf8')
const flujo = JSON.parse(texto) as { nodes: Nodo[]; connections: Conexiones }
const nodo = (n: string) => flujo.nodes.find((x) => x.name === n)!
const destinos = (n: string, salida = 0) => (flujo.connections[n]?.main[salida] ?? []).map((x) => x.node)

describe('ritmo del pipeline: 3 notas cada 45 minutos', () => {
  it('publica 3 notas por vuelta: prueba hasta 9 candidatas y el Control de cupo se detiene al llegar a 3', () => {
    expect(nodo('Priorizar y limitar').parameters.jsCode).toContain('const N = 9;')
    expect(nodo('Control de cupo').parameters.jsCode).toContain('const CUPO = 3;')
  })

  it('el disparador sigue cada 15 min y la compuerta deja pasar exactamente 1 de cada 3: 32 ciclos al día, separados 45 min', () => {
    expect(destinos('Schedule Trigger')).toEqual(['¿Toca ciclo? (cada 45 min)'])
    expect(destinos('¿Toca ciclo? (cada 45 min)', 0)).toEqual(['Publicados recientes'])
    const cond = nodo('¿Toca ciclo? (cada 45 min)').parameters.conditions!.conditions[0]
    expect(cond.leftValue).toBe('={{ ($now.hour * 60 + $now.minute) % 45 }}')
    expect(cond.rightValue).toBe(0)
    const pasa = (min: number) => min % 45 === 0
    const ciclos: number[] = []
    for (let min = 0; min < 1440; min += 15) if (pasa(min)) ciclos.push(min)
    expect(ciclos).toHaveLength(32)
    expect(new Set(ciclos.slice(1).map((m, i) => m - ciclos[i]))).toEqual(new Set([45]))
    expect(1440 - ciclos[31]).toBe(45) // y el día siguiente empieza en fase
  })

  it('"Prueba manual" no pasa por la compuerta: se puede probar una vuelta en cualquier momento', () => {
    expect(destinos('Prueba manual')).toEqual(['Publicados recientes'])
  })
})

describe('portada: Higgsfield con respaldo en OpenAI', () => {
  it('la traducción preparada va primero a Higgsfield y los fallos del tramo caen en el respaldo, no en el post sin portada', () => {
    expect(destinos('Preparar traduccion', 0)).toEqual(['Higgsfield - Enviar'])
    const RESPALDO = ['OpenAI - Imagen GPT']
    expect(destinos('Higgsfield - Enviar', 1)).toEqual(RESPALDO)
    expect(destinos('Higgsfield - Estado', 1)).toEqual(RESPALDO)
    expect(destinos('Higgsfield - Descargar', 1)).toEqual(RESPALDO)
    expect(destinos('Higgsfield - Resultado', 2)).toEqual(RESPALDO)
  })

  it('el ciclo de espera es: enviar → esperar → estado → evaluar → (listo: descargar | esperar: vuelve | fallo: respaldo)', () => {
    expect(destinos('Higgsfield - Enviar', 0)).toEqual(['Higgsfield - Esperar'])
    expect(destinos('Higgsfield - Esperar')).toEqual(['Higgsfield - Estado'])
    expect(destinos('Higgsfield - Estado', 0)).toEqual(['Higgsfield - Evaluar'])
    expect(destinos('Higgsfield - Evaluar')).toEqual(['Higgsfield - Resultado'])
    expect(destinos('Higgsfield - Resultado', 0)).toEqual(['Higgsfield - Descargar'])
    expect(destinos('Higgsfield - Resultado', 1)).toEqual(['Higgsfield - Esperar'])
    expect(destinos('Higgsfield - Descargar', 0)).toEqual(['Optimizar imagen'])
  })

  it('el respaldo sigue el camino original: Optimizar imagen o Registrar fallo', () => {
    expect(destinos('OpenAI - Imagen GPT', 0)).toEqual(['Optimizar imagen'])
    expect(destinos('OpenAI - Imagen GPT', 1)).toEqual(['Registrar fallo'])
  })

  it('las credenciales van por id, nunca el secreto; la descarga de la URL firmada no lleva credenciales de Higgsfield', () => {
    for (const n of ['Higgsfield - Enviar', 'Higgsfield - Estado']) expect(nodo(n).credentials?.httpHeaderAuth.id).toBe('higgsfieldCred0001')
    expect(nodo('Higgsfield - Descargar').credentials).toBeUndefined()
    expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27}:[0-9a-f]{40,}/)
  })

  it('pide 3:2 a 1080p con la escena de cada nota y un prompt sin vocabulario de imprenta', () => {
    const cuerpo = (nodo('Higgsfield - Enviar').parameters as unknown as { jsonBody: string }).jsonBody
    expect(cuerpo).toContain("resolution: '1080p'")
    expect(cuerpo).toContain("aspect_ratio: '3:2'")
    expect(cuerpo).toContain("$('Parsear JSON').item.json.prompt_imagen")
    // Soul 2 no tiene prompt negativo e ignora las prohibiciones: con vocabulario de imprenta dibuja titulares y marcas ilegibles.
    // El prompt pide una foto "sin palabras" y no menciona periódico, imprenta ni tinta.
    expect(cuerpo).toContain('One continuous scene fills the whole frame')
    expect(cuerpo).toContain('no signs, no labels, no screens, no lettering')
    expect(cuerpo).not.toMatch(/newsprint|newspaper|offset|printed|printing|ink|headline|blank/i)
  })
})

describe('Higgsfield - Evaluar (lógica de decisión)', () => {
  const CODIGO = nodo('Higgsfield - Evaluar').parameters.jsCode!
  const evaluar = (respuesta: Record<string, unknown>, estatico: Record<string, unknown>, id = 'req-1') => {
    const fn = new Function('$json', '$', '$getWorkflowStaticData', CODIGO)
    return fn(respuesta, () => ({ item: { json: { request_id: id } } }), () => estatico).json as { decision: string; url: string | null; intentos: number }
  }

  it('listo cuando está completada y trae la URL de la imagen', () => {
    const r = evaluar({ status: 'completed', images: [{ url: 'https://x/y.png' }] }, {})
    expect(r).toMatchObject({ decision: 'listo', url: 'https://x/y.png' })
  })

  it('espera mientras está en cola o en curso', () => {
    const e = {}
    expect(evaluar({ status: 'queued' }, e).decision).toBe('esperar')
    expect(evaluar({ status: 'in_progress' }, e).decision).toBe('esperar')
  })

  it('pasa al respaldo si falla, la modera o se cancela, y si "completada" no trae imagen', () => {
    for (const status of ['failed', 'nsfw', 'canceled']) expect(evaluar({ status }, {}).decision).toBe('fallo')
    expect(evaluar({ status: 'completed', images: [] }, {}).decision).toBe('fallo')
  })

  it('se rinde tras 14 consultas (~3 min) y el contador es por solicitud, no se acumula entre notas', () => {
    const e = {}
    for (let i = 1; i < 14; i++) expect(evaluar({ status: 'in_progress' }, e, 'A').decision).toBe('esperar')
    expect(evaluar({ status: 'in_progress' }, e, 'A').decision).toBe('fallo')
    expect(evaluar({ status: 'in_progress' }, e, 'B').intentos).toBe(1) // otra nota empieza de cero
  })
})

describe('escena de portada que redacta GPT (prompt de análisis)', () => {
  const sistema = (nodo('OpenAI - Analisis GPT').parameters as unknown as { responses: { values: { content: string }[] } }).responses.values[0].content
  it('para una empresa describe su negocio y nunca la nombra: el generador dibujaría el nombre como texto', () => {
    expect(sistema).toContain('NUNCA escribas su nombre')
    expect(sistema).toContain('cohete de acero inoxidable')
  })
  it('evita los objetos que el generador llena de texto sin sentido y pide una sola foto continua', () => {
    expect(sistema).toContain('EVITA los objetos que suelen llevar escritura')
    for (const objeto of ['pantallas', 'carteles', 'letreros', 'cajas o envases con etiquetas']) expect(sistema).toContain(objeto)
    expect(sistema).toContain('una sola fotografia continua')
  })
})
