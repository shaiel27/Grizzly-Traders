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
// Jurisdicción: Estados Unidos — estado de Florida. Responsable: Grizzly Traders. Derechos CCPA/CPRA aplicables a residentes de California.
// Contacto legal: grizzlytraders@gmail.com (confirmado por el usuario 2026-10-12).
export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description:
    'Cómo Grizzly Traders recopila, usa y protege tus datos personales, y tus derechos bajo la CCPA/CPRA de California.',
  robots: { index: true, follow: true },
}

const TOC: TocItem[] = [
  { id: 'responsable', label: 'Responsable y alcance' },
  { id: 'datos', label: 'Datos que recopilamos' },
  { id: 'usos', label: 'Para qué usamos tus datos' },
  { id: 'compartimos', label: 'Con quién compartimos datos' },
  { id: 'retencion', label: 'Retención de datos' },
  { id: 'derechos', label: 'Tus derechos bajo la CCPA/CPRA' },
  { id: 'menores', label: 'Menores de edad' },
  { id: 'seguridad', label: 'Seguridad' },
  { id: 'cookies', label: 'Cookies' },
  { id: 'cambios', label: 'Cambios a esta política' },
  { id: 'contacto', label: 'Contacto' },
]

export default async function PrivacyPolicyPage() {
  const locale = await getRouteLocale()
  const dict = getDictionary(locale)
  const isEnglish = locale === 'en'
  const updatedDate = isEnglish ? 'October 2, 2026' : '2 de octubre de 2026'

  return (
    <>
      <Breadcrumbs
        items={[
          { label: dict.legal.breadcrumbHome, href: '/' },
          { label: dict.legal.breadcrumbLegal },
          { label: dict.legal.privacyTitle },
        ]}
      />

      <header className="mb-8">
        <h1 className="font-serif text-display-lg-mobile sm:text-display-lg font-bold tracking-[-0.03em] text-ink mb-3">
          {dict.legal.privacyTitle}
        </h1>
        <p className="text-body-sm text-ink-muted">{t(dict.legal.lastUpdated, { date: updatedDate })}</p>
      </header>

      {isEnglish && <LegalEnglishNotice text={dict.legal.englishNotice} />}

      <LegalToc title={dict.legal.tocTitle} items={TOC} />

      <div className={legalProseClass}>
        <h2 id="responsable">1. Responsable y alcance</h2>
        <p>
          Este sitio web (el &quot;Sitio&quot;) es operado por <strong>Grizzly Traders</strong> (&quot;nosotros&quot;,
          &quot;nuestro&quot;), con domicilio en el estado de Florida, Estados Unidos. Esta Política de Privacidad
          describe qué datos personales recopilamos de los
          visitantes y usuarios del Sitio, cómo los usamos, con quién los compartimos y qué derechos tienes sobre
          ellos, con especial atención a los derechos reconocidos por la California Consumer Privacy Act (CCPA) y la
          California Privacy Rights Act (CPRA) para residentes de California.
        </p>
        <p>
          Si tienes preguntas sobre esta política o quieres ejercer alguno de tus derechos, puedes escribirnos a{' '}
          <strong>grizzlytraders@gmail.com</strong>.
        </p>

        <h2 id="datos">2. Datos que recopilamos</h2>
        <ul>
          <li>
            <strong>Datos de suscripción al newsletter:</strong> la dirección de correo electrónico y el idioma que
            proporcionas voluntariamente al suscribirte desde el pie de página del Sitio. Para poder demostrar tu
            consentimiento también registramos la fecha, el texto de la casilla que aceptaste, la página desde la que te
            suscribiste y una versión cifrada (hash) de tu dirección IP, que no permite recuperar la IP original. La
            suscripción solo se activa cuando confirmas tu correo con un enlace que te enviamos (doble confirmación);
            si no confirmas, no recibirás el boletín.
          </li>
          <li>
            <strong>Datos de cuenta del panel de administración (CMS):</strong> si eres autor o editor con acceso al
            panel, recopilamos tu correo electrónico y las credenciales de autenticación gestionadas por nuestro
            proveedor de infraestructura (Supabase).
          </li>
          <li>
            <strong>Cookies técnicas:</strong> una cookie de preferencia de idioma (<code>gt_locale</code>) y, solo si
            inicias sesión en el panel de administración, cookies de sesión de autenticación (<code>sb-*</code>). Más
            detalle en nuestra <Link href="/legal/cookies">Política de Cookies</Link>.
          </li>
          <li>
            <strong>Datos técnicos y de registro:</strong> dirección IP, tipo de navegador y marcas de tiempo,
            registrados automáticamente por la infraestructura del Sitio (Supabase) con fines de seguridad y
            diagnóstico.
          </li>
        </ul>
        <p>
          No recopilamos categorías especiales de datos personales (salud, origen étnico, afiliación sindical, etc.)
          ni solicitamos información financiera o de pago a través del Sitio.
        </p>

        <h2 id="usos">3. Para qué usamos tus datos</h2>
        <ul>
          <li>Enviar el boletín de noticias y análisis de mercado al que te suscribes voluntariamente.</li>
          <li>
            Operar y proteger el Sitio (prevención de abuso, diagnóstico de errores, seguridad de la cuenta del CMS).
          </li>
          <li>Cumplir obligaciones legales cuando corresponda.</li>
        </ul>
        <p>
          No utilizamos tus datos personales para publicidad dirigida ni elaboramos perfiles automatizados con
          efectos legales sobre ti.
        </p>

        <h2 id="compartimos">4. Con quién compartimos datos</h2>
        <p>
          Trabajamos con los siguientes encargados de tratamiento (&quot;proveedores de servicios&quot; bajo la
          CCPA), que procesan datos en nuestro nombre y bajo nuestras instrucciones:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — base de datos, autenticación y almacenamiento de archivos.
          </li>
          <li>
            <strong>Resend</strong> — envío de los correos del newsletter (confirmación de la suscripción y resumen
            diario). Recibe tu correo electrónico y tu idioma una vez confirmada tu suscripción.
          </li>
          <li>
            <strong>n8n Cloud</strong> — automatización del flujo editorial (ingesta y publicación de contenido); no
            procesa datos personales de suscriptores del newsletter.
          </li>
          <li>
            <strong>OpenAI</strong> (a través de n8n) — generación asistida de contenido editorial; no recibe datos
            personales de visitantes ni de suscriptores.
          </li>
          <li>
            <strong>Proveedores de datos de mercado</strong> (cotizaciones y niveles técnicos) — no reciben datos
            personales de usuarios; su integración es unidireccional (datos de mercado hacia el Sitio).
          </li>
        </ul>
        <p>
          <strong>
            No vendemos ni &quot;compartimos&quot; (en el sentido de la CPRA, incluida publicidad conductual entre
            contextos) tus datos personales a terceros
          </strong>{' '}
          y no lo hemos hecho en los últimos 12 meses.
        </p>

        <h2 id="retencion">5. Retención de datos</h2>
        <p>
          Conservamos tu correo electrónico de suscripción mientras mantengas tu suscripción activa; puedes darte de
          baja en cualquier momento desde el enlace de baja de cada correo, desde la página{' '}
          <Link href="/newsletter/baja">Darte de baja</Link> o escribiéndonos a grizzlytraders@gmail.com. Los registros técnicos (logs) se conservan durante un periodo limitado con fines de
          seguridad y luego se eliminan o anonimizan conforme a la configuración estándar de nuestro proveedor de
          infraestructura.
        </p>

        <h2 id="derechos">6. Tus derechos bajo la CCPA/CPRA</h2>
        <p>Si eres residente de California, tienes derecho a:</p>
        <ul>
          <li>
            <strong>Saber</strong> qué datos personales recopilamos, usamos, divulgamos y (en su caso) vendemos o
            compartimos sobre ti.
          </li>
          <li>
            <strong>Acceder</strong> a una copia de tus datos personales.
          </li>
          <li>
            <strong>Eliminar</strong> tus datos personales, sujeto a ciertas excepciones legales.
          </li>
          <li>
            <strong>Corregir</strong> datos personales inexactos.
          </li>
          <li>
            <strong>Optar por no vender ni compartir</strong> tus datos personales — práctica que, como se indica
            arriba, no realizamos.
          </li>
          <li>
            <strong>No sufrir discriminación</strong> por ejercer cualquiera de estos derechos.
          </li>
        </ul>
        <p>
          Para ejercer cualquiera de estos derechos, contáctanos en <strong>grizzlytraders@gmail.com</strong>. Podremos
          solicitarte información razonable para verificar tu identidad antes de dar curso a la solicitud.
        </p>

        <h2 id="menores">7. Menores de edad</h2>
        <p>
          El Sitio no está dirigido a menores de 13 años y no recopilamos intencionalmente datos personales de
          menores de 13 años. Si crees que un menor nos ha proporcionado datos personales, contáctanos para
          eliminarlos.
        </p>

        <h2 id="seguridad">8. Seguridad</h2>
        <p>
          Aplicamos medidas técnicas y organizativas razonables (cifrado en tránsito, cookies de sesión con atributos{' '}
          <code>httpOnly</code>/<code>secure</code>, control de acceso al panel de administración) para proteger tus
          datos. Ningún sistema es 100% seguro, por lo que no podemos garantizar seguridad absoluta.
        </p>

        <h2 id="cookies">9. Cookies</h2>
        <p>
          El Sitio usa cookies técnicas estrictamente necesarias. El detalle de cada cookie, su propósito y cómo
          gestionarlas está en nuestra <Link href="/legal/cookies">Política de Cookies</Link>.
        </p>

        <h2 id="cambios">10. Cambios a esta política</h2>
        <p>
          Podemos actualizar esta Política de Privacidad periódicamente. Publicaremos cualquier cambio en esta misma
          página indicando la fecha de última actualización.
        </p>

        <h2 id="contacto">11. Contacto</h2>
        <p>
          Para cualquier consulta sobre esta política o el tratamiento de tus datos personales, escríbenos a{' '}
          <strong>grizzlytraders@gmail.com</strong>.
        </p>
      </div>

      <LegalCrossNav current="privacy" dict={dict} />
      <LegalDraftNotice text={dict.legal.draftNotice} />
    </>
  )
}
