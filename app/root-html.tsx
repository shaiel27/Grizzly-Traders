import type { ReactNode } from 'react'
import type { Locale } from '@/lib/i18n/get-dictionary'
import { inter, serif } from './fonts'
import './globals.css'

// First-load intro of the home (components/modules/useIntroInicio.ts). Runs while the HTML is parsed, so the
// header starts hidden on the very first paint instead of flashing in and out. Only on a hard load of "/",
// once per tab session, and never with reduced motion. If the home never takes control (an error page,
// a failed chunk), the header comes back 5 s after `load` — not a fixed timer from here, because the home
// streams in after its data and can take longer than any fixed delay to mount.
const INTRO_SCRIPT = `(function(){try{var d=document.documentElement;if(location.pathname!=='/'||location.hash)return;if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;if(sessionStorage.getItem('gt-intro-visto'))return;d.setAttribute('data-intro','activo');addEventListener('load',function(){setTimeout(function(){if(!d.hasAttribute('data-intro-control'))d.removeAttribute('data-intro')},5000)})}catch(e){}})()`

// Cascarón <html>/<body> común. El sitio público (app/(site)/[locale]/layout.tsx) y el panel y el acceso
// (app/(app)/layout.tsx) son dos layouts raíz distintos: el primero conoce el idioma por la ruta y puede prerenderizarse,
// el segundo lo lee de la cookie en cada petición.
export function RootHtml({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    // suppressHydrationWarning: INTRO_SCRIPT may add data-intro to <html> before React hydrates
    <html lang={locale} className={`${inter.variable} ${serif.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/material-symbols.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-on-surface">
        {/* El script va como HTML dentro de un elemento, no como <script> de React: al cambiar de idioma Next vuelve a montar
            todo el layout raíz en el cliente (cambia el parámetro [locale]) y React avisa ("Encountered a script tag
            while rendering React component") cuando crea un <script> ahí. Al servir la página el navegador lo ejecuta
            igual, justo al empezar el <body>, antes de pintar nada. */}
        <span hidden dangerouslySetInnerHTML={{ __html: `<script>${INTRO_SCRIPT}</script>` }} />
        {children}
      </body>
    </html>
  )
}
