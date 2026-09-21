import Link from 'next/link'
import Image from 'next/image'
import { NewsletterForm } from './NewsletterForm'

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
}

export function Footer({ categories = [] }: FooterProps) {
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
            <p className="text-body font-bold text-ink">Mantente al día con los mercados</p>
            <p className="mt-1 text-body-sm text-ink-muted">Análisis y noticias financieras directamente en tu bandeja de entrada.</p>
          </div>
          <NewsletterForm />
        </div>
      </div>
      <div className="section-container flex flex-col items-start justify-between gap-6 py-10 md:flex-row md:items-center">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Grizzly Traders Logo"
            width={28}
            height={28}
            className="size-7 object-contain"
          />
          <span className="bg-[#f7b955] text-[#0b0b0c] text-[9px] font-bold tracking-[0.18em] px-1.5 py-[3px] rounded-[4px] uppercase leading-none">
            Terminal
          </span>
          <span className="ml-2 text-[11px] text-ink-subtle">
            © {new Date().getFullYear()} Grizzly Traders. Todos los derechos reservados.
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-6" aria-label="Navegación de pie de página">
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
            Autor
          </Link>
          <Link
            href="/markets"
            className="text-body-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Terminal
          </Link>
          <Link
            href="/herramientas"
            className="text-body-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Herramientas
          </Link>
          <Link
            href="/aprende"
            className="text-body-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Glosario
          </Link>
          <a href="/feed.xml" className="text-body-sm font-medium text-ink-muted transition-colors hover:text-ink">
            RSS
          </a>
        </nav>
      </div>
      <div className="border-t border-hairline-soft">
        <p className="section-container py-4 text-[11px] leading-relaxed text-ink-muted">
          Aviso de riesgo: el contenido de este sitio es informativo y no constituye asesoramiento financiero ni una
          recomendación de compra o venta. Operar con criptomonedas, forex, materias primas y acciones conlleva un alto
          riesgo de pérdida de capital. Las cotizaciones provienen de proveedores externos, pueden tener retraso y no se
          garantiza su exactitud.
        </p>
      </div>
    </footer>
  )
}
