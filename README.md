# Grizzly Traders

Portal de noticias y mercados financieros (criptomonedas, forex, materias primas y acciones) con cotizaciones, niveles de pivote y un panel CMS para editores.

Stack: Next.js 16 (App Router), React 19, Tailwind CSS 4, Supabase (Postgres + Auth) y lightweight-charts. Gestor de paquetes: **pnpm**.

> Esta versión de Next.js tiene cambios incompatibles con versiones anteriores (por ejemplo `proxy.ts` en lugar de `middleware.ts`). La documentación local está en `node_modules/next/dist/docs/`.

## Puesta en marcha

```bash
pnpm install
cp .env.example .env.local   # completa los valores
pnpm dev                     # http://localhost:3000
```

### Variables de entorno

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL pública (canonical, sitemap, RSS). Se incrusta en el build. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase (públicas). |
| `SUPABASE_SERVICE_ROLE_KEY` | Opcional, solo servidor. Escrituras del CMS sin depender de RLS. |
| `CMS_ALLOWED_EMAILS` | Correos (separados por coma) de usuarios de Supabase Auth con acceso al CMS. Vacío = nadie. |
| `FINNHUB_API_KEY` | Cotizaciones de acciones e índices. |
| `N8N_MCP_TOKEN`, `N8N_MCP_URL`, `N8N_WORKFLOW_ID` | Pipeline de contenido en n8n (solo servidor). |
| `NEXT_PUBLIC_VIP_URL`, `NEXT_PUBLIC_TELEGRAM_URL` | Botones de la home (se ocultan si están vacías). |

Al arrancar el servidor, `instrumentation.ts` valida estas variables con `lib/env.ts`: si falta una obligatoria (las dos de Supabase) o alguna tiene un formato inválido, el servidor se detiene con un mensaje que las lista todas. Las variables vacías (`KEY=`) se tratan como no definidas.

## Acceso al CMS

1. Crea un usuario en Supabase Auth (email + contraseña).
2. Añade su correo a `CMS_ALLOWED_EMAILS`.
3. Entra en `/login`. `/cms` y todas las rutas `POST/PATCH/DELETE` de `/api/posts/*` exigen sesión y pertenecer a esa lista.

Si no defines `SUPABASE_SERVICE_ROLE_KEY`, las escrituras usan la sesión del editor y necesitas políticas RLS que permitan escribir a usuarios autenticados.

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` / `build` / `start` | Desarrollo, build y servidor de producción. |
| `pnpm lint` | ESLint. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm test` | Pruebas unitarias (Vitest). |

## Estructura

- `app/` rutas (páginas, `api/`, `sitemap.ts`, `robots.ts`, `feed.xml`).
- `components/ui` componentes de interfaz; `components/modules` bloques de la home.
- `lib/api.ts` lecturas públicas de Supabase; `lib/auth.ts` autorización de editores; `lib/validation.ts` esquemas zod; `lib/sanitize.ts` sanitizado de HTML; `lib/pivots.ts` cálculo de pivotes; `lib/prices.ts` cotizaciones; `lib/format.ts` formato de precios y cifras (un único punto para cambiar el locale); `lib/env.ts` validación de variables de entorno.
- `components/ui/ArticleCard.tsx` tarjeta de artículo con variantes `cover` y `compact`; enlaza siempre con el slug de la traducción, que es el que resuelve `/articulos/[slug]`.
- Los tipos de mercado (`MarketItem`) viven en `lib/markets.ts` y se comparten con los componentes de `/markets`.
- `proxy.ts` refresca la sesión de Supabase (la autorización se comprueba en cada página y ruta, no aquí).
- `supabase/schema.sql` esquema de referencia (puede estar desactualizado respecto a la base real).

## Fuentes de datos

Cotizaciones: CoinGecko (cripto y oro vía PAXG), Frankfurter/BCE (forex, un valor por día hábil) y Finnhub (acciones; S&P 500 y DXY se aproximan con los ETF SPY y UUP). Mercados: scanner no oficial de TradingView, que puede cambiar o bloquearse sin aviso. El catálogo de la terminal está en `lib/market-assets.ts` (64 activos con nombre corto y descripción en español); cada ticker se comprobó contra el scanner, y uno que el scanner no conoce desaparece de la tabla sin error, así que conviene probar cualquier cambio. `/markets?activo=<ticker>` abre la terminal con ese activo seleccionado.

Gráficos: `/api/candles?symbol=<ticker>&tf=<1m|5m|15m|1h|4h|1d|1w|1mo>` sirve velas de Yahoo Finance (las de 4h se construyen con las de 1h). Reintenta en dos hosts, comparte una sola petición entre visitantes, cachea según la temporalidad y, si Yahoo falla, devuelve el último dato guardado hasta una hora. Corrige dos rarezas de Yahoo: la barra "de ahora" que duplica el día actual en los datos semanales y mensuales, y las velas de índices con apertura, máximo y mínimo en 0. Las medias móviles (20, 50, 200 y exponencial 20) se calculan sobre las velas cargadas en `lib/indicators.ts`. El bono de EE. UU. a 2 años no tiene histórico en Yahoo y el gráfico lo indica.

Pivot points (`/pivot-points`): el scanner devuelve el precio actual y el máximo, mínimo, apertura y cierre del período anterior (`high[1]`, `low[1]`…, con `|1W` y `|1M` para semanal y mensual); los cinco métodos se calculan en `lib/pivots.ts`. No se usan las columnas `Pivot.M.*` del scanner porque son pivotes mensuales sin importar el período. El catálogo de activos está en `lib/pivot-assets.ts` (cada ticker se comprobó contra el scanner: uno desconocido desaparece en silencio) y los futuros de Brent, WTI y gas natural no tienen datos semanales ni mensuales.

Barra de mercados (encima del header): `/api/ticker` devuelve ~34 activos (cripto, forex, materias primas, índices y acciones) desde el scanner de TradingView, con los proveedores anteriores como respaldo si el scanner no devuelve un activo. El navegador la consulta cada 3 s mientras la pestaña está visible (con espera creciente si falla), así que se actualiza sin recargar. El servidor comparte una sola consulta al scanner, renovada como máximo cada 2 s, entre todos los visitantes, y sigue sirviendo el último dato bueno hasta 60 s si el scanner falla. El primer pintado (layout) usa una caché aparte de 15 s para no regenerar las páginas estáticas. La lista y el orden están en `lib/ticker.ts`.
