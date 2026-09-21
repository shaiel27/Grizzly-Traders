import { revalidateTag } from 'next/cache'

// Editors expect to see their change right away, so expire immediately instead of serving stale content.
export function revalidateContent() {
  revalidateTag('posts', { expire: 0 })
  revalidateTag('catalog', { expire: 0 })
}
