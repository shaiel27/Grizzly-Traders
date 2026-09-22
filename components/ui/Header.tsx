'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { LiveTicker } from './LiveTicker'
import { Button } from './Button'
import type { TickerSnapshot } from '@/lib/ticker'

interface CategoryData {
  id: number
  name: string
  slug: string
}

interface HeaderProps {
  categories?: CategoryData[]
  initialTicker?: TickerSnapshot | null
}

interface NavEntry {
  label: string
  slug: string
  href: string
}

const CATEGORY_LABELS: Record<string, string> = {
  criptomonedas: 'Crypto',
  forex: 'Forex',
  'materias-primas': 'Commodities',
  acciones: 'Equities',
}

const FALLBACK_NAV: NavEntry[] = [
  { label: 'Forex', slug: 'forex', href: '/articulos?categoria=forex' },
  { label: 'Crypto', slug: 'criptomonedas', href: '/articulos?categoria=criptomonedas' },
  { label: 'Commodities', slug: 'materias-primas', href: '/articulos?categoria=materias-primas' },
  { label: 'Equities', slug: 'acciones', href: '/articulos?categoria=acciones' },
]

interface NavLinksProps {
  items: NavEntry[]
  activeCategory: string
  variant: 'desktop' | 'mobile'
  onNavigate?: () => void
}

function NavLinks({ items, activeCategory, variant, onNavigate }: NavLinksProps) {
  const pathname = usePathname()
  const isActive = (slug: string) => {
    if (slug === '__autor') return pathname.startsWith('/autor')
    if (slug === '__pivots') return pathname === '/pivot-points'
    if (slug === '__markets') return pathname === '/markets'
    if (slug === '__tools') return pathname === '/herramientas'
    if (slug === '__learn') return pathname === '/aprende'
    return slug ? activeCategory === slug : pathname === '/articulos' && !activeCategory
  }

  const links = items.map((item) => (
    <Link
      key={item.slug}
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive(item.slug) ? 'page' : undefined}
      className={clsx(
        variant === 'desktop'
          ? 'text-body-sm font-medium transition-colors whitespace-nowrap'
          : 'block py-2.5 text-body font-medium transition-colors',
        isActive(item.slug) ? 'text-accent-blue' : 'text-ink-muted hover:text-ink'
      )}
    >
      {item.label}
    </Link>
  ))

  if (variant === 'desktop') return <>{links}</>

  return (
    <ul className="flex flex-col">
      {links.map((link) => (
        <li key={link.key}>{link}</li>
      ))}
    </ul>
  )
}

// Reading the query string forces client rendering up to the nearest Suspense boundary,
// so it lives in its own small component and the rest of the header stays in the static HTML.
function NavLinksWithParams(props: Omit<NavLinksProps, 'activeCategory'>) {
  const searchParams = useSearchParams()
  return <NavLinks {...props} activeCategory={searchParams.get('categoria') ?? ''} />
}

function ActiveNavLinks(props: Omit<NavLinksProps, 'activeCategory'>) {
  return (
    <Suspense fallback={<NavLinks {...props} activeCategory="" />}>
      <NavLinksWithParams {...props} />
    </Suspense>
  )
}

export function Header({ categories = [], initialTicker }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const isTerminal = pathname === '/markets'

  const categoryItems: NavEntry[] =
    categories.length > 0
      ? categories.map((cat) => ({
          label: CATEGORY_LABELS[cat.slug] ?? cat.name,
          slug: cat.slug,
          href: `/articulos?categoria=${cat.slug}`,
        }))
      : FALLBACK_NAV
  const navItems: NavEntry[] = [{ label: 'Noticias', slug: '', href: '/articulos' }, ...categoryItems]
  const desktopItems: NavEntry[] = [...navItems, { label: 'Autor', slug: '__autor', href: '/autor' }]
  const mobileItems: NavEntry[] = [
    ...desktopItems,
    { label: 'Pivot Points', slug: '__pivots', href: '/pivot-points' },
    { label: 'Herramientas', slug: '__tools', href: '/herramientas' },
    { label: 'Glosario', slug: '__learn', href: '/aprende' },
    { label: 'Terminal de mercados', slug: '__markets', href: '/markets' },
  ]

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const term = query.trim()
    if (!term) return
    setSearchOpen(false)
    setMenuOpen(false)
    router.push(`/buscar?q=${encodeURIComponent(term)}`)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex flex-col border-b border-outline-variant/40 bg-surface-translucent backdrop-blur-md">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-full focus:bg-accent-blue focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Saltar al contenido
      </a>
      <LiveTicker initialQuotes={initialTicker?.quotes} initialUpdatedAt={initialTicker?.updatedAt} />

      <nav className="max-w-[1200px] mx-auto w-full px-6 md:px-8 py-3 flex items-center justify-between gap-4" aria-label="Navegación principal">
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="Grizzly Traders - Inicio">
          <Image
            src="/logo.png"
            alt="Grizzly Traders Logo"
            width={32}
            height={32}
            className="size-8 object-contain"
            priority
          />
          <span className="bg-[#f7b955] text-[#0b0b0c] text-[9px] font-bold tracking-[0.18em] px-1.5 py-[3px] rounded-[4px] uppercase leading-none">
            Terminal
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-7">
          <ActiveNavLinks items={desktopItems} variant="desktop" />
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <form onSubmit={submitSearch} className="hidden sm:flex items-center gap-2 bg-white/[0.04] border border-hairline rounded-full pl-3 pr-2 py-1.5 focus-within:border-accent-blue transition-colors">
            <span className="material-symbols-outlined text-[16px] text-ink-muted" aria-hidden="true">
              search
            </span>
            <input
              ref={searchInputRef}
              type="search"
              aria-label="Buscar noticias"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar símbolo, noticia..."
              className="bg-transparent outline-none text-sm w-40 text-ink placeholder:text-ink-subtle"
            />
            <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded-md border border-hairline bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-muted" aria-hidden="true">
              ⌘K
            </kbd>
          </form>

          <button
            type="button"
            onClick={() => setSearchOpen(!searchOpen)}
            className="sm:hidden flex size-9 items-center justify-center rounded-full border border-hairline bg-white/[0.04] text-ink-muted hover:text-ink hover:border-accent-blue transition-colors"
            aria-label="Buscar"
            aria-expanded={searchOpen}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              search
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex size-9 items-center justify-center rounded-full border border-hairline bg-white/[0.04] text-ink-muted hover:text-ink hover:border-accent-blue transition-colors"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              {menuOpen ? 'close' : 'menu'}
            </span>
          </button>

          <Button variant="ghost" size="sm" className="hidden xl:inline-flex gap-2" asChild>
            <Link href="/#vip" aria-label="Unirse a la comunidad">
              <span className="material-symbols-outlined text-[16px] text-accent-blue" aria-hidden="true">
                send
              </span>
              <span>Telegram / Discord</span>
            </Link>
          </Button>

          <Link
            href="/cms"
            prefetch={false}
            className="hidden md:flex size-9 items-center justify-center rounded-full border border-hairline bg-white/[0.04] text-ink-muted hover:text-ink hover:border-accent-blue transition-colors"
            aria-label="Panel de administración"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              edit_note
            </span>
          </Link>

          <Link
            href="/pivot-points"
            className={clsx(
              'hidden sm:flex size-9 items-center justify-center rounded-full border transition-colors',
              pathname === '/pivot-points'
                ? 'border-accent-blue text-accent-blue bg-accent-blue/10'
                : 'border-hairline bg-white/[0.04] text-ink-muted hover:text-ink hover:border-accent-blue'
            )}
            aria-label="Pivot Points"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              functions
            </span>
          </Link>

          <Link
            href="/markets"
            className={clsx(
              'hidden sm:flex size-9 items-center justify-center rounded-full border transition-colors',
              isTerminal
                ? 'border-accent-blue text-accent-blue bg-accent-blue/10'
                : 'border-hairline bg-white/[0.04] text-ink-muted hover:text-ink hover:border-accent-blue'
            )}
            aria-label="Terminal de mercados"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              candlestick_chart
            </span>
          </Link>

          <Button variant="accent" size="sm" className="hidden sm:inline-flex" asChild>
            <Link href="/#vip">Join VIP Terminal</Link>
          </Button>
        </div>
      </nav>

      {menuOpen && (
        <div id="mobile-menu" className="md:hidden border-t border-outline-variant/40 px-6 py-3">
          <ActiveNavLinks items={mobileItems} variant="mobile" onNavigate={() => setMenuOpen(false)} />
        </div>
      )}

      {searchOpen && (
        <form onSubmit={submitSearch} className="sm:hidden px-4 pb-3">
          <input
            type="search"
            aria-label="Buscar noticias"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar símbolo, noticia..."
            className="w-full rounded-full border border-hairline bg-white/[0.04] px-4 py-2 text-sm text-ink placeholder:text-ink-subtle outline-none focus:border-accent-blue"
            autoFocus
          />
        </form>
      )}
    </header>
  )
}
