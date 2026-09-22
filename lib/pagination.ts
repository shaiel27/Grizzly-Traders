export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

// Page indexes are 0-based; an index past the end falls back to the last page
export function pageSlice<T>(items: T[], page: number, pageSize: number): T[] {
  const safe = Math.min(Math.max(0, page), pageCount(items.length, pageSize) - 1)
  return items.slice(safe * pageSize, safe * pageSize + pageSize)
}

export type PageItem = number | 'ellipsis'

// Page buttons to show: always the first and last page, the current one and `siblings` on each side,
// with an ellipsis wherever pages are skipped
export function pageWindow(current: number, total: number, siblings = 1): PageItem[] {
  if (total <= 1) return [0]

  const wanted = new Set<number>([0, total - 1])
  for (let page = current - siblings; page <= current + siblings; page++) {
    if (page >= 0 && page < total) wanted.add(page)
  }

  const pages = [...wanted].sort((a, b) => a - b)
  const items: PageItem[] = []
  pages.forEach((page, index) => {
    const previous = pages[index - 1]
    if (previous !== undefined && page - previous > 1) {
      // A single skipped page is shown as the page itself: an ellipsis would take the same room
      items.push(page - previous === 2 ? previous + 1 : 'ellipsis')
    }
    items.push(page)
  })
  return items
}
