import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/get-dictionary'

// Bloques compartidos de las tres páginas legales (privacidad, términos, cookies).
// Cada página pinta su propio breadcrumb/h1 y envuelve el cuerpo en `legalProseClass`;
// esto centraliza TOC, avisos y navegación cruzada para que las tres se vean igual.

// Clases del bloque `.prose`: `legal-body` (globals.css) mapea la paleta oscura al plugin de
// tipografía — sin esa clase los colores por defecto del plugin son de tema claro y el texto
// queda ilegible sobre el canvas #090909.
export const legalProseClass =
  'legal-body prose prose-lg max-w-[70ch] font-serif prose-headings:font-serif prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-balance prose-p:leading-[1.8] prose-li:leading-[1.8] prose-a:font-medium prose-a:text-accent-blue prose-a:no-underline hover:prose-a:underline'

export interface TocItem {
  id: string
  label: string
}

export function LegalToc({ title, items }: { title: string; items: TocItem[] }) {
  return (
    <nav aria-label={title} className="mb-10 rounded-xl border border-hairline-soft bg-surface-1/60 px-5 py-4">
      <p className="mb-3 text-micro font-semibold text-ink-subtle">{title}</p>
      <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {items.map((item, index) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="group -mx-1 flex items-baseline gap-2.5 rounded px-1 py-0.5 text-body-sm text-ink-muted transition-colors hover:text-ink"
            >
              <span className="w-4 shrink-0 text-right font-medium tabular-nums text-ink-subtle transition-colors group-hover:text-accent-blue">
                {index + 1}
              </span>
              <span className="transition-colors group-hover:text-accent-blue">{item.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

// Aviso de versión en inglés (solo se pinta con locale=en): callout informativo en accent-blue.
export function LegalEnglishNotice({ text }: { text: string }) {
  return (
    <p className="mb-8 rounded-xl border border-accent-blue/30 bg-accent-blue/10 px-4 py-3 text-body-sm leading-relaxed text-on-surface-variant">
      {text}
    </p>
  )
}

// Aviso de borrador al pie: tono de advertencia (semantic-warning) para comunicar "sin revisión final".
export function LegalDraftNotice({ text }: { text: string }) {
  return (
    <p className="mt-10 rounded-xl border border-semantic-warning/30 bg-semantic-warning/10 px-4 py-3 text-body-sm leading-relaxed text-ink-muted">
      {text}
    </p>
  )
}

type DocId = 'privacy' | 'terms' | 'cookies'

const DOCS: Record<DocId, { href: string; label: (d: Dictionary) => string; desc: (d: Dictionary) => string }> = {
  privacy: {
    href: '/legal/privacidad',
    label: (d) => d.footer.navPrivacy,
    desc: (d) => d.legal.privacyDescription,
  },
  terms: {
    href: '/legal/terminos',
    label: (d) => d.footer.navTerms,
    desc: (d) => d.legal.termsDescription,
  },
  cookies: {
    href: '/legal/cookies',
    label: (d) => d.footer.navCookies,
    desc: (d) => d.legal.cookiesDescription,
  },
}

// Navegación a los otros dos documentos legales, con la descripción corta del diccionario.
export function LegalCrossNav({ current, dict }: { current: DocId; dict: Dictionary }) {
  const siblings = (Object.keys(DOCS) as DocId[]).filter((id) => id !== current)
  return (
    <nav aria-label={dict.footer.legalAria} className="mt-12 grid gap-3 sm:grid-cols-2">
      {siblings.map((id) => {
        const doc = DOCS[id]
        return (
          <Link
            key={id}
            href={doc.href}
            className="group rounded-xl border border-hairline-soft bg-surface-1/60 p-4 transition-colors hover:border-hairline hover:bg-surface-1"
          >
            <span className="block text-micro text-ink-subtle">{dict.legal.sectionLabel}</span>
            <span className="mt-1 flex items-center justify-between gap-2 text-body font-semibold text-ink transition-colors group-hover:text-accent-blue">
              {doc.label(dict)}
              <span
                className="material-symbols-outlined text-[16px] text-ink-subtle transition-colors group-hover:text-accent-blue"
                aria-hidden="true"
              >
                chevron_right
              </span>
            </span>
            <span className="mt-1 block text-body-sm leading-snug text-ink-muted">{doc.desc(dict)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
