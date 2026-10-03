import Link from 'next/link'
import Image from 'next/image'
import { NewsletterForm } from './NewsletterForm'
import { LocaleSwitcher } from './LocaleSwitcher'
import { getDictionary, t, type Dictionary, type Locale } from '@/lib/i18n/get-dictionary'

interface CategoryData {
  id: number
  name: string
  slug: string
}

const CATEGORY_LABELS: Record<string, string> = {
  criptomonedas: 'Crypto',
  forex: 'Forex',
  'materias-primas': 'Commodities',
  acciones: 'Equities',
}

const FALLBACK_LINKS = [
  { label: 'Forex', href: '/articulos?categoria=forex' },
  { label: 'Crypto', href: '/articulos?categoria=criptomonedas' },
  { label: 'Commodities', href: '/articulos?categoria=materias-primas' },
  { label: 'Equities', href: '/articulos?categoria=acciones' },
]

interface FooterProps {
  categories?: CategoryData[]
  // Footer has no 'use client' directive (no hooks), so — unlike Header — it can't read LocaleContext
  // itself; app/(site)/layout.tsx resolves these server-side and passes them down as props.
  locale?: Locale
  dictionary?: Dictionary
}

export function Footer({ categories = [], locale = 'es', dictionary }: FooterProps) {
  const dict = dictionary ?? getDictionary(locale)
  const navLinks = categories.length > 0
    ? categories.map((cat) => ({
        label: CATEGORY_LABELS[cat.slug] ?? cat.name,
        href: `/articulos?categoria=${cat.slug}`,
      }))
    : FALLBACK_LINKS

  return (
    <footer className="border-t border-hairline-soft bg-surface-container-lowest">
      <div className="border-b border-hairline-soft">
        <div className="section-container relative flex flex-col items-start justify-between gap-6 py-8 md:flex-row md:items-center">
          <div>
            <p className="text-body font-bold text-ink">{dict.footer.newsletterTitle}</p>
            <p className="mt-1 text-body-sm text-ink-muted">{dict.footer.newsletterSubtitle}</p>
          </div>
          <NewsletterForm />
        </div>
      </div>
      <div className="section-container flex flex-col items-start justify-between gap-6 py-10 md:flex-row md:items-center">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt=""
            width={28}
            height={28}
            className="size-7 object-contain"
          />
          <span className="bg-brand-amber text-canvas text-[9px] font-bold tracking-[0.18em] px-1.5 py-[3px] rounded uppercase leading-none">
            Terminal
          </span>
          <span className="ml-2 text-[11px] text-ink-subtle">
            {t(dict.footer.copyright, { year: new Date().getFullYear() })}
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-6" aria-label={dict.footer.navAria}>
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-body-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/autor"
            className="text-body-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            {dict.footer.navAuthor}
          </Link>
          <Link
            href="/markets"
            className="text-body-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            {dict.footer.navMarkets}
          </Link>
          <Link
            href="/herramientas"
            className="text-body-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            {dict.footer.navTools}
          </Link>
          <Link
            href="/aprende"
            className="text-body-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            {dict.footer.navLearn}
          </Link>
          <a href="/feed.xml" className="text-body-sm font-medium text-ink-muted transition-colors hover:text-ink">
            {dict.footer.rss}
          </a>
          <LocaleSwitcher />
        </nav>
      </div>
      <div className="border-t border-hairline-soft">
        <div className="section-container flex flex-col items-start justify-between gap-4 py-6 sm:flex-row sm:items-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">{dict.legal.sectionLabel}</p>
          <nav className="flex flex-wrap items-center gap-6" aria-label={dict.footer.legalAria}>
            <Link href="/legal/privacidad" className="text-body-sm font-medium text-ink-muted transition-colors hover:text-ink">
              {dict.footer.navPrivacy}
            </Link>
            <Link href="/legal/terminos" className="text-body-sm font-medium text-ink-muted transition-colors hover:text-ink">
              {dict.footer.navTerms}
            </Link>
            <Link href="/legal/cookies" className="text-body-sm font-medium text-ink-muted transition-colors hover:text-ink">
              {dict.footer.navCookies}
            </Link>
          </nav>
        </div>
      </div>
      <div className="border-t border-hairline-soft">
        <p className="section-container py-4 text-[11px] leading-relaxed text-ink-muted">
          {dict.footer.riskNotice}
        </p>
      </div>
    </footer>
  )
}
