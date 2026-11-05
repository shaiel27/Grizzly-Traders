import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Flujo n8n/resumen-diario.json: dispara el resumen de la newsletter a las 16:30 de Nueva York y falla en voz alta si algo sale mal.

interface Nodo {
  name: string
  type: string
  credentials?: Record<string, { id: string }>
  parameters: Record<string, unknown> & { jsCode?: string }
}
const texto = readFileSync('n8n/resumen-diario.json', 'utf8')
const [flujo] = JSON.parse(texto) as [{ nodes: Nodo[]; connections: Record<string, { main: { node: string }[][] }>; settings: { timezone: string } }]
const nodo = (n: string) => flujo.nodes.find((x) => x.name === n)!

describe('resumen diario (n8n)', () => {
  it('corre todos los días a las 16:30 en hora de Nueva York (30 min después del cierre, con cambio de horario incluido)', () => {
    const disparador = flujo.nodes.find((n) => n.type === 'n8n-nodes-base.scheduleTrigger')!
    expect(JSON.stringify(disparador.parameters)).toContain('"expression":"30 16 * * *"')
    expect(flujo.settings.timezone).toBe('America/New_York')
  })

  it('llama al endpoint del propio sitio con la credencial por id, sin secretos ni simulación en el flujo', () => {
    const http = nodo('Enviar resumen')
    expect(http.parameters.url).toBe('http://127.0.0.1:3000/api/newsletter/digest')
    expect(http.parameters.method).toBe('POST')
    expect(http.credentials?.httpHeaderAuth.id).toBe('digestCronCred0001')
    expect(http.parameters.jsonBody).toBe('{}') // sin dryRun: es el envío real
    expect(texto).not.toMatch(/Bearer [A-Za-z0-9]{20,}/)
  })

  it('el cableado es disparador → enviar → verificar', () => {
    const disparador = flujo.nodes.find((n) => n.type === 'n8n-nodes-base.scheduleTrigger')!.name
    expect(flujo.connections[disparador].main[0].map((c) => c.node)).toEqual(['Enviar resumen'])
    expect(flujo.connections['Enviar resumen'].main[0].map((c) => c.node)).toEqual(['Verificar resultado'])
  })

  describe('verificación del resultado', () => {
    const fn = new Function('$json', nodo('Verificar resultado').parameters.jsCode!)
    it('acepta enviado y omitido (menos de 3 notas, ya enviado hoy)', () => {
      const r = fn({ success: true, results: { es: { status: 'sent', count: 5 }, en: { status: 'skipped', reason: 'pocas notas' } } })
      expect(r.json.resumen.es).toMatchObject({ status: 'sent', articulos: 5 })
      expect(r.json.resumen.en).toMatchObject({ status: 'skipped', motivo: 'pocas notas' })
    })
    it('falla si el servidor no tiene éxito o si algún idioma falla', () => {
      expect(() => fn({ success: false, error: 'No autorizado' })).toThrow(/rechazó/)
      expect(() => fn({ success: true, results: { es: { status: 'failed', error: 'Resend 422' } } })).toThrow(/es \(Resend 422\)/)
      expect(() => fn({ success: true, results: { en: { status: 'skipped', reason: 'missing_postal_address' } } })).toThrow(/en \(skipped\)/)
    })
  })
})
