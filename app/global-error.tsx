'use client'

// Next's top-level fallback for errors in the root layout itself — it replaces the whole
// <html>/<body>, so it deliberately can't rely on LocaleProvider or any other app context (the
// root layout may be exactly what's broken). Reads the locale cookie directly instead, a pure
// client-side check with no dependency on the rest of the app.
function readLocaleCookie(): 'es' | 'en' {
  if (typeof document === 'undefined') return 'es'
  const match = document.cookie.match(/(?:^|; )gt_locale=(es|en)(?:;|$)/)
  return match?.[1] === 'en' ? 'en' : 'es'
}

const COPY = {
  es: { heading: 'Algo salió mal', body: 'Ocurrió un error inesperado. Inténtalo de nuevo.', retry: 'Reintentar' },
  en: { heading: 'Something went wrong', body: 'An unexpected error occurred. Please try again.', retry: 'Retry' },
}

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = readLocaleCookie()
  const copy = COPY[locale]

  return (
    <html lang={locale}>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#090909',
          color: '#ffffff',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>{copy.heading}</h1>
          <p style={{ color: '#999999', marginBottom: '1.5rem' }}>{copy.body}</p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#ffffff',
              color: '#2f3131',
              border: 0,
              borderRadius: 9999,
              padding: '0.6rem 1.4rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {copy.retry}
          </button>
        </div>
      </body>
    </html>
  )
}
