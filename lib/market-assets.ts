// Client-safe catalog of the terminal (no server imports). Derived from lib/assets-catalog.ts,
// la única fuente de verdad — ver ese archivo para agregar/editar un activo.
import { ASSETS } from './assets-catalog'

export type MarketCategory = 'crypto' | 'forex' | 'commodity' | 'stock' | 'index'

export interface MarketAssetDef {
  symbol: string
  category: MarketCategory
  // Short name shown in the terminal; falls back to the scanner's own name
  label?: string
  // Spanish description; falls back to the scanner's own description
  title?: string
  // English counterpart of `title` (Fase 5 del plan de cobertura en inglés) — same stock
  // exclusion as `title`, the scanner's own description is already in English for those.
  nameEn?: string
}

export const MARKET_CATEGORY_LABELS: Record<MarketCategory, string> = {
  crypto: 'Cripto',
  forex: 'Forex',
  commodity: 'Materias primas',
  stock: 'Acciones',
  index: 'Índices',
}

export const MARKET_ASSETS: MarketAssetDef[] = ASSETS.map((a) => ({
  symbol: a.tv,
  category: a.cls,
  label: a.label,
  title: a.cls === 'stock' ? undefined : a.name,
  nameEn: a.cls === 'stock' ? undefined : a.nameEn,
}))
