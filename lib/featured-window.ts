// Regla de "artículo destacado de la portada": solo lo está durante las 24 h siguientes a su
// publicación. Pura y sin acceso al reloj (recibe `now`) para poder probarla y para que quien la
// llama decida cuándo "es ahora".

export const FEATURED_WINDOW_MS = 24 * 60 * 60 * 1000

function ageMs(publishedAt: string | null | undefined, now: number): number | null {
  if (!publishedAt) return null
  const t = Date.parse(publishedAt)
  if (Number.isNaN(t)) return null
  return now - t
}

// Dentro de la ventana = publicado hace [0, 24 h). Fecha futura o inválida: no se destaca.
export function isInFeaturedWindow(publishedAt: string | null | undefined, now: number = Date.now()): boolean {
  const age = ageMs(publishedAt, now)
  return age !== null && age >= 0 && age < FEATURED_WINDOW_MS
}

// Horas que le quedan de destacado, redondeadas hacia arriba (0 si ya no lo está).
export function featuredHoursLeft(publishedAt: string | null | undefined, now: number = Date.now()): number {
  const age = ageMs(publishedAt, now)
  if (age === null || age < 0 || age >= FEATURED_WINDOW_MS) return 0
  return Math.ceil((FEATURED_WINDOW_MS - age) / (60 * 60 * 1000))
}

// El destacado es el más reciente de los candidatos que sigue dentro de la ventana; si ninguno,
// no hay destacado. No depende del orden de entrada ni lo modifica.
export function pickFeaturedPost<T extends { published_at: string | null }>(
  posts: readonly T[],
  now: number = Date.now()
): T | undefined {
  let best: T | undefined
  let bestTime = -Infinity
  for (const post of posts) {
    if (!isInFeaturedWindow(post.published_at, now)) continue
    const t = Date.parse(post.published_at as string)
    if (t > bestTime) {
      best = post
      bestTime = t
    }
  }
  return best
}
