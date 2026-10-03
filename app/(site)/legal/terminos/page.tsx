import { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/ui'
import { getServerLocale } from '@/lib/i18n/server'
import { getDictionary, t } from '@/lib/i18n/get-dictionary'

// status: BORRADOR — requiere revisión legal externa antes de publicar.
// Jurisdicción: Estados Unidos. Responsable: Grizzly Traders.
// Placeholders {{CONTACTO_LEGAL}} y {{ESTADO_PENDIENTE}} pendientes de definir — no inventar valores.
export const metadata: Metadata = {
  title: 'Términos de Servicio',
  description:
    'Condiciones de uso del sitio Grizzly Traders, incluido el descargo de responsabilidad sobre el contenido financiero.',
  robots: { index: true, follow: true },
}

export default async function TermsOfServicePage() {
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
          { label: dict.legal.termsTitle },
        ]}
      />

      <h1 className="font-serif text-display-lg-mobile sm:text-display-lg font-bold text-ink mb-2">
        {dict.legal.termsTitle}
      </h1>
      <p className="text-body-sm text-ink-muted mb-8">{t(dict.legal.lastUpdated, { date: updatedDate })}</p>

      {isEnglish && (
        <p className="mb-8 rounded-lg border border-hairline-soft bg-surface-2/60 px-4 py-3 text-body-sm text-ink-muted">
          {dict.legal.englishNotice}
        </p>
      )}

      <div className="prose prose-lg max-w-none font-serif prose-headings:font-sans prose-headings:font-bold prose-headings:tracking-tight prose-p:leading-[1.8] prose-li:leading-[1.8] prose-a:font-medium prose-a:text-accent-blue prose-a:no-underline hover:prose-a:underline">
        <h2>1. Aceptación de los términos</h2>
        <p>
          Al acceder o utilizar el sitio web de Grizzly Traders (el &quot;Sitio&quot;), aceptas quedar vinculado por
          estos Términos de Servicio (&quot;Términos&quot;). Si no estás de acuerdo, por favor no utilices el Sitio.
        </p>

        <h2>2. Descripción del servicio</h2>
        <p>
          El Sitio publica noticias, análisis de mercado, cotizaciones, niveles técnicos (pivot points) y
          herramientas informativas relacionadas con mercados financieros (criptomonedas, forex, materias primas y
          acciones).
        </p>

        <h2>3. El contenido no es asesoramiento de inversión</h2>
        <p>
          <strong>
            Todo el contenido publicado en el Sitio tiene fines exclusivamente informativos y educativos. Nada de lo
            publicado constituye asesoramiento de inversión, recomendación de compra o venta, ni una oferta o
            solicitud para realizar ninguna operación financiera.
          </strong>{' '}
          Grizzly Traders no es un asesor de inversiones registrado ni un corredor de bolsa.
        </p>
        <p>
          Operar con criptomonedas, forex, materias primas y acciones conlleva un alto riesgo de pérdida de capital,
          incluyendo la pérdida total del monto invertido. Las decisiones de inversión son responsabilidad exclusiva
          del usuario. Te recomendamos consultar con un asesor financiero cualificado antes de tomar cualquier
          decisión de inversión.
        </p>
        <p>
          Las cotizaciones, niveles técnicos y demás datos de mercado provienen de proveedores externos, pueden tener
          retraso respecto al mercado en tiempo real y no garantizamos su exactitud, integridad ni disponibilidad
          continua.
        </p>

        <h2>4. Uso aceptable</h2>
        <p>Al usar el Sitio, aceptas no:</p>
        <ul>
          <li>Usarlo con fines ilícitos.</li>
          <li>Intentar vulnerar su seguridad o acceder a áreas restringidas sin autorización.</li>
          <li>
            Usar medios automatizados para extraer contenido a gran escala (scraping) sin nuestro consentimiento
            previo por escrito.
          </li>
          <li>Reproducir o redistribuir nuestro contenido editorial con fines comerciales sin autorización.</li>
        </ul>

        <h2>5. Cuentas y panel de administración</h2>
        <p>
          El acceso al panel de administración (CMS) está restringido a autores y editores autorizados por Grizzly
          Traders. Eres responsable de mantener la confidencialidad de tus credenciales y de toda actividad
          realizada bajo tu cuenta.
        </p>

        <h2>6. Boletín informativo (newsletter)</h2>
        <p>
          Al suscribirte a nuestro boletín, aceptas recibir correos electrónicos periódicos con noticias y análisis
          de mercado. Puedes darte de baja en cualquier momento. El tratamiento de tu correo electrónico se describe
          en nuestra <Link href="/legal/privacidad">Política de Privacidad</Link>.
        </p>

        <h2>7. Propiedad intelectual</h2>
        <p>
          El Sitio, su marca, logotipo, diseño y el contenido editorial original (artículos, análisis, gráficos
          propios) son propiedad de Grizzly Traders o de sus licenciantes y están protegidos por leyes de propiedad
          intelectual de Estados Unidos y tratados internacionales. No se concede ninguna licencia para su uso
          comercial sin autorización expresa por escrito.
        </p>

        <h2>8. Enlaces y servicios de terceros</h2>
        <p>
          El Sitio puede incluir enlaces o widgets de terceros (por ejemplo, proveedores de datos de mercado, redes
          sociales, Telegram/Discord). No controlamos ni somos responsables del contenido ni de las prácticas de
          privacidad de esos terceros.
        </p>

        <h2>9. Limitación de responsabilidad</h2>
        <p>
          En la máxima medida permitida por la ley aplicable, Grizzly Traders, sus directores, empleados y
          colaboradores no serán responsables de ningún daño directo, indirecto, incidental, especial o consecuente
          derivado del uso o la imposibilidad de uso del Sitio, incluyendo pérdidas financieras derivadas de
          decisiones de inversión basadas en el contenido publicado. El Sitio se proporciona &quot;tal cual&quot; y
          &quot;según disponibilidad&quot;, sin garantías de ningún tipo, expresas o implícitas.
        </p>

        <h2>10. Indemnización</h2>
        <p>
          Aceptas indemnizar y mantener indemne a Grizzly Traders frente a cualquier reclamación, daño o gasto
          (incluidos honorarios legales razonables) derivado de tu uso indebido del Sitio o de tu incumplimiento de
          estos Términos.
        </p>

        <h2>11. Terminación</h2>
        <p>
          Podemos suspender o restringir el acceso al Sitio o a áreas específicas (como el panel de administración)
          en cualquier momento, sin previo aviso, en caso de incumplimiento de estos Términos.
        </p>

        <h2>12. Ley aplicable y jurisdicción</h2>
        <p>
          Estos Términos se rigen por las leyes de los Estados Unidos de América y del estado de{' '}
          <strong>{'{{ESTADO_PENDIENTE}}'}</strong> (pendiente de definir), sin tener en cuenta sus normas sobre
          conflicto de leyes. Cualquier disputa derivada de estos Términos estará sujeta a la jurisdicción exclusiva
          de los tribunales competentes de dicho estado.
        </p>

        <h2>13. Cambios a estos términos</h2>
        <p>
          Podemos actualizar estos Términos periódicamente. El uso continuado del Sitio tras la publicación de
          cambios constituye tu aceptación de los Términos actualizados.
        </p>

        <h2>14. Contacto</h2>
        <p>
          Para preguntas sobre estos Términos, escríbenos a <strong>{'{{CONTACTO_LEGAL}}'}</strong>.
        </p>
      </div>

      <p className="mt-12 border-t border-hairline-soft pt-4 text-micro text-ink-subtle">{dict.legal.draftNotice}</p>
    </>
  )
}
