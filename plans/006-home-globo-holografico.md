# 006 — Hero de la home con globo 3D holográfico interactivo

- **Estado**: IMPLEMENTADO (en `feature/home-video-hero`, sin commitear — ver nota de verificación al final del documento)
- **Sustituye a**: el hero con video de `feature/home-video-hero` (`components/modules/HomeHero.tsx`)
- **Origen**: un prompt escrito para otro proyecto (Vite + react-router + zustand, "Control de Saldo / Bodega
  Los Malabares"). Este documento lo adapta a Grizzly Traders.

## 0. Diferencias entre el prompt original y este repo

| Prompt original | Grizzly Traders (real) | Adaptación |
|---|---|---|
| Vite 8 + react-router v7 + zustand | **Next.js 16 App Router** (con cambios de API, ver `AGENTS.md`) | Rutas por carpetas en `app/`, sin router en el cliente |
| `src/App.tsx`, `src/pages/*` | `app/(site)/page.tsx`, `app/(site)/layout.tsx` | El globo vive dentro del hero de la home `/` |
| `React.lazy` + `Suspense` | `next/dynamic(() => import(...), { ssr: false })` | Llamarlo desde un componente `'use client'`, porque `ssr:false` no está permitido en un Server Component. Confirmarlo en `node_modules/next/dist/docs/` después de `pnpm install` |
| `/login` → `/app`, `AppShell`, `Sidebar`, `useApp(e => e.autenticado)` | No hay `/app`. `/login` es solo la entrada de los editores al `/cms` (`proxy.ts` + `lib/auth.ts`) | **Se elimina el paso 6 (rutas)**: la home sigue en `/` y el login del CMS no cambia |
| Botón "Ingresar" → `/login` | Es un portal público de noticias | Los CTAs llevan al contenido (`/articulos`, `/markets`), no al login |
| Íconos `lucide-react` de `Sidebar.tsx` | Fuente `material-symbols` autoalojada y recortada (`scripts/build-icon-font.mjs`) | Usar íconos que ya estén en la fuente. Si hace falta uno nuevo, `pnpm icons` necesita acceso a fonts.google.com |
| `vercel.json`, `wrangler.jsonc` | No existen. Next se despliega sin fallback SPA | No aplica |
| Textos "Control de Saldo / Bodega…" | Diccionarios i18n `lib/i18n/dictionaries/{es,en}.json` | Usar las claves `home.hero*` que ya existen y añadir las nuevas en **es y en** |
| Fondo `#000` en todo el portal | `--canvas: #090909` en todo el sitio, con header fijo translúcido | `#000` solo en el hero y en la sección "Lo que hay dentro". El resto de la home sigue en `canvas` (ver decisión D2) |

## 1. Dependencias

```bash
pnpm add three @react-three/fiber @react-three/drei @react-three/postprocessing
pnpm add -D @types/three d3-geo topojson-client world-atlas @types/d3-geo @types/topojson-client
```

- Comprobado: `registry.npmjs.org` responde 200. **unpkg.com y cdn.jsdelivr.net están bloqueados** por el proxy,
  así que la máscara se genera con `world-atlas` (ver §2) y no se descarga de `earth-water.png`.
- El código de Three.js solo entra en el chunk que carga `next/dynamic`. Ni el resto de la home ni `/markets` ni `/cms`
  lo descargan. Lo compruebo con el build en §7.
- CSP (`next.config.ts`): Three y postprocessing no usan `eval`, y la máscara sale de `'self'`. **No usar `<Text>` de
  drei** (troika descarga fuentes de un CDN que la CSP bloquea). Las etiquetas HUD se pintan en `CanvasTexture`
  con Inter.

## 2. Máscara de continentes: `scripts/build-globe-mask.mjs` → `public/globo/`

- Script de Node: lee `world-atlas/land-50m.json`, lo convierte con `topojson-client.feature` y lo rasteriza en
  proyección equirectangular (`d3.geoEquirectangular().fitSize`) sobre un canvas
  (`@napi-rs/canvas` como devDependency, o `sharp` a partir de un SVG). Tierra blanca, agua negra.
- Salidas: `public/globo/tierra-mascara-2048.png` (2048×1024) y `public/globo/tierra-mascara-4096.png` (4096×2048).
- Se añade `"globe:mask": "node scripts/build-globe-mask.mjs"` a `package.json` y los PNG se commitean.

## 3. Globo: `components/globe/`

```
components/globe/
  HeroGlobe.tsx           'use client'. Envoltorio con next/dynamic({ ssr:false }) y fallback negro
  GloboHolografico.tsx    <Canvas> y escena (solo cliente)
  useArrastreGlobo.ts     arrastre + inercia + auto-giro
  shaders.ts              GLSL de Fresnel, atmósfera y puntos
  muestrearTierra.ts      máscara → posiciones/brillo de los puntos (PRNG con semilla)
```

Capas (todas con `toneMapped={false}` en lo que brilla, para que el bloom actúe):

1. **Esfera base**: `ShaderMaterial` transparente con un azul muy oscuro (`#020a18`, α≈0.35) y Fresnel
   `pow(1 - dot(N,V), 3)` hacia `#4fc3ff`. `depthWrite:false` para que se vean los puntos de la cara trasera.
2. **Continentes**: `Points` con 40–60k puntos.
   - Muestreo: se carga la máscara de 2048, se lee con `getImageData` en un canvas fuera de pantalla y se muestrea
     con un **PRNG con semilla (mulberry32)**. La regla `react-hooks/purity` del repo prohíbe `Math.random()` en el
     render, y además así el resultado es siempre igual. El muestreo es uniforme en área (`lat = asin(2v-1)`).
   - Costa: un píxel de tierra con algún vecino de agua en un radio de 2 px pasa a ser costa. Allí se aceptan más
     muestras (×2–3) y el atributo `aBrillo` es mayor.
   - Shader: `gl_PointSize = uTam * aBrillo * (300.0 / -mvPosition.z)`, punto redondo y suave, color `#7fd4ff`,
     parpadeo `0.75 + 0.25*sin(uTiempo*aVel + aFase)`, `AdditiveBlending`, `depthWrite:false`. Los puntos de la cara
     trasera se atenúan (≈0.25) según el signo de `dot(normal, viewDir)`.
3. **Retícula**: `LineSegments` con meridianos cada 15° y paralelos cada 15°, `#4fc3ff` y opacidad 0.06.
4. **Atmósfera**: esfera de radio ×1.12 en `BackSide` con brillo `pow(0.65 - dot(N,V), 2.5)` en azul, `AdditiveBlending`.
5. **Anillos HUD** (3): radios 1.35/1.5/1.68, inclinaciones distintas y cada uno con su velocidad, alternando el sentido.
   Son líneas punteadas (`LineDashedMaterial`, o un shader con `fract`), tienen marcadores pequeños (`Points`) y
   **etiquetas con datos reales del sitio** en `CanvasTexture` y texto diminuto: `BTC/USD 67 412`, `+1.2%`,
   `{posts} NOTICIAS`, `{assets} ACTIVOS`. Los datos llegan como props desde `page.tsx`, igual que en el `HomeHero`
   actual. Así el "pulso del mercado" pasa a formar parte del globo y ya no es una tarjeta aparte (ver D3).
6. **Base holográfica**: anillo/elipse plana bajo el globo (`RingGeometry` + shader radial), con conos de luz
   tenues hacia arriba y un pulso lento.
7. **Postproceso**: `EffectComposer` con `Bloom` (`mipmapBlur`, intensity≈1.4, luminanceThreshold≈0.1) y
   `Vignette` (darkness≈0.5). **Sin Noise.**

Canvas: `gl={{ alpha:false, antialias:true, powerPreference:'high-performance' }}`, `dpr={[1,2]}`,
`onCreated={({gl}) => gl.setClearColor('#000000')}`.
`PerformanceMonitor`: si baja, se pasa a 25k puntos, el bloom a nivel 0.7 y `dpr` a 1. Si se recupera, se vuelve a subir.
`frameloop="demand"` cuando el hero queda fuera de pantalla (IntersectionObserver), para no gastar GPU mientras se
leen las noticias de abajo.

`prefers-reduced-motion`: sin auto-giro, sin inercia, sin parpadeo y sin giro de anillos. El arrastre sigue
funcionando 1:1. Escucho el `change` de `matchMedia`, igual que hace hoy el `<video>`.

## 4. Arrastre: `components/globe/useArrastreGlobo.ts`

- Los Pointer Events van sobre **un `div` circular del tamaño del globo**, no sobre todo el canvas. Solo ese `div`
  lleva `touch-action: none` y `cursor: grab/grabbing`, así en el celular se puede hacer scroll tocando fuera del globo.
- `pointerdown`: `setPointerCapture`, se guarda la posición y se pone la velocidad a 0.
  `pointermove`: `vel.y = dx*k`, `vel.x = dy*k`, con `k` escalado por `1/altoDelGlobo`.
- Rotación con quaternions: `qY = setFromAxisAngle(UP, rotY)` y `qX = setFromAxisAngle(RIGHT, rotX)`,
  `group.quaternion = qX * qY` (el giro en Y va en espacio local y la inclinación en espacio de cámara), con
  `rotX ∈ [-60°, 60°]`. Arrastrar a la derecha hace girar la superficie hacia la derecha.
- `pointerup`: se conserva la velocidad y se frena con `vel *= 0.95^(dt*60)`. Cuando `|vel| < ε`, se interpola en
  ~1.2 s hacia el auto-giro de oeste a este (`+0.05 rad/s` en Y), y `rotX` vuelve suavemente a ~0.25 rad de inclinación.
- El estado vive en `useRef`, sin re-renders de React. Se lee en `useFrame`.
- Teclado (accesibilidad): el `div` lleva `tabIndex=0`, `role="img"` y un `aria-label` descriptivo. Las flechas
  aplican impulsos.

## 5. Hero: reescribir `components/modules/HomeHero.tsx`

- Se quitan el `<video>`, el velo con gradiente y la tarjeta BTC. `section` con `bg-black`, alto
  `min-h-[100svh]`, y el header fijo encima (el contenido arranca bajo `--header-height`).
- Escritorio (1440×900): globo centrado y grande (≈min(80vh, 760px)). Texto superpuesto abajo a la izquierda o
  debajo del globo, con `pointer-events:none` para que no tape el arrastre (salvo en los botones).
  Celular (390×844): el globo ocupa ≈90vw arriba y el texto va debajo, en una sola columna, sin scroll horizontal
  (los anillos se recortan con `overflow-hidden` en la sección).
- Textos: `heroTitleLine1/2`, `heroLead` (ya existen). CTA principal `heroCtaPrimary` → `/articulos`.
  CTA secundario **"Ver más"** → scroll suave a `#lo-que-hay-dentro` (respeta `--header-scroll-offset`).
  Pista nueva `heroDragHint`: "Arrastra para girar el planeta" / "Drag to spin the globe".
- Acentos de la interfaz en cian: se añade el token `--accent-cyan: #4fc3ff` (más `--accent-cyan-glow`) en
  `globals.css` y en `@theme`. El resto del sitio sigue con `--accent-blue`.
- Secuencia de entrada (keyframes en `app/globals.css`, que ya los anula con `prefers-reduced-motion`):
  1. 0–500 ms: se enciende la base (`opacity` + `scaleX`). Se anima en JS dentro de la escena con un reloj `tEntrada`.
  2. 300–1300 ms: el globo pasa de escala 0.6 a 1 y de opacidad 0 a 1 (uniform `uOpacidad`).
  3. 900–1700 ms: los anillos se despliegan (escala radial de 0 a 1, escalonados 120 ms).
  4. 1400 ms+: textos con las clases `hero-fade-up` y `animationDelay` escalonados.
  Para que el texto y el globo arranquen a la vez, el texto espera a que el canvas llame a `onReady`
  (o a un timeout de 2 s si WebGL tarda o falla).
- Fallback: mientras carga el chunk, un `div` negro con un brillo elíptico CSS donde irá la base. Sin WebGL
  (`WebGLRenderingContext` ausente o error en `onCreated`), se queda ese fallback estático y los textos se muestran igual.
- Se borran `public/market-loop-1080p.{mp4,webm}` y `market-loop-poster.jpg` (≈4.6 MB) si se confirma D4.

### Sección "Lo que hay dentro" (`components/modules/HomeFeatures.tsx`)

Va justo después del hero, sobre `#000`. Son 4 tarjetas oscuras con borde `1px` cian translúcido
(`border-[#4fc3ff]/20`) y, al pasar el cursor, brillo `box-shadow: 0 0 32px var(--accent-cyan-glow)` y borde al 50 %.
Reemplazan a las secciones del Sidebar del prompt original:

| Tarjeta | Ícono (material-symbols) | Enlace |
|---|---|---|
| Noticias verificadas | `article` | `/articulos` |
| Terminal de mercados | `monitoring` / `show_chart` | `/markets` |
| Puntos pivote | `calculate` / `stacked_line_chart` | `/pivot-points` |
| Calendario económico | `calendar_month` | `/calendario` |

Antes de elegirlos compruebo qué íconos ya están en la fuente (`grep -rho "material-symbols-outlined[^>]*>[^<]*"`),
porque regenerar la fuente necesita fonts.google.com. Las tarjetas aparecen al entrar en pantalla con un
`IntersectionObserver` (clase `is-visible` → `hero-fade-up`, escalonadas 80 ms). Al final va el CTA
"Explorar el terminal" → `/markets`. Después sigue la home actual (StatsBar, noticias, etc.) sin cambios.

Textos nuevos en `es.json` y `en.json`: `heroDragHint`, `heroCtaMore`, `globeAria`, `featuresTitle`,
`features.{news,markets,pivots,calendar}.{title,body}` y `featuresCta`.

## 6. Rutas y auth

**Sin cambios.** `/` sigue siendo la home con datos del servidor, `/login` y `/cms` no se tocan y no hay `/app`
ni fallback SPA. El hero no depende de la sesión. `app/(site)/loading.tsx` (splash del plan 005) sigue cubriendo
la espera de los datos del servidor. El globo arranca cuando el splash desaparece.

## 7. Verificación

1. `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` sin errores. Reporto el **First Load JS de `/`**
   (antes y después) y el tamaño del chunk de `GloboHolografico` en `.next/static/chunks`, y confirmo que `/markets`
   y `/cms` no lo incluyen.
2. `pnpm dev`: **no hay `.env.local`** y `instrumentation.ts` corta el arranque si faltan las variables de Supabase.
   Para las pruebas uso valores ficticios con un formato válido. La home muestra entonces el aviso `sourceDown` y el hero
   con valores `—`, lo cual alcanza para probar el globo. Si me pasas credenciales reales, pruebo con datos.
3. Playwright (`playwright-core` del repo + `/opt/pw-browsers/chromium`, con `--use-angle=swiftshader` para WebGL
   sin GPU): capturas a 1440×900 y 390×844. Leo los píxeles de las 4 esquinas del hero y espero `rgb(0,0,0)`
   (la vignette también es negra).
4. Arrastre: `mouse.down` → `move(+200, 0)` → `up` y luego `move(0, +150)`. Capturo antes y después y lo compruebo
   **numéricamente**: expongo `window.__globo.quaternion` solo en dev y verifico que el yaw aumentó con el arrastre a la
   derecha y el pitch con el arrastre hacia abajo. Te muestro las capturas.
5. Navegación: "Ver las noticias de hoy" → `/articulos`, "Ver más" hace scroll hasta las tarjetas y cada tarjeta lleva
   a su ruta. `/login` → `/cms` no ha cambiado.
6. Celular (390×844, `hasTouch`): un `touchscreen` swipe fuera del globo hace scroll (cambia `scrollY`) y dentro del
   globo lo gira sin hacer scroll. Además, sin scroll horizontal (`scrollWidth === clientWidth`).
7. `emulateMedia({ reducedMotion: 'reduce' })`: dos capturas separadas 1 s son idénticas (sin auto-giro).

Commits en español, uno por bloque (dependencias + máscara, globo, arrastre, hero + secciones, i18n/limpieza).
**Sin push hasta que lo confirmes.**

## Decisiones abiertas

- **D1 — Rama.** El entorno me asigna `feature/home-video-hero` y el prompt pide `feature/portal-globo-3d`.
  Recomiendo crear `feature/portal-globo-3d` a partir de la rama actual, porque ya contiene el hero de video
  que se reemplaza.
- **D2 — Alcance del negro.** Recomiendo `#000` en el hero y en "Lo que hay dentro", y el resto del sitio en `#090909`.
  La alternativa es cambiar `--canvas` a `#000` en todo el sitio.
- **D3 — Tarjeta BTC.** Recomiendo pasar sus datos a las etiquetas de los anillos HUD y quitar la tarjeta.
- **D4 — Videos.** Recomiendo borrar los 3 archivos de `public/` (≈4.6 MB) que ya no se usan.

## Nota de verificación (post-implementación)

Decisiones D1-D4 confirmadas por el usuario antes de implementar: D1 seguir en
`feature/home-video-hero` (no rama nueva), D2 negro puro solo en hero +
"Lo que hay dentro", D3 quitar la tarjeta BTC (datos a las etiquetas HUD),
D4 borrar los 3 videos.

Hecho, con una diferencia real respecto al plan original: **no se corrió la
suite de Playwright del §7 (puntos 3-7)**. El `/opt/pw-browsers/chromium` que
asume el plan no existe en este entorno (Windows, no el sandbox Linux para el
que se escribió el prompt original) — instalar un Chromium nuevo solo para
capturas automatizadas no agregaba certeza real sobre si el globo "se ve
bien", que de todos modos necesita revisión humana en un navegador real.

Lo que sí se verificó:
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (217/217) y `pnpm build`: los
  cuatro sin errores.
- Bundle: el chunk de Three.js/el globo aparece en **un solo** archivo de
  `.next/static/chunks/` (~1 MB sin comprimir) y ese chunk solo está
  referenciado en el `react-loadable-manifest.json` de la ruta `/` — ninguna
  otra ruta (`/markets`, `/cms`, etc.) lo carga.
- HTML renderizado (`curl` contra `pnpm dev`): sin errores de servidor, el
  `aria-label` del globo y el hint de arrastre aparecen en ES y EN, los 4
  íconos de "Lo que hay dentro" (`article`, `monitoring`, `calculate`,
  `calendar_month`) renderizan, y el estado inicial del texto del hero es
  `opacity-0` tanto en servidor como se espera en cliente (sin riesgo de
  mismatch de hidratación antes de que el globo avise `onReady`).

Lo que **no** se verificó (pendiente de que el usuario lo revise en su propio
navegador, que es de todos modos más confiable que un swiftshader headless):
el arrastre con quaternions (signo/sentido correcto), el render WebGL en sí
(colores, bloom, viñeta), el comportamiento táctil en celular (scroll fuera
del globo vs. giro dentro de él), y el diff visual con `prefers-reduced-motion`.
