import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getEditor } from '@/lib/auth'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = {
  title: 'Acceso editores',
  robots: { index: false, follow: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ recovery?: string; error?: string }>
}) {
  const editor = await getEditor()
  const { recovery, error } = await searchParams

  // A recovery session must not bounce straight to /cms: the user still needs to pick a new password.
  if (editor.status === 'ok' && recovery !== '1') redirect('/cms')

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-4 py-12"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(45% 55% at 15% 20%, rgba(0,153,255,0.12), transparent 60%), radial-gradient(45% 55% at 85% 85%, rgba(106,76,245,0.14), transparent 60%)',
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Image src="/logo.png" alt="Grizzly Traders" width={36} height={36} className="size-9 object-contain" priority />
          <span className="rounded-[4px] bg-[#f7b955] px-1.5 py-[3px] text-[9px] font-bold uppercase leading-none tracking-[0.18em] text-[#0b0b0c]">
            Terminal
          </span>
        </div>

        <div className="rounded-2xl border border-hairline bg-surface-1/90 p-6 shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-headline font-bold text-ink">Acceso editores</h1>
            <p className="mt-1.5 text-body-sm text-ink-muted">Inicia sesión para gestionar el contenido del portal.</p>
          </div>

          <LoginForm forbidden={editor.status === 'forbidden'} recovery={recovery === '1'} error={error} />
        </div>

        <Link
          href="/"
          className="mt-6 flex items-center justify-center gap-1.5 text-body-sm text-ink-muted transition-colors hover:text-ink"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            arrow_back
          </span>
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
