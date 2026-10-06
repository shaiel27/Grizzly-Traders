// Server Component a proposito (sin 'use client'): template.tsx ya remonta en cada navegacion
// dentro de (site) (ver node_modules/next/dist/docs/.../template.md), asi que un DOM nuevo +
// una animacion CSS pura alcanza — no hace falta estado ni efectos para "disparar" el fade.
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-fade-in">{children}</div>
}
