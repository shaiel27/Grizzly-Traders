import { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/ui'
import { getServerLocale } from '@/lib/i18n/server'
import { getDictionary, t } from '@/lib/i18n/get-dictionary'

// status: BORRADOR — requiere revisión legal externa antes de publicar.
// Jurisdicción: Estados Unidos. Responsable: Grizzly Traders.
// Contacto placeholder {{CONTACTO_LEGAL}} pendiente de definir — no reemplazar por un email real sin confirmación.
export const metadata: Metadata = {
  title: 'Política de Cookies',
  description: 'Qué cookies usa Grizzly Traders, para qué sirve cada una y cómo puedes gestionarlas.',
  robots: { index: true, follow: true },
}

export default async function CookiePolicyPage() {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const isEnglish = locale === 'en'
  const updatedDate = isEnglish ? 'October 2, 2026' : '2 de octubre de 2026'

  return (
    <>
      <Breadcrumbs
        items={[
          { label: dict.legal.breadcrumbHome, href: '/' },
          { label: dict.legal.breadcrumbLegal },
          { label: dict.legal.cookiesTitle },
        ]}
      />

      <h1 className="font-serif text-display-lg-mobile sm:text-display-lg font-bold text-ink mb-2">
        {dict.legal.cookiesTitle}
      </h1>
      <p className="text-body-sm text-ink-muted mb-8">{t(dict.legal.lastUpdated, { date: updatedDate })}</p>

      {isEnglish && (
        <p className="mb-8 rounded-lg border border-hairline-soft bg-surface-2/60 px-4 py-3 text-body-sm text-ink-muted">
          {dict.legal.englishNotice}
        </p>
      )}

      <div className="prose prose-lg max-w-none font-serif prose-headings:font-sans prose-headings:font-bold prose-headings:tracking-tight prose-p:leading-[1.8] prose-li:leading-[1.8] prose-a:font-medium prose-a:text-accent-blue prose-a:no-underline hover:prose-a:underline">
        <h2>1. ¿Qué son las cookies?</h2>
        <p>
          Las cookies son pequeños archivos de texto que un sitio web guarda en tu navegador para recordar
          información entre visitas o durante tu sesión.
        </p>

        <h2>2. Cookies que utilizamos actualmente</h2>
        <ul>
          <li>
            <strong>
              <code>gt_locale</code>
            </strong>{' '}
            — Preferencia de idioma (español/inglés) que elegiste con el selector ES/EN del sitio. Cookie
            estrictamente funcional; no se usa con fines de seguimiento ni publicidad. Duración: 1 año. Se gestiona
            desde el propio navegador, en el que se guarda como texto plano accesible por el sitio.
          </li>
          <li>
            <strong>
              <code>sb-*</code>
            </strong>{' '}
            (cookies de sesión de Supabase Auth) — Se establecen exclusivamente cuando un autor o editor inicia
            sesión en el panel de administración (<code>/cms</code>). Son estrictamente necesarias para el
            funcionamiento seguro del panel y no se crean para visitantes públicos que no inician sesión. Se
            configuran con los atributos <code>httpOnly</code> y <code>secure</code> (en producción) para reducir el
            riesgo de acceso indebido desde JavaScript de terceros.
          </li>
        </ul>

        <h2>3. Lo que no usamos (por ahora)</h2>
        <p>
          Actualmente el Sitio <strong>no utiliza cookies de analítica, publicidad ni de terceros con fines de
          seguimiento</strong> (por ejemplo, Google Analytics, píxeles publicitarios o cookies de redes sociales
          embebidas). Si esto cambia en el futuro, actualizaremos esta política e indicaremos la fecha del cambio
          antes de activarlas.
        </p>

        <h2>4. Cómo gestionar las cookies</h2>
        <p>
          Puedes permitir, bloquear o eliminar las cookies desde la configuración de tu navegador. Ten en cuenta
          que:
        </p>
        <ul>
          <li>
            Bloquear la cookie <code>gt_locale</code> hará que el Sitio no recuerde tu idioma preferido entre
            visitas (volverá al idioma predeterminado en cada sesión).
          </li>
          <li>
            Bloquear las cookies <code>sb-*</code> impedirá iniciar sesión en el panel de administración; no afecta
            la navegación pública del Sitio.
          </li>
        </ul>

        <h2>5. Más información sobre privacidad</h2>
        <p>
          Para más detalle sobre qué datos recopilamos y tus derechos, consulta nuestra{' '}
          <Link href="/legal/privacidad">Política de Privacidad</Link>.
        </p>

        <h2>6. Cambios a esta política</h2>
        <p>
          Actualizaremos esta página si cambiamos las cookies que utilizamos. Consulta la fecha de &quot;última
          actualización&quot; al inicio de esta página.
        </p>

        <h2>7. Contacto</h2>
        <p>
          Si tienes preguntas sobre el uso de cookies en este Sitio, escríbenos a{' '}
          <strong>{'{{CONTACTO_LEGAL}}'}</strong>.
        </p>
      </div>

      <p className="mt-12 border-t border-hairline-soft pt-4 text-micro text-ink-subtle">{dict.legal.draftNotice}</p>
    </>
  )
}
