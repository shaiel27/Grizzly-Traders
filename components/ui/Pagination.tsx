import Link from 'next/link'

interface PaginationProps {
  basePath: string
  params: Record<string, string | undefined>
  page: number
  hasMore: boolean
}

export function Pagination({ basePath, params, page, hasMore }: PaginationProps) {
  if (page <= 1 && !hasMore) return null

  const hrefFor = (target: number) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== 'page') search.set(key, value)
    }
    if (target > 1) search.set('page', String(target))
    const query = search.toString()
    return query ? `${basePath}?${query}` : basePath
  }

  return (
    <nav aria-label="Paginación" className="flex items-center justify-center gap-2 mt-10">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} rel="prev" className="btn-secondary">
          Anterior
        </Link>
      )}
      <span className="text-body text-ink-muted px-4" aria-current="page">
        Página {page}
      </span>
      {hasMore && (
        <Link href={hrefFor(page + 1)} rel="next" className="btn-secondary">
          Siguiente
        </Link>
      )}
    </nav>
  )
}
