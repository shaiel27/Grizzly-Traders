'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Chip } from './Chip'
import { categoryMeta } from '@/lib/feed'
import { useDictionary, useLocale } from '@/lib/i18n/LocaleProvider'
import { ASSET_BY_PLAIN } from '@/lib/assets-catalog'
import type { Dictionary } from '@/lib/i18n/get-dictionary'
import type { Category, Tag, Asset } from '@/lib/types'

interface CategoryFilterProps {
  categories: Category[]
  tags?: Tag[]
  assets?: Asset[]
}

// public.tipos_activo.name (Crypto/Forex/Commodity/Stock/Index) -> clave de dict.feedControls.
// Taxonomía distinta a la de blog (categoryMeta, criptomonedas/forex/materias-primas/acciones):
// no reusar esa — son dos clasificaciones distintas que solo se parecen en el nombre.
const TIPO_A_CLAVE_DICT: Record<string, keyof Dictionary['feedControls']> = {
  Crypto: 'assetTypeCrypto',
  Forex: 'assetTypeForex',
  Commodity: 'assetTypeCommodity',
  Stock: 'assetTypeStock',
  Index: 'assetTypeIndex',
}
const ORDEN_TIPOS = ['Crypto', 'Forex', 'Commodity', 'Stock', 'Index']

export function CategoryFilter({ categories, tags = [], assets = [] }: CategoryFilterProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { locale } = useLocale()
  const dict = useDictionary()
  const [expandido, setExpandido] = useState(false)

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

  // "popular" vive en el catálogo (lib/assets-catalog.ts), no en la tabla `activos` — ahí no hay
  // columna para eso. Si por algo raro ninguno matchea (activo en DB que el catálogo no conoce
  // todavía), cae a los primeros 8 en vez de mostrar una fila vacía.
  const popularAssets = assets.filter((a) => ASSET_BY_PLAIN.get(a.symbol)?.popular)
  const filaPrincipal = popularAssets.length > 0 ? popularAssets : assets.slice(0, 8)

  return (
    <div className="section-container py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-subhead font-bold text-ink">{dict.feedControls.filtersTitle}</h2>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-body-sm text-accent-blue hover:text-accent-blue-hover transition-colors"
          >
            {dict.feedControls.clearAll}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label={dict.feedControls.categoriesAria}>
          <Chip
            active={!currentCategory}
            onClick={() => updateParams('categoria', null)}
            className="bg-surface-2"
          >
            {dict.feedControls.allCategories}
          </Chip>
          {categories.map((cat) => (
            <Chip
              key={cat.slug}
              active={currentCategory === cat.slug}
              onClick={() => updateParams('categoria', currentCategory === cat.slug ? null : cat.slug)}
            >
              {categoryMeta(cat, locale).name}
            </Chip>
          ))}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={dict.feedControls.tagsAria}>
            <Chip
              active={!currentTag}
              onClick={() => updateParams('tag', null)}
              className="bg-surface-2"
            >
              {dict.feedControls.allTags}
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
          <div className="flex flex-wrap gap-2" role="group" aria-label={dict.feedControls.assetsAria}>
            <Chip
              active={!currentAsset}
              onClick={() => updateParams('activo', null)}
              className="bg-surface-2"
            >
              {dict.feedControls.allAssets}
            </Chip>
            {filaPrincipal.map((asset) => (
              <Chip
                key={asset.symbol}
                active={currentAsset === asset.symbol}
                onClick={() => updateParams('activo', currentAsset === asset.symbol ? null : asset.symbol)}
              >
                {asset.symbol}
              </Chip>
            ))}
            {assets.length > filaPrincipal.length && (
              <button
                type="button"
                onClick={() => setExpandido((v) => !v)}
                aria-expanded={expandido}
                aria-controls="activos-expandido"
                className="inline-flex items-center gap-1 rounded-full border border-hairline-soft px-3 py-1.5 text-body-sm text-ink-muted transition-colors hover:border-hairline hover:text-ink"
              >
                {expandido ? dict.feedControls.seeLess : dict.feedControls.seeAll}
                <span className={clsx('material-symbols-outlined text-[16px] transition-transform', expandido && 'rotate-180')} aria-hidden="true">
                  expand_more
                </span>
              </button>
            )}
          </div>
        )}

        {expandido && assets.length > filaPrincipal.length && (
          <div id="activos-expandido" className="flex w-full flex-col gap-3 border-t border-hairline-soft pt-3">
            {ORDEN_TIPOS.map((tipoNombre) => {
              const delTipo = assets.filter((a) => a.tipo?.name === tipoNombre)
              if (delTipo.length === 0) return null
              return (
                <div key={tipoNombre} className="flex flex-wrap items-center gap-2">
                  <span className="w-24 shrink-0 text-micro font-semibold uppercase tracking-wider text-ink-subtle">
                    {dict.feedControls[TIPO_A_CLAVE_DICT[tipoNombre]]}
                  </span>
                  {delTipo.map((asset) => (
                    <Chip
                      key={asset.symbol}
                      active={currentAsset === asset.symbol}
                      onClick={() => updateParams('activo', currentAsset === asset.symbol ? null : asset.symbol)}
                    >
                      {asset.symbol}
                    </Chip>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}