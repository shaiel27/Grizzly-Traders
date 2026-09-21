'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
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
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Algo salió mal</h1>
          <p style={{ color: '#999999', marginBottom: '1.5rem' }}>Ocurrió un error inesperado. Inténtalo de nuevo.</p>
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
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
