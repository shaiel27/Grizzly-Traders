// Columnas configurables de la tabla de mercados (C7): lo que hay en localStorage puede venir de
// otra versión del componente, de las DevTools o de un JSON roto, así que nunca se consume en crudo.
//
// Contrato de `sanitizeStoredColumns`:
// - `raw` no es un array → se devuelven los `fallback` (los defaults de la tabla).
// - Claves desconocidas, repetidas o que no sean string → se ignoran.
// - El resultado sale en el orden canónico de `valid` (el orden de render), no en el guardado: la
//   visibilidad es un conjunto, el orden lo fija el componente.
// - Si no sobrevive ninguna columna → `fallback`: una tabla sin columnas no tiene sentido.
export function sanitizeStoredColumns(
  raw: unknown,
  valid: readonly string[],
  fallback: readonly string[]
): string[] {
  const defaults = fallback.filter((key) => valid.includes(key))
  if (!Array.isArray(raw)) return [...defaults]
  const kept = valid.filter((key) => raw.includes(key))
  return kept.length > 0 ? kept : [...defaults]
}
