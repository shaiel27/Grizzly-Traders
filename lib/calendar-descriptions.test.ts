import { describe, expect, it } from 'vitest'
import { descripcionDe, FAMILIAS } from './calendar-descriptions'

// Títulos reales del feed de ForexFactory (semana del 2026-10-18)
const TITULOS_SEMANA = [
  'BusinessNZ Services Index', 'Trade Balance', 'Rightmove HPI m/m', 'RBA Assist Gov Kent Speaks', 'New Home Prices m/m',
  'Fixed Asset Investment ytd/y', 'GDP q/y', 'Industrial Production y/y', 'NBS Press Conference', 'Retail Sales y/y',
  'Unemployment Rate', 'Tertiary Industry Activity m/m', 'CPI m/m', 'Median CPI y/y', 'Trimmed CPI y/y', 'Common CPI y/y',
  'Core CPI m/m', 'NAHB Housing Market Index', 'BOC Business Outlook Survey', '1-y Loan Prime Rate', '5-y Loan Prime Rate',
  'German PPI m/m', 'Average Earnings Index 3m/y', 'Claimant Count Change', 'Current Account', 'German ZEW Economic Sentiment',
  'ZEW Economic Sentiment', '10-y Bond Auction', 'ADP Weekly Employment Change', 'Building Permits', 'Housing Starts',
  'Pending Home Sales m/m', 'GDT Price Index', 'MPC Member Greene Speaks', 'API Weekly Statistical Bulletin',
  'RBA Deputy Gov Hauser Speaks', 'Credit Card Spending y/y', 'CPI y/y', 'Core CPI y/y', 'PPI Input m/m', 'PPI Output m/m',
  'Public Sector Net Borrowing', 'RPI y/y', 'German Buba President Nagel Speaks', 'HPI y/y', 'German Buba Monthly Report',
  'BOE Gov Bailey Speaks', 'Crude Oil Inventories', 'CPI q/q', 'Summary of Monetary Policy Discussions',
  'Foreign Direct Investment ytd/y', 'CBI Industrial Order Expectations', 'Unemployment Claims', 'IPPI m/m', 'RMPI m/m',
  'NHPI m/m', 'Consumer Confidence', 'CB Leading Index m/m', 'Natural Gas Storage', 'Flash Manufacturing PMI',
  'Flash Services PMI', 'GfK Consumer Confidence', 'National Core CPI y/y', 'Retail Sales m/m', 'French Flash Manufacturing PMI',
  'German Flash Services PMI', 'Core Retail Sales m/m', 'Belgian NBB Business Climate', 'Revised UoM Consumer Sentiment',
  'Revised UoM Inflation Expectations', 'Non-Farm Employment Change', 'Employment Change', 'Federal Funds Rate', 'Official Cash Rate',
]

describe('calendar-descriptions', () => {
  it('cubre todos los títulos recurrentes de la semana', () => {
    const sinCubrir = TITULOS_SEMANA.filter((titulo) => descripcionDe(titulo) === null)
    expect(sinCubrir).toEqual([])
  })

  it('ninguna familia describe el efecto en el precio ni da predicciones', () => {
    const prohibidas = /suele|probable|anticip|adelant|mueve|mover|fortalec|debilit|atractiv|sube los|sostener|presionar|empuj|crea demanda|(?:sube|bajan?) (?:los|el|la) |\bmoves?\b|\bboosts?\b|\bweighs?\b|\bsupport(?:s|ed)?\b|\bpush(?:es|ed)?\b|\bdrives? (?:the )?(?:dollar|currency)|\bmake it more\b|\bmore likely\b|\btends? to\b|\busually\b/i
    for (const familia of FAMILIAS) {
      for (const idioma of [familia.es, familia.en]) {
        expect(`${idioma.que} ${idioma.porque}`, familia.id).not.toMatch(prohibidas)
      }
    }
  })

  it('no inventa descripción para avisos que no son una publicación', () => {
    expect(descripcionDe('Daylight Saving Time Shift')).toBeNull()
    expect(descripcionDe('IMF Meetings')).toBeNull()
  })

  it('las familias tienen id único y texto no vacío en español e inglés', () => {
    const ids = FAMILIAS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const familia of FAMILIAS) {
      for (const idioma of [familia.es, familia.en]) {
        expect(idioma.que.length).toBeGreaterThan(20)
        expect(idioma.porque.length).toBeGreaterThan(20)
      }
    }
  })

  it('las fuentes oficiales son enlaces https', () => {
    for (const familia of FAMILIAS) {
      for (const fuente of Object.values(familia.fuentes ?? {})) {
        expect(fuente?.url).toMatch(/^https:\/\//)
      }
    }
  })

  it('casos concretos: el IPC apunta al BLS solo para USD y el desempleo se lee a la inversa', () => {
    const ipc = descripcionDe('Core CPI y/y')
    expect(ipc?.id).toBe('cpi')
    expect(ipc?.fuentes?.USD?.url).toContain('bls.gov')
    expect(ipc?.fuentes?.EUR).toBeUndefined()
    expect(descripcionDe('Unemployment Rate')).not.toHaveProperty('direccion')
    expect(descripcionDe('PPI Input m/m')?.id).toBe('ppi')
    expect(descripcionDe('IPPI m/m')?.id).toBe('ippi-rmpi')
  })
})
