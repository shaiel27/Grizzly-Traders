'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { LiveTicker } from './LiveTicker'
import { Button } from './Button'
import { LocaleSwitcher } from './LocaleSwitcher'
import { useDictionary } from '@/lib/i18n/LocaleProvider'
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
  icon?: string
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
    if (slug === '__calendar') return pathname === '/calendario'
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
          ? 'relative py-1 text-body-sm font-medium transition-colors whitespace-nowrap after:absolute after:inset-x-0 after:-bottom-[7px] after:h-[2px] after:rounded-full after:transition-colors'
          : 'flex items-center gap-2.5 py-2.5 text-body font-medium transition-colors',
        isActive(item.slug)
          ? variant === 'desktop'
            ? 'text-ink after:bg-accent-blue'
            : 'text-accent-blue'
          : variant === 'desktop'
            ? 'text-ink-muted after:bg-transparent hover:text-ink'
            : 'text-ink-muted hover:text-ink'
      )}
    >
      {variant === 'mobile' && item.icon && (
        <span className="material-symbols-outlined text-[18px] text-ink-subtle" aria-hidden="true">
          {item.icon}
        </span>
      )}
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

interface ToolIconProps {
  href: string
  icon: string
  label: string
  active?: boolean
}

// Trading-tool shortcuts (Pivot Points, Calendario, Terminal) share this pill so the icon cluster reads as one group
function ToolIcon({ href, icon, label, active }: ToolIconProps) {
  return (
    <Link
      href={href}
      className={clsx(
        'flex size-8 items-center justify-center rounded-full transition-colors',
        active ? 'bg-accent-blue/15 text-accent-blue' : 'text-ink-muted hover:text-ink hover:bg-white/[0.06]'
      )}
      aria-label={label}
      title={label}
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
        {icon}
      </span>
    </Link>
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
  const headerRef = useRef<HTMLElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const dict = useDictionary()
  const isTerminal = pathname === '/markets'

  // El header real puede medir distinto al valor fijo de --header-height: fuentes del sistema
  // mas grandes, zoom del navegador, o el menu movil abierto lo cambian. Sin esto, el hero y
  // cualquier scroll a un ancla quedan calculados contra un numero que no es el real (ver plan
  // 009 B2/B3). ResizeObserver cubre los tres casos (incluido el menu movil, que cambia la
  // altura del propio <header>) sin tener que escuchar resize/orientationchange a mano.
  useEffect(() => {
    const el = headerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const alto = Math.round(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height)
      document.documentElement.style.setProperty('--header-h-real', `${alto}px`)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Category nav labels (Forex/Crypto/Commodities/Equities) stay as short English trading jargon in
  // both locales, by existing design (CATEGORY_LABELS/FALLBACK_NAV below) — not translated here.
  const categoryItems: NavEntry[] =
    categories.length > 0
      ? categories.map((cat) => ({
          label: CATEGORY_LABELS[cat.slug] ?? cat.name,
          slug: cat.slug,
          href: `/articulos?categoria=${cat.slug}`,
        }))
      : FALLBACK_NAV
  const navItems: NavEntry[] = [{ label: dict.header.navNews, slug: '', href: '/articulos' }, ...categoryItems]
  const desktopItems: NavEntry[] = [...navItems, { label: dict.header.navAuthor, slug: '__autor', href: '/autor' }]
  const mobileItems: NavEntry[] = [
    ...desktopItems,
    { label: dict.header.navPivotPoints, slug: '__pivots', href: '/pivot-points' },
    { label: dict.header.navCalendar, slug: '__calendar', href: '/calendario', icon: 'calendar_month' },
    { label: dict.header.navTools, slug: '__tools', href: '/herramientas' },
    { label: dict.header.navLearn, slug: '__learn', href: '/aprende' },
    { label: dict.header.navMarkets, slug: '__markets', href: '/markets' },
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

  // Escape closes the mobile menu, consistent with other disclosure widgets (WCAG 2.1.2)
  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return (
    <header
      ref={headerRef}
      data-site-header
      className="fixed top-0 left-0 w-full z-50 flex flex-col border-b border-outline-variant/40 bg-surface-translucent backdrop-blur-md"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-full focus:bg-accent-blue focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {dict.common.skipToContent}
      </a>
      <LiveTicker initialQuotes={initialTicker?.quotes} initialUpdatedAt={initialTicker?.updatedAt} />

      <div data-intro-row="nav" className="section-container w-full">
        {/* Row A — identity and the one action every visitor might take (search, go VIP). Fixed height,
            fixed set of elements: this row can never gain content, so it can never overflow. */}
        <nav className="h-16 flex items-center justify-between gap-4" aria-label={dict.header.mainNavAria}>
          <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label={dict.header.logoAria}>
            <Image src="/logo.png" alt="" width={36} height={36} className="size-9 object-contain" priority />
            <span className="flex items-baseline gap-1.5">
              <span className="hidden text-[17px] font-semibold tracking-tight text-ink sm:inline">Grizzly Traders</span>
              <span className="bg-brand-amber text-canvas text-[9px] font-bold tracking-[0.18em] px-1.5 py-[3px] rounded uppercase leading-none">
                Terminal
              </span>
            </span>
          </Link>

          <div className="hidden flex-1 justify-center px-4 sm:flex">
            <form
              onSubmit={submitSearch}
              className="flex w-full max-w-[360px] items-center gap-2 rounded-full border border-hairline bg-white/[0.04] px-4 py-2 focus-within:border-accent-blue transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] shrink-0 text-ink-muted" aria-hidden="true">
                search
              </span>
              <input
                ref={searchInputRef}
                type="search"
                aria-label={dict.header.searchAriaLabel}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={dict.header.searchPlaceholder}
                className="min-w-0 flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-ink-subtle"
              />
              <kbd className="hidden lg:inline-flex shrink-0 items-center gap-0.5 rounded-md border border-hairline bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-muted" aria-hidden="true">
                ⌘K
              </kbd>
            </form>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(!searchOpen)}
              className="sm:hidden flex size-9 items-center justify-center rounded-full border border-hairline bg-white/[0.04] text-ink-muted hover:text-ink hover:border-accent-blue transition-colors"
              aria-label={dict.header.searchButtonAria}
              aria-expanded={searchOpen}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                search
              </span>
            </button>

            <Button variant="accent" size="sm" className="hidden sm:inline-flex" asChild>
              <Link href="/#vip">{dict.header.vipCta}</Link>
            </Button>

            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden flex size-9 items-center justify-center rounded-full border border-hairline bg-white/[0.04] text-ink-muted hover:text-ink hover:border-accent-blue transition-colors"
              aria-label={menuOpen ? dict.header.closeMenu : dict.header.openMenu}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                {menuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </nav>

        {/* Row B — where to go. Two zones only: links scroll if they ever run out of room, tools never shrink.
            They can share a row without colliding because only one of the two is allowed to give way. */}
        <nav className="hidden h-10 items-center justify-between gap-4 border-t border-hairline-soft md:flex" aria-label={dict.header.categoriesNavAria}>
          <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max items-center gap-6">
              <ActiveNavLinks items={desktopItems} variant="desktop" />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 pl-4">
            <ToolIcon href="/pivot-points" icon="functions" label={dict.header.navPivotPoints} active={pathname === '/pivot-points'} />
            <ToolIcon href="/calendario" icon="calendar_month" label={dict.header.navCalendar} active={pathname === '/calendario'} />
            <ToolIcon href="/markets" icon="candlestick_chart" label={dict.header.navMarkets} active={isTerminal} />

            <span className="mx-1.5 h-5 w-px bg-hairline" aria-hidden="true" />

            <LocaleSwitcher className="mr-0.5" />

            <Button variant="ghost" size="sm" className="hidden gap-2 xl:inline-flex" asChild>
              <Link href="/#vip" aria-label={dict.header.communityAria}>
                <span className="material-symbols-outlined text-[16px] text-accent-blue" aria-hidden="true">
                  send
                </span>
                <span>{dict.header.telegramDiscord}</span>
              </Link>
            </Button>

            {/* Admin-only, so it stays quiet at rest instead of matching the weight of public controls */}
            <Link
              href="/cms"
              prefetch={false}
              className="flex size-8 items-center justify-center rounded-full text-ink-subtle hover:bg-white/[0.06] hover:text-ink transition-colors"
              aria-label={dict.header.adminPanel}
              title={dict.header.adminPanel}
            >
              <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                edit_note
              </span>
            </Link>
          </div>
        </nav>
      </div>

      {menuOpen && (
        <nav id="mobile-menu" aria-label={dict.header.categoriesNavAria} className="md:hidden border-t border-outline-variant/40 px-6 py-3">
          <ActiveNavLinks items={mobileItems} variant="mobile" onNavigate={() => setMenuOpen(false)} />
          <div className="mt-3 pt-3 border-t border-hairline-soft">
            <LocaleSwitcher />
          </div>
        </nav>
      )}

      {searchOpen && (
        <form onSubmit={submitSearch} className="sm:hidden px-4 pb-3">
          <input
            type="search"
            aria-label={dict.header.searchAriaLabel}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={dict.header.searchPlaceholder}
            className="w-full rounded-full border border-hairline bg-white/[0.04] px-4 py-2 text-sm text-ink placeholder:text-ink-subtle outline-none focus:border-accent-blue"
            autoFocus
          />
        </form>
      )}
    </header>
  )
}
