# Plan de mejoras — Grizzly Traders

> **Generado:** 2026-10-02 · **Commit base:** `3e8f34b`
> **Alcance:** seguridad, accesibilidad (esqueletos), sobrecarga visual, animaciones, i18n ES/EN (MVP), políticas legales (USA).
> **Fuera de alcance:** cualquier cambio en **n8n** (workflows, nodos, credenciales). El plan de mejoras n8n previo queda pendiente por separado.
> **Modo:** este documento es un plan para ejecutar. No se ha tocado código.

## Decisiones confirmadas

| Decisión | Respuesta |
|---|---|
| i18n | UI + contenido con fallback (sin cambiar URLs; cookie `gt_locale`) |
| `Header.tsx` | **Editable** en este plan |
| Sobrecarga visual | **Moderada** (eliminar duplicados y ruido; conservar chips de categoría y estilo terminal) |
| Jurisdicción legal | **USA** (CCPA/CPRA + estándar US). Responsable: **Grizzly Traders** (sin email → placeholder `{{CONTACTO_LEGAL}}` hasta definirlo) |
| n8n | **No tocar** |

## Orden de ejecución

| Fase | Área | Prioridad | MVP |
|---|---|---|---|
| **0** | Verificación de credencial n8n (solo lectura) | Bloqueante de F1 | ✅ |
| **1** | Seguridad (RLS crítico + headers) | 🔴 Crítico | ✅ |
| **2** | Accesibilidad + esqueletos | 🔴 Alto | ✅ |
| **3** | Sobrecarga visual (moderada) | 🟠 Alto | ✅ (subset) |
| **4** | Animaciones | 🟡 Media | ✅ (A1–A5) |
| **5** | i18n ES/EN **MVP** (Header, Footer, Home, listados) | 🟠 Alto | ✅ |
| **6** | Políticas legales USA | 🟠 Alto | ✅ |
| **7** | Post-MVP (resto de páginas i18n, tipografía exhaustiva, stagger) | 🟡 | ❌ |

**Reglas globales de ejecución**

- No commits salvo que se pida explícitamente.
- No romper el INSERT de n8n con anon (ver Fase 0).
- No re-litigar la decisión del ticker (marquee con botón pausa, `globals.css:212-213`).
- Verificar siempre: `npx tsc --noEmit && pnpm lint && pnpm test`.

---

## FASE 0 — Verificación previa (solo lectura, condiciona F1)

1. En la UI de n8n, abrir la credencial **`Supabase account 2`** (`WZ5kOBX6Ia6HMoQs`) y comprobar si usa **publishable/anon** o **service_role**.
   - Si es **service_role**: RLS no afecta al pipeline → F1.1/1.2 pueden aplicarse sin más.
   - Si es **anon**: los `CREATE POLICY` de F1.1/1.2 **dejan el INSERT** en `posts`, `posts_translations`, `pipeline_logs`, `pipeline_runs`, `economic_events` y storage `post-images` (ya contemplado); tras aplicar, ejecutar **una ejecución manual del workflow** y confirmar `success`.
2. Si aparece en los headers de la app algún script third-party nuevo (gtag, widget Telegram, etc.), ajustar el `script-src` de F1.4.

---

## FASE 1 — Seguridad

### 1.1 CRÍTICO — RLS degradado (drift vs `supabase/schema.sql`)

Evidencia verificada: con `set local role anon`, `UPDATE`/`DELETE`/`INSERT` sobre `posts` devuelven 1 fila; igual en `posts_translations` (incluye lectura de borradores). Políticas `Public can *` con `roles={public}` no existen en el schema versionado.

```sql
-- posts: eliminar políticas públicas permisivas
drop policy if exists "Public can create posts" on public.posts;
drop policy if exists "Public can update posts" on public.posts;
drop policy if exists "Public can delete posts" on public.posts;

-- posts_translations: CRUD público → solo lectura de publicados + INSERT condicionado
drop policy if exists "Public can create translations" on public.posts_translations;
drop policy if exists "Public can update translations" on public.posts_translations;
drop policy if exists "Public can delete translations" on public.posts_translations;
drop policy if exists "Public read translations" on public.posts_translations;

create policy "Traducciones publicadas se leen" on public.posts_translations
  for select to anon, authenticated
  using (exists (
    select 1 from public.posts p
    where p.id = post_id and p.status = 'published'
  ));

-- Mantener/crear INSERT para anon SOLO si Fase 0 confirmó credencial anon en n8n:
create policy "Pipeline inserta traducciones" on public.posts_translations
  for insert to anon, authenticated with check (true);

-- pipeline_runs / economic_events: anon solo INSERT (n8n), nunca UPDATE
drop policy if exists "Public insert/update pipeline runs" on public.pipeline_runs;
create policy "n8n inserta runs" on public.pipeline_runs
  for insert to anon, authenticated with check (true);

drop policy if exists "Public insert/update economic events" on public.economic_events;
create policy "n8n inserta eventos" on public.economic_events
  for insert to anon, authenticated with check (true);

-- perfiles_autores: UPDATE restringido al dueño (hoy qual = true)
drop policy if exists "Autores editan su perfil" on public.perfiles_autores;
create policy "Autores editan su perfil" on public.perfiles_autores
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- posts: policy de autores referencia cualquier autor → solo el propio
drop policy if exists "Autores gestionan sus posts" on public.posts;
create policy "Autores gestionan sus posts" on public.posts
  for all to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);
```

> NOTA: el `INSERT` público directo sobre `posts` (si la política `Public can create posts` era además el camino manual de pruebas) **no se recrea**: el CMS pasa por API con `requireEditor` y el pipeline por n8n (verificar en Fase 0 que su rol no depende de esa policy).

### 1.2 CRÍTICO — Storage `post-images`

```sql
drop policy if exists "Authenticated insert/update/delete for post-images" on storage.objects;

create policy "imagenes publicas" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'post-images');

-- Si n8n usa anon (Fase 0): INSERT + UPDATE (usa x-upsert)
create policy "n8n sube imagenes" on storage.objects
  for insert to anon
  with check (bucket_id = 'post-images');

create policy "n8n reemplaza imagenes" on storage.objects
  for update to anon
  using (bucket_id = 'post-images')
  with check (bucket_id = 'post-images');

-- Si n8n usa service_role: omitir las dos policies anteriores.
-- DELETE de imágenes: solo authenticated (limpieza CMS) o ninguna.
create policy "cms borra imagenes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-images');
```

### 1.3 ALTO — CSP + HSTS (`next.config.ts`)

Añadir a `async headers()` (existentes en líneas 3–8):

```ts
{
  source: '/(.*)',
  headers: [
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    {
      key: 'Content-Security-Policy',
      value: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'", // ajustar tras probar en dev
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://pudzvatuubywmwdmboiq.supabase.co",
        "font-src 'self'",
        "connect-src 'self' https://pudzvatuubywmwdmboiq.supabase.co https://*.supabase.co wss://*.supabase.co",
        "worker-src 'self' blob:",
        "frame-ancestors 'none'",
        "base-uri 'self'; form-action 'self'",
      ].join('; '),
    },
  ],
},
```

Iterar en dev hasta no romper: markets/lightweight-charts (workers), imágenes Supabase, fuentes Google (next/font es self-hosted ✔).

### 1.4 MEDIO — pendientes cortos

| # | Fix | Archivo |
|---|---|---|
| M1 | Cookies de sesión `httpOnly: true` + `secure: 'production'` propagando `options` al hacer `set` | `lib/supabase/server.ts:17-18`, cliente browser |
| M2 | Top de paginación: `page = Math.min(Math.max(1, page), 50)` | `app/(site)/buscar/page.tsx:18-23` |
| M3 | `revoke execute` de `increment_view_count` y `rls_auto_enable` de `anon, authenticated` | SQL |
| M4 | Añadir `N8N_API_KEY` a schema de env | `lib/env.ts` |
| M5 | Aplicar migración pendiente `supabase/migrations/0001_subscribers.sql` (hoy `/api/subscribe` → 503) | SQL |

### Verificación Fase 1

- REST con anon: `PATCH /rest/v1/posts` → 403; `GET` post publicado → 200; borrador → sin filas.
- Ejecución manual del workflow n8n → `success` (si credencial anon).
- `supabase_get_advisors` (security) sin CRITICAL nuevos.
- `npx tsc --noEmit`.

---

## FASE 2 — Accesibilidad + carga de esqueleto

### Base existente (no romper)

Skip link (`Header.tsx:193`), `main#main-content` en todas las rutas, un `h1` por página, `focus-visible` global (`globals.css:99-102`), tabs y tablas semánticas, ticker con pausa (WCAG 2.2.2), sentimiento con texto.

### 2.1 Esqueletos de ruta (HIGH)

Hoy `app/(site)/loading.tsx:4` = solo spinner. `Loading` ya expone `variant="skeleton"` y `variant="cards"` sin usar (`Loading.tsx:25,40`).

1. **`components/ui/Loading.tsx`**
   - Envolver cada variante en `<div role="status" aria-live="polite">` + `<span className="sr-only">Cargando contenido…</span>`.
   - Spinner y pulse: añadir `motion-reduce:animate-none`.
   - Ajustar skeletons para imitar la grilla real: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`, media `aspect-[16/10]`, líneas de texto 2–3 (copiar proporciones de `ArticleCard`).
2. **`app/(site)/loading.tsx`** → `<Loading variant="cards" count={6} />`.
3. **Nuevos:** `app/(site)/articulos/loading.tsx` (H1 fantasma + filtros + 9 cards) y `app/(site)/buscar/loading.tsx` (barra + grid).
4. **Skeletons client → anunciados** (patrón repo: `AssetTable.tsx:93` `aria-busy`):
   - `MarketsClient.tsx:22,205`, `PivotPointsClient.tsx:380`, `PivotAssetPanel.tsx:17`: quitar `aria-hidden` suelto → envolver en `role="status"` + sr-only.
   - `<p>Cargando…</p>` en `CryptoRankings.tsx:47`, `ForexCalendar.tsx:168`, `FearGreedGauge.tsx:66`, `EconomicCalendar.tsx:83` → `role="status"`.

### 2.2 Contraste (HIGH)

| Problema | Ratio | Fix |
|---|---|---|
| `bg-accent-blue` + `text-white` (botones filled) | 3.0:1 ❌ | Cambiar texto a **`text-canvas` (#090909)**. Archivos: `Button.tsx:26` (variante `accent`), `FeedControls.tsx:26`, `NewsGrid.tsx:36,52`, `app/(site)/page.tsx:193,241` |
| Placeholder `ink-subtle #808080` sobre `surface-2 #1c1c1c` | 4.31:1 ❌ | `placeholder:text-ink-muted` (#999 → 6.0:1) en `RiskCalculator.tsx:97`, `PivotCalculator.tsx:103`, `PivotPointsClient.tsx:325` |
| Bordes de inputs ≈1.3:1 (WCAG 1.4.11) | ❌ | Subir opacidad: `border-outline-variant/40` → `border-outline-variant/70` en inputs |

### 2.3 Semántica / ARIA (MEDIUM)

1. `Header.tsx:272-308` (fila B) y menú móvil `:311-315` → envolver en `<nav aria-label="Categorías">`; nav existente `:204` → `aria-label="Principal y búsqueda"`.
2. Menú móvil: `Escape` cierra; `aria-controls` en el botón toggle.
3. Grillas de cards → `<ul class="grid…">` + `<li>` (patrón ya en `autor/page.tsx:22`): `NewsGrid.tsx:63`, `app/(site)/page.tsx:143`, `articulos/page.tsx:56`, `buscar/page.tsx:81`, `LatestByCategory.tsx:39`, `articulos/[slug]/page.tsx:229`.
4. Títulos de card como `<h3>` dentro del `<li>`: `ArticleCard.tsx` (ambas variantes).
5. `/calendario`: etiquetas de día `h3` → `h2` (`ForexCalendar.tsx:150→237`).
6. `autor/[slug]/page.tsx:95-96`: `<dt>` antes que `<dd>`.
7. `AssetTable.tsx:207` (RSI): añadir texto `sr-only` "sobrecompra"/"sobreventa" (hoy solo color + tooltip).
8. `Input.tsx:44`: `aria-invalid` + `aria-describedby` en errores.
9. `NewsGrid.tsx:29-60` sort: `aria-pressed` + `role="group"` (consistente con pivot).
10. `articulos/[slug]/page.tsx:181`: cover `alt=""` (decorativa junto al h1) para no leer el título dos veces.
11. `globals.css:99`: añadir `input, select, textarea` al selector de focus.
12. `Footer.tsx:52`: `alt=""` en logo (el link ya tiene aria-label en header; en footer hacer idem).

### Verificación Fase 2

Lighthouse a11y ≥ 95 en home/articulos/markets; recorrido completo por teclado; axe DevTools sin critical; con `prefers-reduced-motion` no hay spin/ping/pulse animados.

---

## FASE 3 — Sobrecarga visual (moderada)

### 3.1 Home — quitar triplicados (HIGH) · `app/(site)/page.tsx`

1. Franja de estado `:96-109` repite los mismos 3 números que `StatsBar` `:124` (y una 3ª vez en specs VIP `:273-283`):
   - Reducir franja a solo indicador de pipeline (`[OK]`) **sin cifras**, o eliminarla.
   - StatsBar se queda bajo el hero (única fuente de los 3 números).
   - Specs VIP: no repetir esos mismos contadores.
2. `SentimentSummary` `:126` no va pegado a StatsBar: moverlo más abajo (p. ej. junto a "Últimas Noticias").
3. Ritmo vertical: estandarizar gaps de sección a escala única (p. ej. `mt-16 mb-4` secciones, `mb-8` bloques).

### 3.2 BreakingPost (HIGH) · `components/ui/BreakingPost.tsx`

1. Eliminar **"Destacado" duplicado**: se queda el pill `:52`; overlay `:112-114` pasa solo a symbol/categoría.
2. Eliminar tile **"Lectura"** `:22-26` (minutos infuncionales) → grid de 3 tiles `md:grid-cols-3`.
3. Un solo marco: quitar el `border` del inner `:49` (o el del `section` `:40` — conservar **uno**).
4. Conservar **un solo** wash radial `:44-45` (el más tenue), eliminar el otro.

### 3.3 Color — moderado (HIGH)

1. Unificar **neutral** del sentimiento: `Badge.tsx:18` (ámbar) → gris `text-ink-muted bg-surface-2/60` como `lib/feed.ts:65`.
2. `ArticleCard` cover: quitar el chip de sentimiento de la esquina de la imagen `:103-107`; el sentimiento pasa al `PostMeta` como texto junto a source (1 pill saturada por imagen en vez de 2).
3. Quitar wash radial decorativo del bloque VIP `app/(site)/page.tsx:216`.
4. Token de marca: añadir `--brand-amber: #f7b955` en `globals.css` y reemplazar hex hardcodeados `bg-[#f7b955]` en `Header.tsx:209` y `Footer.tsx:57`.

### 3.4 Bordes / contenedores / radios / hovers (HIGH)

1. **Padding header/footer alineado**: `Header.tsx:201` (`px-6 md:px-8`) → usar `section-container` (mismo que Footer `globals.css:143`).
2. **Anchos**: contenido editorial 1200px (`section-container`); mercados/pivot pueden quedarse en 1400 declarando `--container-wide: 1400px`. Arreglar conflicto `PivotPointsClient.tsx:187` (`section-container` + `max-w-[1400px]`) → una sola clase.
3. **Radios raw → tokens**: `[6px]`, `[4px]`, `[3px]` → `rounded-sm`/`rounded` en `AssetTable.tsx:95`, `Header.tsx:209`, `MarketChart.tsx:311,327,341`, `MarketWatchlist.tsx:102`.
4. **Hover único de cards** = el actual de `ArticleCard` (borde + tint, sin lift):
   - `autor/page.tsx:27`: `hover:border-accent-blue/50` → `hover:border-hairline`.
   - `globals.css:136` `.card`: **eliminar** `hover:-translate-y-0.5 hover:shadow-…` (solo se ve en skeletons).
5. **Pills activos → 2 recetas**: sólido azul (FeedControls, NewsGrid, pivot) y tintado (Chip). `CategoryFilter.tsx:108` → receta tintado (es filtro tipo Chip).

### 3.5 Tipografía (pasada mecánica, HIGH)

1. Regla: **no introducir `text-[NNpx]` nuevo** en `app/(site)` ni `components/ui`; migrar existentes a tokens (`text-micro`, `text-caption`, `text-body`, `text-subhead`, `text-headline`, `text-display-*`) — de ~19 tamaños raw a la escala del repo.
2. H1 de listados → serif (voz editorial, coherente con detalle de artículo y BreakingPost). **Excepción:** `/markets` puede quedarse sans (contexto de datos).
3. Quitar `font-bold` redundante sobre tokens que ya lo incluyen (`text-headline font-bold` etc.).
4. `page.tsx:112`: respetar peso del token `text-display-xl` (medium), quitar override `font-bold`.

### 3.6 Patrón AI-slop (MEDIUM)

- Pill gradient `tracking-widest` VIP (`page.tsx:222`) → pill plano: borde hairline + texto `var(--brand-amber)`.

**No tocar:** ticker, paleta base, anatomía de contenido de ArticleCard, prose del artículo, zoning del Header (salvo nav/padding/switcher), focus styles.

### Verificación Fase 3

Screenshots before/after en 1440px y 390px: home, `/articulos`, `/markets`. Sin overflow horizontal. `npx tsc --noEmit`.

---

## FASE 4 — Animaciones

### Hallazgos (audit `improve-animations`, vetados)

| # | Sev | Ubicación | Hallazgo | Fix |
|---|---|---|---|---|
| A1 | HIGH | `BreakingPost.tsx:54`, `MarketsClient.tsx:154`, `PivotPointsClient.tsx:201`, `PivotLadder.tsx:108` | `animate-ping` sin `motion-reduce` (exemplar correcto: `LiveTicker.tsx:197`) | Añadir `motion-reduce:animate-none` |
| A2 | HIGH | `Loading.tsx:16`, `Button.tsx:56` | `animate-spin` sin reduced-motion ni `role=status` | Resuelto en Fase 2.1 |
| A3 | MED | `Button.tsx:21`, `Chip.tsx:17`, `Input.tsx:33`, `globals.css:127,131,135`, `PivotPointsClient.tsx:62,252,269`, `PivotCalculator.tsx:372`, `ArticleCard.tsx:13`, `CMSPanel` (varios) | `transition-all` (propiedades indefinidas, layout off-GPU) | Sustituir por explícitas: `transition-colors duration-150` (botones/pills/inputs); flecha card: `transition-[transform,color]` |
| A4 | MED | `globals.css` | No hay tokens de easing (curvas built-in demasiado débiles) | Añadir: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1);` y `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);` |
| A5 | MED | `globals.css` (global) | Sin regla global `prefers-reduced-motion` (el ticker la excluye a propósito — **no re-litigar**) | Bloque global que acorte animaciones a opacidad; **excluir** `.ticker-track` (se maneja con su botón pausa) |
| A6 | LOW | `MediaPreview.tsx:25` | `duration-500` en hover-zoom > presupuesto 300ms | `duration-300` + `--ease-out`, `group-hover:scale-[1.02]` |

### Oportunidades perdidas (post-MVP, ver Fase 7)

- **O1:** stagger de 40ms en grillas de cards al entrar en viewport (`opacity` + `translateY(8px)`, 250ms, `--ease-out`, sin bloquear interacción, sin translate con reduced-motion).
- **O2:** crossfade skeleton→contenido 150ms.
- **O3:** micro-feedback 150ms en el switcher de idioma.

### Verificación Fase 4

DevTools → Rendering → reduced-motion: sin ping/spin/pulse animados. Animations panel al 10%: stagger escalonado si O1 está implementado. `pnpm lint && npx tsc --noEmit`.

---

## FASE 5 — i18n ES/EN (MVP)

> Alcance MVP: **Header, Footer, Home, listados de artículos** (`/articulos`, `/buscar`), tokens compartidos (badges, loading, paginación) y fallback de contenido. El resto de páginas → Fase 7.

### 5.1 Arquitectura (sin cambiar URLs)

- Cookie **`gt_locale=es|en`** (max-age 1 año, `path=/`, `sameSite=lax`).
- Dictionaries planos estilo docs Next 16 (`node_modules/next/dist/docs/01-app/02-guides/internationalization.md`):
  - `lib/i18n/dictionaries/es.json`
  - `lib/i18n/dictionaries/en.json`
  - `lib/i18n/get-dictionary.ts` con `type Locale = 'es' | 'en'`, `hasLocale()`, `getDictionary(locale)`.
- Resolución del locale:
  - Server: leer cookie en `app/layout.tsx` (para `<html lang>`) y en `app/(site)/layout.tsx`.
  - Client: `LocaleProvider` (contexto) inyectado en el layout del site con el valor inicial + `setLocale()` que escribe cookie y hace `router.refresh()`.
- Sin `app/[lang]` (decisión confirmada). SEO hreflang: fuera de MVP (Fase 7/futuro).

### 5.2 MVP — qué se traduce

| Zona | Archivos | Contenido |
|---|---|---|
| Diccionario base | `lib/i18n/**` | ~120 keys: chrome, home, listados, errores de carga |
| Header | `Header.tsx` | nav categorías, placeholder búsqueda, `⌘K`, CTA VIP, Telegram/Discord, aria-labels, **switcher ES\|EN** |
| Footer | `Footer.tsx` | titular newsletter, columna Legal (Fase 6), copyright |
| Home | `app/(site)/page.tsx` | H1, lead, `[OK]`, títulos de sección, copy VIP, botones |
| Listados | `articulos/page.tsx`, `buscar/page.tsx` | H1, descripción, empty states, "sin resultados" |
| UI compartida | `ArticleCard`, `BreakingPost`, `FeedControls`, `NewsGrid`, `CategoryFilter`, `Pagination`, `Loading`, `Chip` | labels, aria |
| Sentimiento/categorías | `lib/feed.ts` | `sentimentMeta` labels (Alcista/Bajista/Neutral), `categoryMeta.name` → dependen del locale activo (pasar locale o resolver en cliente con `useLocale()`) |
| Fechas | `articulos/[slug]/page.tsx:14,91-92` (si aplica en listados), `timeAgo` de `feed.ts` | `date-fns` `locale: es → enUS`; `timeAgo` textos ("hace X min" → "X min ago") |
| Metadata | `app/layout.tsx` | `<html lang>` dinámico; title/description default pueden quedarse ES (mercado hispano) + `openGraph.locale` |

### 5.3 Contenido de artículos (fallback)

- `lib/feed.ts:71` `localizedPost`: cambiar prioridad a **locale activo → fallback `es` → `post.title`**.
- `lib/api.ts`: las ~8 funciones con `locale = 'es'` por defecto reciben el locale activo desde las páginas (`getPosts`, `getFeaturedPosts`, `searchPosts`, etc.). La BD solo tiene filas `es` → el fallback cubre.
- **n8n queda intacto**: no se añade traducción `en` automática en este plan.

### 5.4 Switcher (Header, editable)

- Pill-segmented `ES | EN` en la fila B del Header (junto a los tool pills o al final de la nav).
- `role="group" aria-label="Idioma"`; botones con `aria-pressed`.
- Click → cookie + `router.refresh()` (sin recarga dura de ventana).
- Estilo: misma receta que pills sólidos/tintados unificados en Fase 3.4.
- Espejo accesible en Footer (links `ES`/`EN` o `lang` attribute en el mismo control).

### 5.5 Pasos de ejecución

1. `lib/i18n/` (dictionaries MVP + `getDictionary` + `LocaleProvider` + `useLocale`).
2. `app/layout.tsx`: `lang` dinámico desde cookie.
3. `app/(site)/layout.tsx`: montar `LocaleProvider`.
4. Switcher en `Header.tsx` + strings del Header.
5. Footer + Home.
6. Listados (`/articulos`, `/buscar`) + `FeedControls`/`NewsGrid`/`CategoryFilter`.
7. `localizedPost` fallback + `lib/api.ts` locale activo en páginas MVP.
8. `timeAgo`/fechas bilingües.
9. Tests: `lib/i18n/i18n.test.ts` — `hasLocale`, fallback de `localizedPost`, keys faltantes en dev (warn).

### Verificación Fase 5

- Seleccionar EN → chrome e home en EN; artículo sin traducción visible (fallback ES); `html lang="en"`; fecha relativa EN; cookie persiste al recargar; volver a ES restaura todo.
- `npx tsc --noEmit && pnpm test && pnpm lint`.

---

## FASE 6 — Políticas legales (USA)

> Borradores técnicos para revisión legal externa. **No son asesoramiento.**
> Responsable: **Grizzly Traders** · Contacto: `{{CONTACTO_LEGAL}}` (pendiente de definir; no inventar email).
> Jurisdicción: Estados Unidos (CCPA/CPRA + estándar US). Si se detectan residentes de California: derechos CCPA aplicables; declaramos **no venta ni sharing comercial de datos personales**.

### 6.1 Páginas nuevas — `app/(site)/legal/`

| Ruta | Contenido mínimo |
|---|---|
| `/legal/privacidad` | Responsable (Grizzly Traders, `{{CONTACTO_LEGAL}}`); datos recolectados (email de newsletter, cuenta del CMS, cookies técnicas de sesión, IP en logs de Supabase); finalidades; retención; encargados (Supabase, n8n Cloud, OpenAI vía n8n, proveedores de datos de mercado); derechos CCPA (acceso, eliminación, opt-out — sin venta de datos); menores (no dirigido a menores de 13); fecha de vigimiento; cómo ejercer derechos vía `{{CONTACTO_LEGAL}}` |
| `/legal/terminos` | Uso aceptable; **descargo de contenido financiero** (no es asesoramiento de inversión, sin garantías, riesgo propio); propiedad intelectual (artículos, marca, logo); newsletter; limitación de responsabilidad; indemnización; terminación; ley aplicable y foro (State of ___, USA — pendiente de definir estado); cambios |
| `/legal/cookies` | Cookies técnicas (sesión Supabase auth `sb-*`, preferencia `gt_locale`); sin cookies de terceros ni analytics hoy (declararlo); control desde el navegador; última actualización |

### 6.2 Integración

1. `app/(site)/legal/layout.tsx`: H1 + `prose` reutilizando tokens de `articulos/[slug]/page.tsx` + breadcrumbs.
2. `Footer.tsx`: columna **Legal** con los 3 links (junto a los nav links existentes).
3. `NewsletterForm.tsx`: microcopy bajo el input: "Al suscribirte aceptas la Política de Privacidad" (link) — sin checkbox obligatoria (newsletter de contenidos; se puede añadir si el legal lo pide).
4. `sitemap.ts`: incluir las 3 URLs.
5. Metadata propias por página (`title`, `description`, `robots: index`).
6. Estado: marcar en cada página `status: BORRADOR — requiere revisión legal` en un comentario del código y, si se desea, un aviso discreto en el pie del documento.

### Verificación Fase 6

Las 3 rutas 200, enlazadas desde Footer, en sitemap, sin errores de build; revisión humana pendiente antes de publicar.

---

## FASE 7 — Post-MVP (no ejecutar todavía)

1. **i18n resto de páginas:** markets, pivot-points, herramientas, aprende, autor, calendario, detalle de artículo (UI chrome), CMS excluido.
2. **SEO i18n:** `alternates.languages` / hreflang (requerirá decidir rutas `/en/...` — reabre el tema `[lang]`).
3. **Traducciones `en` de contenido:** decidir si n8n o CMS generan `posts_translations` EN (fuera de alcance actual).
4. **Stagger de grid (O1)** y crossfade skeleton (O2).
5. Tipografía: completar migración de raw px en `components/` admin y páginas no MVP.
6. Entidad legal completa (estado, email) → rellenar placeholders y revisión legal formal.
7. Plan n8n (workflow de noticias) — documento aparte, **no incluido aquí**.

---

## Checklist final de aceptación (MVP)

- [ ] Anon no puede `UPDATE`/`DELETE` `posts` ni `posts_translations`; borradores no legibles con anon.
- [ ] Storage: anon solo INSERT/UPDATE en `post-images` (o solo lectura si n8n usa service_role); DELETE restringido.
- [ ] HSTS + CSP presentes y la app funciona en dev (markets incluido).
- [ ] `loading.tsx` muestra esqueleto con `role="status"`; skeletons client anunciados.
- [ ] Botones filled con texto oscuro (≥4.5:1); placeholders ≥4.5:1.
- [ ] Home sin stats triplicados; BreakingPost sin doble "Destacado" ni tile "Lectura".
- [ ] `transition-all` eliminado en componentes públicos; tokens `--ease-*` presentes; reduced-motion global excluye ticker.
- [ ] Switcher ES/EN opera con cookie; fallback de contenido verificado; `html lang` correcto.
- [ ] 3 páginas legales en Footer + sitemap; placeholders `{{CONTACTO_LEGAL}}` documentados.
- [ ] `npx tsc --noEmit && pnpm lint && pnpm test` en verde.
- [ ] **n8n sin cambios.**
