import { revalidateTag } from 'next/cache'

// Editors expect to see their change right away, so expire immediately instead of serving stale content.
// Los posts y el catálogo (categorías, tags, activos, autores) caducan por separado: editar un artículo ya no vacía
// el catálogo.
export function revalidatePosts() {
  revalidateTag('posts', { expire: 0 })
}

export function revalidateCatalog() {
  revalidateTag('catalog', { expire: 0 })
}

export function revalidateContent() {
  revalidatePosts()
  revalidateCatalog()
}
