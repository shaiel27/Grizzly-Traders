// Derivado de lib/assets-catalog.ts, la única fuente de verdad — ver ese archivo para
// agregar/editar un activo. Antes esto declaraba su propio subconjunto de 34 activos a mano,
// un tercio del catálogo real de la terminal (64); ahora expone el set completo.
import { ASSETS, type AssetDefinition } from './assets-catalog'

export type PivotCategory = 'crypto' | 'forex' | 'commodity' | 'index' | 'stock'

export interface PivotAsset {
  // TradingView ticker; the scanner echoes it back, so it identifies the asset everywhere
  tv: string
  label: string
  name: string
  category: PivotCategory
}

export const PIVOT_CATEGORIES: { key: PivotCategory; label: string }[] = [
  { key: 'crypto', label: 'Cripto' },
  { key: 'forex', label: 'Forex' },
  { key: 'commodity', label: 'Materias primas' },
  { key: 'index', label: 'Índices' },
  { key: 'stock', label: 'Acciones' },
]

function aPivotAsset(a: AssetDefinition): PivotAsset {
  return { tv: a.tv, label: a.label ?? a.plain, name: a.name, category: a.cls }
}

export const PIVOT_ASSETS: PivotAsset[] = ASSETS.map(aPivotAsset)

export const PIVOT_ASSET_BY_TV = new Map(PIVOT_ASSETS.map((asset) => [asset.tv, asset]))

// Shortcuts shown in the calculator — mismo flag `popular` del catálogo que usan los filtros de
// /articulos y /buscar (CategoryFilter.tsx), un solo lugar para decidir que activos destacar.
export const POPULAR_PIVOT_ASSETS = ASSETS.filter((a) => a.popular).map((a) => a.tv)
