'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Chip } from './Chip'
import type { Category, Tag, Asset } from '@/lib/types'

interface CategoryFilterProps {
  categories: Category[]
  tags?: Tag[]
  assets?: Asset[]
}

export function CategoryFilter({ categories, tags = [], assets = [] }: CategoryFilterProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const currentCategory = searchParams.get('categoria')
  const currentTag = searchParams.get('tag')
  const currentAsset = searchParams.get('activo')

  const updateParams = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const clearAll = () => {
    router.push(pathname)
  }

  const hasFilters = currentCategory || currentTag || currentAsset

  return (
    <div className="section-container py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-subhead font-bold text-ink">Filtros</h2>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-body-sm text-accent-blue hover:text-accent-blue-hover transition-colors"
          >
            Limpiar todo
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Categorías">
          <Chip
            active={!currentCategory}
            onClick={() => updateParams('categoria', null)}
            className="bg-surface-2"
          >
            Todas
          </Chip>
          {categories.map((cat) => (
            <Chip
              key={cat.slug}
              active={currentCategory === cat.slug}
              onClick={() => updateParams('categoria', currentCategory === cat.slug ? null : cat.slug)}
            >
              {cat.name}
            </Chip>
          ))}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tags">
            <Chip
              active={!currentTag}
              onClick={() => updateParams('tag', null)}
              className="bg-surface-2"
            >
              Todos los tags
            </Chip>
            {tags.slice(0, 10).map((tag) => (
              <Chip
                key={tag.slug}
                active={currentTag === tag.slug}
                onClick={() => updateParams('tag', currentTag === tag.slug ? null : tag.slug)}
              >
                #{tag.name}
              </Chip>
            ))}
          </div>
        )}

        {assets.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Activos">
            <Chip
              active={!currentAsset}
              onClick={() => updateParams('activo', null)}
              className="bg-surface-2"
            >
              Todos los activos
            </Chip>
            {assets.slice(0, 8).map((asset) => (
              <Chip
                key={asset.symbol}
                active={currentAsset === asset.symbol}
                onClick={() => updateParams('activo', currentAsset === asset.symbol ? null : asset.symbol)}
                className="bg-surface-2 border-accent-blue/30 text-accent-blue"
              >
                {asset.symbol}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}