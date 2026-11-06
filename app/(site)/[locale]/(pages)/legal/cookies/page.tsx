import { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/ui'
import { getRouteLocale } from '@/lib/i18n/route-locale'
import { getDictionary, t } from '@/lib/i18n/get-dictionary'
import {
  legalProseClass,
  LegalToc,
  LegalEnglishNotice,
  LegalDraftNotice,
  LegalCrossNav,
} from '../shared'
import type { TocItem } from '../shared'

// status: BORRADOR — requiere revisión legal externa antes de publicar.
// Jurisdicción: Estados Unidos — estado de Florida. Responsable: Grizzly Traders.
// Contacto legal: grizzlytraders@gmail.com (confirmado por el usuario 2026-10-12).
export const metadata: Metadata = {
  title: 'Política de Cookies',
  description: 'Qué cookies usa Grizzly Traders, para qué sirve cada una y cómo puedes gestionarlas.',
  robots: { index: true, follow: true },
}

const TOC: TocItem[] = [
  { id: 'que-son', label: '¿Qué son las cookies?' },
  { id: 'utilizamos', label: 'Cookies que utilizamos actualmente' },
  { id: 'no-usamos', label: 'Analítica y lo que no usamos' },
  { id: 'gestionar', label: 'Cómo gestionar las cookies' },
  { id: 'privacidad', label: 'Más información sobre privacidad' },
  { id: 'cambios', label: 'Cambios a esta política' },
  { id: 'contacto', label: 'Contacto' },
]

export default async function CookiePolicyPage() {
  const locale = await getRouteLocale()
  const dict = getDictionary(locale)
  const isEnglish = locale === 'en'
  const updatedDate = isEnglish ? 'November 6, 2026' : '6 de noviembre de 2026'

  return (
    <>
      <Breadcrumbs
        items={[
          { label: dict.legal.breadcrumbHome, href: '/' },
          { label: dict.legal.breadcrumbLegal },
          { label: dict.legal.cookiesTitle },
        ]}
      />

      <header className="mb-8">
        <h1 className="font-serif text-display-lg-mobile sm:text-display-lg font-bold tracking-[-0.03em] text-ink mb-3">
          {dict.legal.cookiesTitle}
        </h1>
        <p className="text-body-sm text-ink-muted">{t(dict.legal.lastUpdated, { date: updatedDate })}</p>
      </header>

      {isEnglish && <LegalEnglishNotice text={dict.legal.englishNotice} />}

      <LegalToc title={dict.legal.tocTitle} items={TOC} />

      <div className={legalProseClass}>
        <h2 id="que-son">1. ¿Qué son las cookies?</h2>
        <p>
          Las cookies son pequeños archivos de texto que un sitio web guarda en tu navegador para recordar
          información entre visitas o durante tu sesión.
        </p>

        <h2 id="utilizamos">2. Cookies que utilizamos actualmente</h2>
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
          <li>
            <strong>
              <code>_ga</code>
            </strong>{' '}
            y{' '}
            <strong>
              <code>_ga_*</code>
            </strong>{' '}
            (Google Analytics 4) — Se crean <strong>solo si aceptas</strong> las cookies de analítica en el aviso del
            Sitio. Distinguen visitas para medir cuántas personas visitan el Sitio y qué páginas leen. Las establece
            Google LLC. Duración: hasta 2 años. Si rechazas, no se crean; si las aceptas y luego cambias de decisión,
            las borramos.
          </li>
        </ul>

        <h2 id="no-usamos">3. Analítica y lo que no usamos</h2>
        <p>
          El Sitio usa <strong>Google Analytics 4</strong> (Google LLC) para medir de forma agregada cuántas personas lo
          visitan y qué páginas leen. <strong>Solo se activa si aceptas</strong> en el aviso de cookies: hasta
          entonces no se carga nada de Google ni se guarda ninguna cookie suya. Si rechazas, o si tu navegador envía la
          señal <em>Global Privacy Control</em>, no se activa. Puedes cambiar tu decisión en cualquier momento con el
          enlace «Preferencias de cookies» del pie de página, que además borra las cookies de Google Analytics.
        </p>
        <p>
          Tenemos desactivadas las señales de Google y la personalización de anuncios.{' '}
          <strong>No utilizamos cookies de publicidad ni de seguimiento de redes sociales</strong>. Si esto cambia en el
          futuro, actualizaremos esta política e indicaremos la fecha del cambio antes de activarlas.
        </p>

        <h2 id="gestionar">4. Cómo gestionar las cookies</h2>
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

        <h2 id="privacidad">5. Más información sobre privacidad</h2>
        <p>
          Para más detalle sobre qué datos recopilamos y tus derechos, consulta nuestra{' '}
          <Link href="/legal/privacidad">Política de Privacidad</Link>.
        </p>

        <h2 id="cambios">6. Cambios a esta política</h2>
        <p>
          Actualizaremos esta página si cambiamos las cookies que utilizamos. Consulta la fecha de &quot;última
          actualización&quot; al inicio de esta página.
        </p>

        <h2 id="contacto">7. Contacto</h2>
        <p>
          Si tienes preguntas sobre el uso de cookies en este Sitio, escríbenos a{' '}
          <strong>grizzlytraders@gmail.com</strong>.
        </p>
      </div>

      <LegalCrossNav current="cookies" dict={dict} />
      <LegalDraftNotice text={dict.legal.draftNotice} />
    </>
  )
}
