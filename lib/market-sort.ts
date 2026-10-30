export interface SortableAsset {
  name: string
  change: number | null
}

const finite = (value: number | null): value is number => typeof value === 'number' && Number.isFinite(value)

// Broken values (null/NaN) sort last so the head of the list always holds real movers
export function compareByChange(a: SortableAsset, b: SortableAsset): number {
  const aValue = finite(a.change) ? a.change : null
  const bValue = finite(b.change) ? b.change : null
  if (aValue === null || bValue === null) {
    if (aValue === null && bValue === null) return 0
    return aValue === null ? 1 : -1
  }
  return bValue - aValue
}

// Names sort with the locale of the interface, never with the runtime default: the same list must
// read the same way in es and en. Blank names go last, same rule as missing changes.
export function compareByName(a: SortableAsset, b: SortableAsset, locale: string): number {
  const aValue = a.name.trim()
  const bValue = b.name.trim()
  if (!aValue || !bValue) {
    if (!aValue && !bValue) return 0
    return aValue ? -1 : 1
  }
  return aValue.localeCompare(bValue, locale)
}
