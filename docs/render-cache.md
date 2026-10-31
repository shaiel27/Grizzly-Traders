# Renderizado, idioma y caché

El sitio público se prerenderiza por idioma y se sirve desde caché (ISR). Las URL **no llevan prefijo de idioma**.

## Cómo funciona
- Las páginas públicas viven en `app/(site)/[locale]/…` (`es` | `en`). El layout `app/(site)/[locale]/layout.tsx` es un layout raíz (pone `<html lang>`).
- `proxy.ts` reescribe las rutas públicas a `/${locale}${ruta}` según la cookie `gt_locale` (español por defecto) sin cambiar la URL del navegador (`lib/i18n/rewrite.ts`, con pruebas). Un prefijo explícito (`/en/articulos`) redirige (308) a la URL sin prefijo y guarda la cookie. Las respuestas reescritas llevan `Vary: Cookie`.
- Las páginas leen el idioma con `getRouteLocale()` (`lib/i18n/route-locale.ts`, `next/root-params`), no con la cookie.
- `app/(app)/layout.tsx` es el otro layout raíz: `/cms` y `/login` siguen dinámicos y con el idioma por cookie (`getServerLocale()`).
- 404: `app/global-not-found.tsx` (experimental, necesaria con varios layouts raíz) para rutas inexistentes; `app/(site)/[locale]/not-found.tsx` para `notFound()` dentro de una página.

## Qué se cachea y cuánto
| Página | Modo | Regeneración |
|---|---|---|
| Home | ISR por idioma | ≈15 s (cotizaciones del hero) |
| `/articulos/[slug]`, `/autor/[slug]` | ISR en la primera visita | 5 min |
| `/autor`, `/aprende`, `/herramientas`, `/calendario`, `/pivot-points`, legal | estáticas | 5 min |
| `/articulos`, `/buscar`, `/markets`, `/newsletter/*` | dinámicas (usan `searchParams`) | por petición |
| `/feed.xml`, `/sitemap.xml` | caché de datos (`unstable_cache`) | 10 min / 1 h |

Todo lo que viene de Supabase pasa por `cached()` (`lib/api.ts`) con los tags `posts` y `catalog`.

## Invalidación
- Publicar o editar desde el CMS llama a `revalidatePosts()` (`lib/cache.ts`).
- n8n llama a `POST /api/revalidate` (Bearer `PIPELINE_API_SECRET`) tras publicar: el nodo "Revalidar sitio" del pipeline. Sin esto, lo publicado por n8n tardaría hasta 5 minutos.
- Las vistas se cuentan con `POST /api/views/[id]` (`components/ui/ViewBeacon.tsx`); los listados muestran el contador de la caché.

## Operación
- Cada cambio de código exige `pnpm build` y reiniciar `pnpm start`.
- Un CDN delante del VPS debe **variar por la cookie `gt_locale`** (o no cachear el HTML): el mismo URL devuelve HTML distinto por idioma.
- La cinta de cotizaciones ya no viaja en el HTML: el `LiveTicker` la pide al montar.
