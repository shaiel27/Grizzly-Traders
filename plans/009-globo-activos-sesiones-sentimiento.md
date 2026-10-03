# 009: Globo vivo y rediseño del portal de inicio

- **Estado**: PLAN, sin implementar
- **Base**: el globo que ya está en `feature/home-video-hero` (`components/globe/*`, planes 006–008)
- **Objetivo**:
  - **Parte A (§1–7)**: que el globo deje de ser decorativo y muestre datos reales: dónde están los activos, qué
    mercados están abiertos ahora y si el día es "risk-on" o "risk-off".
  - **Parte B (§8–14)**: mejoras de todo el portal de inicio y corrección de bugs:
    - transición difuminada entre el hero y la siguiente sección;
    - fondo y estrellas animados en la sección del globo;
    - rediseño de las 4 tarjetas;
    - scroll suave de "Ver más" sin que el destino quede bajo el header;
    - rediseño de las tarjetas "Pivot Points Diarios" y "VIP Terminal Ultra Algo";
    - otros bugs encontrados al revisar el código.

## 0. Lo que ya existe y condiciona el diseño

| Hecho en el código actual | Consecuencia para este plan |
|---|---|
| `muestrearTierra.ts` coloca los puntos con `x = cos(lat)·cos(lon)`, `z = cos(lat)·sin(lon)` | **El mapa está espejado este↔oeste.** Mirado desde la cámara (+z), lo que está al este queda a la izquierda. Hay que corregirlo **antes** de poner pines (§1.0); si no, el oro de Venezuela aparecería en el Pacífico. |
| Un `div` encima del canvas captura todos los Pointer Events para el arrastre (`GloboHolografico.tsx`, al final) | Los `onClick` de R3F en los meshes **nunca se disparan**. Los pines se detectan con un raycast manual desde ese mismo `div`, distinguiendo un toque de un arrastre (§1.3). |
| `lib/ticker.ts` ya cotiza `XAUUSD`, `XAGUSD`, `BRENT`, `WTI`, `NG`, `SPX`, `NDX`, `DJI`, `DAX`, `FTSE`, `NIKKEI` y `VIX`, con caché de 15 s y un endpoint `/api/ticker` que se consulta cada 3 s | Ya hay precios de casi todo. **Falta China** (no hay `SSE`/`HSI`) y quizá Australia (`XJO`). |
| `getPublishedPosts({ assetSymbol })` en `lib/api.ts` filtra noticias por activo (`post_activos` → `activos.symbol`) | Las noticias por activo salen sin tocar la base de datos. El seed de `supabase/schema.sql` solo tiene `XAUUSD`, `XAGUSD` y `SPX`: hay que confirmar en la base real qué símbolos existen (`BRENT`, `WTI`…). |
| `/markets?activo=XAUUSD` abre el terminal en un activo | Cada tarjeta lleva el enlace "Ver en el terminal". |
| La regla `react-hooks/purity` y la i18n en `lib/i18n/dictionaries/{es,en}.json` | Nada de `Date.now()` ni `Math.random()` en el render: la hora se lee en un efecto después de montar. Todos los textos nuevos van en es y en. |

## 1. Mapa de materias primas y activos (pines interactivos)

### 1.0 Corregir la orientación del planeta

- Crear `lib/globe/geo.ts` con `latLonAVector3(lat, lon, radio)` usando `z = -cos(lat)·sin(lon)`, y usarla en
  `muestrearTierra.ts`, en los pines y en las sesiones. Es la única fuente de verdad para posicionar cosas en el globo.
- Revisar la rotación inicial `rotY` para que al cargar se vea América/Atlántico, que es donde están Venezuela, Texas y
  Londres, y que el auto-giro siga yendo de oeste a este (un `rotY` positivo desplaza la superficie hacia la derecha).
- Test en `lib/globe/geo.test.ts`: con el meridiano L mirando a cámara, un punto en L+10° (al este) tiene `x > 0`;
  y Madrid, Caracas y Tokio caen sobre píxeles de tierra de la máscara.

### 1.1 Catálogo de pines: `lib/globe/marcadores.ts`

Datos puros y testeables. Cada pin define: `{ id, tipo: 'energia' | 'metal', simbolo, simboloNoticias, lat, lon, nombre (clave i18n) }`.

| Pin | Lugar (lat, lon) | Cotización |
|---|---|---|
| Petróleo Brent | Mar del Norte (58.5, 1.8) | `BRENT` |
| Petróleo WTI | Cushing, Oklahoma (35.98, −96.77). Es el punto de entrega real del WTI; Texas queda pegado. | `WTI` |
| Petróleo | Ghawar, Arabia Saudita (25.4, 49.6) | `BRENT` (referencia de Oriente Medio) |
| Oro | Arco Minero del Orinoco, Venezuela (7.0, −62.5) | `XAUUSD` |
| Oro | Witwatersrand, Sudáfrica (−26.2, 27.9) | `XAUUSD` |
| Oro | Kalgoorlie, Australia (−30.75, 121.47) | `XAUUSD` |
| Plata (opcional) | Zacatecas, México (22.77, −102.58) | `XAGUSD` |
| Gas natural (opcional) | Henry Hub, Luisiana (30.0, −92.1) | `NG` |

Máximo 8 pines, para que no se amontonen.

### 1.2 Aspecto en 3D: `components/globe/PinesActivos.tsx`

- Cada pin es un núcleo brillante (esfera de 0.018 con `toneMapped: false`) más un anillo que pulsa hacia fuera
  (plano orientado según la normal, shader radial) y una "aguja" corta de luz perpendicular a la superficie (línea
  de 0.08).
- Color por tipo: energía en ámbar (`--brand-amber` #f7b955) y metales en dorado claro (#ffd27a). Destacan del cian
  sin romper la paleta. La plata va en #d8e3f0.
- Los pines van dentro de `grupoGlobo`, así giran con el planeta. Los que están en la cara oculta se atenúan a 0.15:
  se calcula `dot(normalMundo, dirCámara)` en `useFrame` y se descartan del raycast.
- Hover y pin seleccionado: escala ×1.6 y un pulso más rápido. Con `prefers-reduced-motion`, sin pulsos.

### 1.3 Toque, hover y teclado

- `useArrastreGlobo.ts`: si entre `pointerdown` y `pointerup` hubo menos de 6 px de movimiento y menos de 300 ms, es
  un **toque**. En ese caso no se aplica inercia y se llama a `onToque(clientX, clientY)`.
- `GloboHolografico.tsx`: `onToque` convierte el punto a NDC, lanza un `Raycaster` contra esferas de impacto
  invisibles de radio 0.07 (más grandes que el pin, para que el dedo acierte) y elige el pin visible más cercano.
- Hover en escritorio: el mismo raycast en `pointermove` cuando no se está arrastrando, como máximo uno por frame.
  Pone el cursor en `pointer` y resalta el pin.
- Al seleccionar un pin:
  - el globo gira suavemente (slerp en ~700 ms) hasta centrarlo un poco a la izquierda, para dejar sitio a la tarjeta;
  - se pausa el auto-giro mientras la tarjeta esté abierta;
  - la tarjeta se cierra con Esc, con un toque fuera o al empezar a arrastrar.
- Accesibilidad: una lista de `<button>` visualmente oculta (`sr-only`, visible al recibir foco) con un botón por pin.
  Hace lo mismo que el toque. El `aria-label` del globo menciona que tiene marcadores.

### 1.4 Tarjeta emergente: `components/globe/TarjetaActivo.tsx` (HTML, fuera del canvas)

- Se posiciona proyectando la posición del pin a pantalla en `useFrame` y escribiendo `transform` en un ref, sin
  re-renders. En móvil va anclada abajo como bottom-sheet. Si el pin pasa a la cara oculta, se cierra.
- Contenido:
  - nombre del lugar y del activo ("Oro · Venezuela"), con el ícono del tipo;
  - precio y variación del día, con ▲/▼ y color `--semantic-success`/`--semantic-danger`, que se actualizan solos
    (§4);
  - las 3 últimas noticias del blog sobre ese activo: título, fecha relativa y enlace a `/articulos/[slug]`. Si no hay
    noticias, se muestra "Sin noticias recientes de este activo";
  - enlaces "Ver en el terminal" → `/markets?activo=XAUUSD` y "Todas las noticias" → la búsqueda o etiqueta del
    activo.
- Estética de holograma: fondo `rgba(5,12,20,0.85)` con `backdrop-blur`, borde cian al 30 % y una línea guía fina
  desde el pin hasta la tarjeta (SVG superpuesto).
- Las noticias se cargan al abrir la tarjeta con `GET /api/globe/news?symbol=XAUUSD&locale=es`. Es una ruta nueva y
  pública:
  - valida el símbolo con zod contra la lista de pines (y rechaza cualquier otro);
  - llama a `getPublishedPosts({ assetSymbol, limit: 3, locale })`;
  - responde con `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.

  En el cliente se cachea en un `Map` y se precarga al hacer hover. Mientras carga, se muestran 3 líneas skeleton.

## 2. Iluminación dinámica por sesiones de mercado

### 2.1 Lógica pura: `lib/globe/sesiones.ts`

- `estadoSesiones(ahora: Date)` devuelve, para cada centro, `{ id, abierto, abreEn, cierraEn }`. La hora local se
  calcula con `Intl.DateTimeFormat(..., { timeZone })`, así el horario de verano se aplica solo, sin tablas.
- Centros y horarios (convención de sesiones FX, en hora local):

| Sesión | Centros (nodo) | Horario local |
|---|---|---|
| Asia | Sídney (−33.87, 151.21), `Australia/Sydney` | 08:00–17:00 |
| Asia | Tokio (35.68, 139.69), `Asia/Tokyo` | 09:00–18:00 |
| Asia | Hong Kong / Singapur | 09:00–17:00 |
| Londres | Londres (51.51, −0.13), `Europe/London` | 08:00–17:00 |
| Londres | Fráncfort (50.11, 8.68), `Europe/Berlin` | 08:00–17:30 |
| Nueva York | Nueva York (40.71, −74.0), `America/New_York` | 08:00–17:00 |

- Fin de semana: el FX cierra desde el viernes a las 17:00 de NY hasta el domingo a las 17:00 de NY, y todo se
  muestra apagado. Los festivos quedan fuera (mejora futura: una lista en `lib/globe/festivos.ts`).
- Tests (vitest) con fechas fijas: solapamiento Londres–NY, cambio de horario de marzo y octubre, sábado
  (todo cerrado) y la apertura del domingo en Sídney.

### 2.2 Cómo se ve

- **Nodos de bolsa**: un punto por centro con su anillo y una etiqueta diminuta ("LONDRES"). Abierto: cian intenso
  (#4fc3ff) y pulso. Cerrado: gris azulado (#3a5068) al 40 %, sin pulso.
- **El detalle "pro"**: en el shader de los puntos de los continentes se añaden los uniforms
  `uCentros[8]` (dirección normalizada) y `uAbierto[8]` (0–1, interpolado). El brillo de cada punto se multiplica por
  `mix(0.45, 1.25, influencia)`, donde
  `influencia = max_i( smoothstep(cos(28°), 1.0, dot(normalPunto, uCentros[i])) * uAbierto[i] )`.
  Las regiones con mercado abierto brillan y las demás quedan apagadas, pero se siguen leyendo.
- **Opcional**: un terminador día/noche muy suave. Se calcula el punto subsolar a partir de la hora UTC y la
  declinación del día; la cara nocturna baja el brillo un 15 %. Si compite visualmente con las sesiones, se descarta.
- **Transiciones**: el estado se recalcula cada 30 s (`setInterval` dentro de un efecto, no en cada frame). `uAbierto`
  pasa de 0 a 1 en 2 s, así una apertura en directo se ve "encenderse".
- **Leyenda HTML** bajo el globo, en una línea con `aria-live="polite"`, renderizada solo en el cliente para evitar
  hydration mismatch: `● Londres abierta · cierra en 2 h 14 min   ● Nueva York abre en 37 min`.

## 3. Mapa de calor del sentimiento

### 3.1 Datos

- `lib/globe/sentimiento.ts` define las regiones y sus índices:

| Región | Índice principal | Respaldo |
|---|---|---|
| EE. UU. | `SPX` | `NDX`, `DJI` |
| Eurozona (DE, FR, IT, ES, NL, BE, AT, PT, IE, FI) | `DAX` | — |
| Reino Unido | `FTSE` | — |
| Japón | `NIKKEI` | — |
| China | **nuevo** `SSE` (`TVC:SHCOMP`) | `HSI` (`TVC:HSI`) |
| Australia (opcional) | **nuevo** `XJO` (`TVC:XJO`) | — |

- Los símbolos nuevos **no** se añaden a la barra del ticker (eso cambiaría el header). Van en una lista aparte
  `GLOBE_EXTRA` que se consulta con el mismo `scanTradingView` de `lib/markets.ts`.
- **Score risk-on/risk-off**: la media ponderada del % de los índices (EE. UU. 0.4, Europa 0.25, Japón 0.15,
  China 0.15, Reino Unido 0.05), penalizada si el `VIX` sube más de un 5 %. Se clasifica así:
  - `> +0.3` → RISK-ON;
  - `< −0.3` → RISK-OFF;
  - lo demás → NEUTRAL.

  Es una función pura y tiene tests.
- Si un mercado está cerrado (§2), el % es el del último cierre y la leyenda lo indica ("cierre").

### 3.2 Pintar los países, no manchas

- Se amplía `scripts/build-globe-mask.mjs` para que, además de la máscara, rasterice
  `world-atlas/countries-50m.json` en `public/globo/regiones-2048.png`. El canal R guarda el id de región
  (0 = ninguna, 1 = EE. UU., 2 = Eurozona, 3 = Reino Unido, 4 = Japón, 5 = China, 6 = Australia), sin antialias.
- `muestrearTierra.ts` lee también esa imagen y añade a cada punto un atributo `aRegion` (`Uint8`).
- En el shader se añade el uniform `uSentimiento[8]` (rango −1…+1, interpolado):
  - el % se normaliza con `clamp(cambio / 1.5 %, −1, 1)`;
  - el color es `mix(cian, verde #22c55e, s)` si `s > 0`, o `mix(cian, rojo #ff3b30, −s)` si `s < 0`, con una mezcla
    máxima de 0.65;
  - el resto del mundo sigue cian.

  Así EE. UU., Europa, Japón y China se tiñen con su propia silueta.
- Convivencia con §2: el **sentimiento decide el tono** y la **sesión decide el brillo**. Un mercado cerrado
  conserva su tono, pero apagado.
- **Indicador global**: un chip HUD bajo el globo, `RISK-ON ▲ +0.62` en verde, `RISK-OFF ▼` en rojo o `NEUTRAL` en
  cian. También se puede añadir como etiqueta de uno de los anillos HUD actuales, en lugar del "+x%" de BTC.
- **Daltonismo**: la información no depende solo del color. La leyenda y las tarjetas llevan ▲/▼ y el %, y al tocar
  una región teñida se abre una tarjeta como la de §1.4 con el índice, su % y sus noticias (`SPX`, `DAX`…).

## 4. Flujo de datos

- `app/(site)/page.tsx` ya llama a `getTickerSnapshot()` (cacheado). Se le pasan a `HomeHero` → `datosGlobo` solo las
  cotizaciones que usa el globo, para el primer pintado sin esperar al cliente.
- Ruta nueva `GET /api/globe`: devuelve `{ quotes, sentimiento, updatedAt }` y une el ticker con `GLOBE_EXTRA`. Se
  cachea 15 s con `unstable_cache` y `s-maxage=15`.
- El globo la consulta cada 30 s **solo mientras el hero está visible** (usa el mismo IntersectionObserver que ya
  existe) y con la pestaña activa (`document.visibilityState`).
- Todo el estado vive en refs o uniforms. La tarjeta y la leyenda son los únicos componentes de React que se
  re-renderizan.

## 5. Archivos

```
lib/globe/geo.ts (+ test)            lat/lon → Vector3 corregido
lib/globe/marcadores.ts              catálogo de pines
lib/globe/sesiones.ts (+ test)       horarios y estado abierto/cerrado
lib/globe/sentimiento.ts (+ test)    regiones, índices y score risk-on/off
app/api/globe/route.ts               cotizaciones del globo + sentimiento
app/api/globe/news/route.ts          3 noticias por símbolo
components/globe/PinesActivos.tsx
components/globe/NodosSesion.tsx
components/globe/TarjetaActivo.tsx
components/globe/LeyendaGlobo.tsx    sesiones + risk-on/off
components/globe/shaders.ts          uniforms de sesión y sentimiento + aRegion
components/globe/muestrearTierra.ts  orientación corregida + aRegion
components/globe/useArrastreGlobo.ts toque vs arrastre, pausa del auto-giro
scripts/build-globe-mask.mjs         + regiones-2048.png
lib/i18n/dictionaries/{es,en}.json   textos nuevos
```

## 6. Orden de implementación (un commit por paso)

1. Corregir la orientación con `lib/globe/geo.ts` y su test, y comprobar visualmente que el mapa ya no está espejado.
2. Sesiones: lógica + nodos + atenuación por región + leyenda. No necesita datos externos, así que es el paso más
   seguro.
3. Pines 3D, toque vs arrastre y raycast.
4. Tarjeta + `/api/globe/news` + precios en vivo (`/api/globe`).
5. Máscara de regiones + `aRegion` + sentimiento + chip risk-on/off.
6. Pulido: accesibilidad, reduced-motion, i18n y rendimiento.

## 7. Verificación

- `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` sin errores. Reportar el tamaño del chunk del globo antes y
  después (meta: < +25 kB gzip).
- Playwright a 1440×900 y 390×844:
  - **orientación**: con el globo girado a lon −60°, Sudamérica está a la izquierda de África;
  - **sesiones**: con `page.clock.setFixedTime`, a las 14:00 UTC de un martes (Londres + NY abiertos) y a las
    02:00 UTC (Tokio + Sídney). Tomar capturas y comprobar que el brillo medio de la caja de Europa es mayor en la
    primera. Un sábado, todo apagado;
  - **pines**: llevar el globo al oro de Venezuela (helper solo en dev `window.__globo.enfocar('oro-venezuela')`) y
    hacer clic en su proyección. La tarjeta aparece con el precio de `XAUUSD` y ≤ 3 noticias (o el mensaje vacío),
    y el enlace del terminal lleva a `/markets?activo=XAUUSD`;
  - **toque vs arrastre**: arrastrar 200 px empezando sobre un pin gira el globo y NO abre la tarjeta;
  - **sentimiento**: interceptar `/api/globe` con `page.route` (SPX +2 %, DAX −2 %) y comprobar que el tono medio de
    EE. UU. es verde y el de Alemania rojo. El chip dice lo que corresponde según el score;
  - **teclado**: Tab llega a la lista de pines, Enter abre la tarjeta y Esc la cierra;
  - con `reducedMotion: 'reduce'` no hay pulsos ni auto-giro, pero los colores y las tarjetas funcionan.
- Mostrarme las capturas: sesión asiática vs Londres/NY, tarjeta del oro abierta (escritorio y móvil) y heatmap en
  risk-on y en risk-off.

---

# Parte B: Mejoras del portal de inicio y corrección de bugs

Revisado sobre `components/modules/HomeHero.tsx`, `components/modules/HomeFeatures.tsx`, `app/(site)/page.tsx`,
`components/ui/Header.tsx`, `components/globe/GloboHolografico.tsx` y `app/globals.css` (commit `d055d54`).

## 8. Bugs encontrados (causa → corrección)

| # | Bug | Causa en el código | Corrección |
|---|---|---|---|
| B1 | **"Ver más" salta de golpe** en vez de desplazarse | Es un `<a href="#lo-que-hay-dentro">` que depende de `html { scroll-behavior: smooth }`. El bloque global de `prefers-reduced-motion` (globals.css) lo convierte en `scroll-behavior: auto !important`. **Windows con "efectos de animación" desactivados reporta `reduce`**: el propio globals.css lo advierte junto al ticker. En esas máquinas el salto siempre es instantáneo. | Scroll animado en JS (§9), independiente de `scroll-behavior` del CSS. |
| B2 | **Después de "Ver más", el destino queda bajo el header** | `--header-height` está fijo en 136 px (md+) y `--header-scroll-offset` en 156 px, pero el header real mide 32 (ticker) + 64 + 40 + **3 bordes de 1 px** = 139 px, y crece más con zoom del navegador, fuentes del sistema más grandes o el menú móvil abierto. Además, el destino es el `div` de la cuadrícula, sin aire arriba. | Medir el header real (§9.1) y calcular el destino con ese valor. |
| B3 | **El título del hero queda cortado bajo el header** (visto en las capturas) | Es la misma causa que B2: `mt-[var(--header-height)]` usa el valor fijo, no la altura real. | §9.1 corrige ambos. |
| B4 | **Las estrellas acaban en un cuadrado** | `<CampoEstrellas>` vive dentro del `<Canvas>` del globo, que es una caja cuadrada de como máximo 780 px. Fuera de ella, la sección es negro plano y en pantallas anchas se nota el borde del campo de estrellas. Además gira a 0.004 rad/s, imperceptible: "no están animadas". | Llevar el fondo a una capa de toda la sección (§10). |
| B5 | **Corte brusco entre el hero (#000) y el resto de la home (`--canvas` #090909)** | La sección termina en `bg-black` y `<main>` empieza en `canvas`, sin transición. | Difuminado inferior (§10.4). |
| B6 | **Texto y globo se solapan en portátiles de 1280–1366 px** | El texto es `lg:absolute` con `max-w-2xl` desde la izquierda, y el globo `lg:absolute` en `left-[60%]` con ancho `min(82vh,780px)`. A 1280×720 el globo empieza en ~x=508 y el texto llega a ~x=712. | Grid de 2 columnas en vez de dos `absolute` (§11.1). |
| B7 | **La tarjeta de Pivot Points tiene el adorno de la derecha desalineado** | `className="hidden lg:block … flex items-center justify-center"`: `lg:block` anula el `flex`, así que el contenido no se centra. | Se resuelve con el rediseño (§12.1). |
| B8 | **La tarjeta VIP dice "Actualización de precios: cada 30 s"** | El ticker consulta `/api/ticker` cada **3 s** con un TTL de 2 s (lib/ticker.ts), así que el dato es falso. Además "el portal en cifras" muestra una sola cifra. | Usar cifras reales calculadas en el servidor (§12.2). |
| B9 | **Textos en inglés dentro de `es.json`** | `vipCta` y `vipJoin` dicen "Join VIP Terminal" también en español, igual que el botón del header. | Traducirlos ("Unirse al VIP Terminal") y revisar el resto con un test que marque los valores idénticos en es y en, con lista blanca para nombres propios. |
| B10 | **La tarjeta VIP puede quedarse sin ningún botón** | Si `NEXT_PUBLIC_VIP_URL` y `NEXT_PUBLIC_TELEGRAM_URL` están vacías, la tarjeta se muestra sin acción. | Fallback a la suscripción del newsletter (`NewsletterForm`, que ya existe) u ocultar la sección. |
| B11 | **Recargar con `#lo-que-hay-dentro` en la URL abre la home a mitad del hero**, con el globo fuera de pantalla y la entrada a medias | El ancla deja el hash en la URL. | §9: el botón no deja el hash (`history.replaceState`), aunque el enlace sigue funcionando sin JS. |
| B12 | **El globo se escala con el scroll y vuelve a escalar en cada `resize`** | El efecto del scroll lee `window.innerHeight`, que en móvil cambia al mostrar/ocultar la barra del navegador y produce saltos. | Usar `visualViewport` o un alto fijado al montar, y actualizarlo solo si el ancho cambia. |

Antes de corregir cada bug, se reproduce con Playwright (§14) para dejar constancia de la causa.

## 9. "Ver más": desplazamiento suave y destino correcto

### 9.1 Altura real del header (corrige B2 y B3)

- En `components/ui/Header.tsx`, un `ResizeObserver` sobre el `<header>` escribe la altura medida en
  `document.documentElement.style.setProperty('--header-h-real', px)`. Se actualiza al abrir/cerrar el menú
  móvil, al cambiar de breakpoint y con zoom.
- En `globals.css`, el hero y `scroll-margin` usan `var(--header-h-real, var(--header-height))`, así el valor fijo
  queda solo como respaldo antes de hidratar. `--header-scroll-offset` pasa a ser
  `calc(var(--header-h-real, var(--header-height)) + 24px)`.
- Además, `html { scroll-padding-top: var(--header-scroll-offset) }`, para que cualquier ancla del sitio (no solo esta)
  respete el header.

### 9.2 Scroll animado: `lib/scroll.ts` → `scrollSuaveA(elemento, { duracion, offset })`

- `requestAnimationFrame` con easing `--ease-in-out` (cubic-bezier 0.77,0,0.175,1, implementado en JS). La duración
  es proporcional a la distancia: `clamp(450, distancia * 0.6, 900)` ms.
- Destino: `elemento.getBoundingClientRect().top + scrollY - alturaHeaderReal - 24`. **Se recalcula en cada frame**,
  porque el globo se encoge con el scroll y las tarjetas entran con animación. Así no se pasa ni se queda corto.
- Se cancela si el usuario toca la rueda, la pantalla o una tecla (`wheel`, `touchstart` y `keydown` con
  `{ once: true }`), para no pelear con él.
- Al terminar, el foco va al primer elemento de las tarjetas (`focus({ preventScroll: true })`) para teclado y lector
  de pantalla, y se usa `history.replaceState` sin hash (B11).
- **Movimiento reducido**: la animación pasa a 250 ms con easing suave, en vez de un salto, porque un salto
  instantáneo desorienta más que un desplazamiento corto. Ver la decisión D5.
- El botón sigue siendo `<a href="#lo-que-hay-dentro">` y el `onClick` hace `preventDefault()` + `scrollSuaveA`.
  Sin JS, el ancla funciona igual.

### 9.3 Mientras se desplaza

- Mientras dura el desplazamiento, el `IntersectionObserver` de las tarjetas no debe dispararlas a medias: se
  revelan cuando el scroll termina, o al 60 % del recorrido, para que se vea la entrada escalonada.
- El globo pasa a `frameloop="demand"` durante el scroll programático, para liberar GPU y que el scroll vaya a 60 fps.

## 10. Fondo de la sección del globo y estrellas animadas (corrige B4 y B5)

Las estrellas salen del `<Canvas>` del globo y pasan a una capa de toda la sección. Es la versión acotada del
fondo del plan 007 §3, a la que se suma el campo de estrellas.

### 10.1 `components/globe/FondoHero.tsx`: un canvas 2D a pantalla completa de la sección

- `absolute inset-0 -z-10`, `pointer-events: none`, `dpr` como máximo 1.5.
- **Estrellas en 3 capas de profundidad** (lejos/medio/cerca): 120/60/25 en escritorio y la mitad en móvil. Tamaños
  de 0.6, 1 y 1.6 px, en blanco y en `#7fd4ff`.
  - **Titileo**: cada estrella tiene su fase y su periodo (2–6 s) y su opacidad oscila entre 0.2 y 1.
  - **Deriva lenta** hacia la izquierda, más rápida cuanto más cerca está la capa (parallax): 2, 5 y 9 px/s.
  - **Parallax con el puntero y con el arrastre del globo** (como máximo 6, 12 y 20 px por capa). Comparte el estado
    de `useArrastreGlobo` a través de un ref.
  - **Estrella fugaz** ocasional: una cada 8–15 s, una línea con estela cian de 300 ms, nunca sobre el texto.
- **Polvo de datos**, opcional y del plan 007: unas pocas velas y una curva tenue con los colores del sitio, a menos
  del 10 % de opacidad. Si recarga visualmente, se descarta.
- Se pausa con `IntersectionObserver` y con `document.hidden`. PRNG con semilla, nada de `Math.random()` en el render.
- `prefers-reduced-motion`: un único frame estático, sin titileo ni deriva.

### 10.2 Quitar `<CampoEstrellas>` del canvas del globo

El canvas vuelve a dibujar solo el globo. Se ahorran 2200 puntos más el bloom sobre ellos.

### 10.3 Resplandores

Los 2 glows de esquina (`hero-glow-a/b`) se conservan. Se añade un halo cian muy suave detrás del globo, que se mueve
con él (su escala con el scroll) y respira a la vez que la base holográfica.

### 10.4 Difuminado hacia la siguiente sección

- El último tramo de la sección, de 220 px en escritorio y 140 px en móvil, lleva un degradado
  `linear-gradient(to bottom, transparent, var(--canvas))`. Va por encima del fondo y de las estrellas y por debajo
  de las tarjetas.
- Las estrellas y el polvo se desvanecen hacia abajo con `mask-image: linear-gradient(to bottom, black 70%, transparent)`,
  para que no "choquen" con el borde.
- El `<main>` siguiente empieza en `--canvas` sin borde ni margen que delate el corte.
- Las esquinas superiores del hero siguen en negro puro (verificación del plan 006).

## 11. Hero: maquetación

### 11.1 Grid en vez de posiciones absolutas (corrige B6)

- Desde `lg`: `grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-center gap-8` dentro de `max-w-[1320px] mx-auto`,
  con una altura mínima de `calc(100svh - var(--header-h-real))`.
- El globo queda en su columna con `aspect-square w-full max-w-[min(78vh,720px)] justify-self-center`.
- En móvil se mantiene el apilado actual.
- Se comprueba que no haya solapes a 1280×720, 1366×768, 1440×900, 1920×1080 y 390×844.

### 11.2 Indicador de scroll

Al pie del hero, un pequeño "mouse" o chevron que baja suavemente. Al hacer clic, hace lo mismo que "Ver más" y
desaparece en cuanto `scrollY > 40`.

## 12. Rediseño de las 4 tarjetas ("Lo que hay dentro")

Objetivo: tarjetas que **muestren** lo que hay dentro en vez de describirlo. Cada una lleva una mini vista previa
viva, con estilo bento moderno coherente con el holograma.

### 12.1 Estructura

- **Bento** en escritorio: 2 tarjetas grandes y 2 medianas (`grid-cols-6`, con spans 3/3/2/4 o 4/2/2/4), para que no
  sean 4 cajas iguales. En tablet van 2×2 y en móvil en una columna, o en un carrusel horizontal con `scroll-snap`
  (decisión D6).
- Cada tarjeta tiene:
  1. cabecera con ícono, título y una flecha `arrow_outward` que se desplaza en hover;
  2. una **vista previa animada** que ocupa ~55 % de la altura;
  3. la descripción breve actual.

| Tarjeta | Vista previa (datos reales del servidor, sin pedidos extra) |
|---|---|
| Noticias verificadas | Los 3 últimos titulares (de los `latest` que `page.tsx` ya carga) rotan cada 4 s con una transición vertical, cada uno con su chip de sentimiento (▲/▼/●) y hora relativa. |
| Terminal de mercados | Mini-sparkline SVG de BTC, oro y S&P 500 con su % del día (datos del `getTickerSnapshot()` ya cacheado). La línea se dibuja con `stroke-dashoffset` al entrar en pantalla. |
| Puntos pivote | Una "escalera" R3…S3 de BTC con el precio actual marcado entre niveles. Se reutiliza `calculatePivots` (lib/pivots.ts) con datos de `getPivotQuotes('D')` (cacheado). |
| Calendario económico | El próximo evento de alto impacto, con su cuenta atrás en vivo (hh:mm:ss) y la bandera del país (de `/api/economic-calendar`, cacheado; si falla, se oculta la vista previa). |

### 12.2 Estilo

- Fondo `rgba(255,255,255,0.025)` con un degradado radial cian muy tenue desde la esquina del ícono, y borde de 1 px
  con **borde animado en hover**: un `conic-gradient` cian que gira dentro de una máscara de borde (técnica
  `mask-composite: exclude`). Así se sustituye la franja `feature-card-shimmer` en bucle, que distrae cuando las 4
  se mueven a la vez.
- **Spotlight** que sigue al cursor: un radial-gradient de 220 px en la posición del mouse (variables CSS `--mx/--my`
  escritas en `pointermove`, sin re-renders).
- En hover: un leve tilt 3D (como máximo 4°, con `perspective`), la tarjeta sube 4 px y la vista previa se acelera
  un poco.
- Entrada: aparición escalonada (80 ms) al quedar visibles. Se conserva el `IntersectionObserver` actual, con el
  ajuste de §9.3.
- Se eliminan los números "01–04" de fondo: con las vistas previas sobran.
- Accesibilidad: toda la tarjeta sigue siendo un solo `<Link>`. Las vistas previas llevan `aria-hidden`, salvo el
  titular, que se lee. Hay foco visible con anillo cian y, con movimiento reducido, todo es estático.

## 13. Tarjetas del final: "Pivot Points Diarios" y "VIP Terminal Ultra Algo"

### 13.1 Pivot Points Diarios (corrige B7)

- Panel de 2 columnas:
  - **izquierda**: título, descripción, chips de los 5 métodos (Clásico, Fibonacci, Camarilla, Woodie, DeMark),
    seleccionables;
  - **derecha**: una **escalera de niveles en vivo** para un activo seleccionable (BTC, EUR/USD, XAU/USD) con
    pestañas tipo segmento.
- La escalera muestra R3…S3 en una regla vertical, el pivote P resaltado y **el precio actual como un marcador que
  se desplaza** entre niveles. Al cambiar de método, los niveles se reacomodan con una transición de 300 ms.
- Se reutiliza `components/ui/PivotLadder.tsx`, si su API lo permite, en una variante compacta. Los datos son
  `getPivotQuotes('D')` (cacheado) más el precio del ticker.
- CTA principal "Abrir Pivot Points" → `/pivot-points?activo=…` con el activo y el método elegidos.
- Si los datos fallan, se muestra la escalera con un ejemplo estático y la etiqueta "ejemplo", nunca una caja vacía.

### 13.2 VIP Terminal Ultra Algo (corrige B8, B9 y B10)

- Estética "premium": borde con degradado ámbar→magenta animado (conic, 8 s por vuelta), fondo oscuro con un halo
  ámbar (`--brand-amber`) muy suave y la insignia "VIP Terminal Ultra Algo" con un brillo que pasa una vez al entrar
  en pantalla.
- Columna izquierda: título, lead y **3 beneficios con ícono** (alertas en tiempo real, análisis con IA, comunidad
  privada), en vez de un solo párrafo.
- Columna derecha: un **"terminal" de muestra**, una ventana tipo consola con 3–4 líneas de alertas de ejemplo que se
  escriben solas, con efecto de typing (por ejemplo `▲ XAU/USD rompe R1 · 2,401.3`) y la etiqueta "Ejemplo".
  Sustituye a la tabla "el portal en cifras".
- Si se quieren cifras, que sean reales (B8): noticias publicadas, activos cubiertos y fuentes, con los conteos que
  `page.tsx` ya calcula.
- CTAs: "Unirse al VIP Terminal" (texto traducido, B9) y Telegram. **Sin URLs configuradas** (B10), se muestra el
  formulario del newsletter como alternativa.
- Movimiento reducido: sin typing (las líneas aparecen completas) y sin borde girando.

## 14. Verificación de la Parte B

- `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` sin errores. Se añaden tests de `scrollSuaveA` (cálculo
  del destino) y del chequeo de i18n (B9).
- Playwright a 1280×720, 1366×768, 1440×900, 1920×1080 y 390×844 (`hasTouch`):
  - **B1**: con `reducedMotion: 'no-preference'` **y** con `'reduce'`, clic en "Ver más" → registrar `scrollY` cada
    frame. Debe haber ≥ 10 valores intermedios distintos (no un salto), terminar en ≤ 900 ms y sin hash en la URL.
  - **B2/B3**: al terminar, `tarjetas.getBoundingClientRect().top >= header.getBoundingClientRect().bottom + 16`,
    también con zoom 125 % (`deviceScaleFactor` + CSS zoom) y con el menú móvil abierto. El `top` del H1 está por
    debajo del `bottom` del header.
  - **B4**: en 1920×1080 hay estrellas en las 4 franjas laterales fuera de la caja del globo, y dos capturas separadas
    1 s difieren en la zona de estrellas (están animadas). Con `reduce`, son idénticas.
  - **B5**: la columna central de píxeles de los últimos 220 px del hero pasa de forma monótona de #000 a #090909, sin
    saltos de más de 2 niveles por fila.
  - **B6**: las cajas del texto y del globo no se intersecan en ninguna resolución.
  - Las tarjetas muestran sus vistas previas con datos (o su fallback) y el spotlight y el tilt responden al hover.
  - Pivot: cambiar el método modifica los valores de la escalera. VIP: sin variables de entorno de URLs aparece el
    newsletter.
  - No hay scroll horizontal en ninguna resolución. La consola no muestra errores.
- Rendimiento: con el globo + el fondo + las tarjetas animadas, el *Performance trace* de Chrome a 1440×900 sostiene
  ≥ 55 fps en scroll. Si no, se reduce el fondo primero.
- Mostrar capturas antes/después de: el hero completo, la transición hero→contenido, las tarjetas, Pivot y VIP, y un
  GIF o secuencia del scroll de "Ver más".

## 15. Orden de implementación (todo el plan)

1. **Bugs de base**: altura real del header (B2/B3), scroll suave (B1/B11), grid del hero (B6), viewport (B12). Es
   lo que más se nota y desbloquea el resto.
2. **Fondo de la sección**: estrellas fuera del canvas (B4) y difuminado (B5).
3. **Rediseño de las 4 tarjetas**.
4. **Pivot y VIP** (B7–B10).
5. **Parte A**: orientación → sesiones → pines → tarjeta de activo → sentimiento (ver §6).

Un commit por paso, mensajes en español y sin push sin confirmación.

## Decisiones abiertas

- **D1 — Activos en la base de datos.** ¿Existen `BRENT`, `WTI` y los índices en la tabla `activos` y tienen
  noticias asociadas? Si no, la tarjeta mostrará "sin noticias". Recomiendo revisarlo con una consulta antes del paso 4
  (puedo hacerlo yo con el conector de Supabase si me lo permites).
- **D2 — Todo a la vez o con selector.** Recomiendo mostrar las tres capas combinadas (tono = sentimiento, brillo =
  sesión, pines encima). La alternativa es un selector `Activos | Sesiones | Sentimiento` bajo el globo, más claro
  pero menos "vivo".
- **D3 — China y Australia.** Añadir `SSE` (o `HSI`) y `XJO` solo para el globo. Recomiendo `SSE` + `XJO`.
- **D4 — Terminador día/noche.** Probarlo y quedarse con él solo si no compite con las sesiones.
- **D5 — Scroll con movimiento reducido.** Recomiendo un desplazamiento corto (250 ms) en vez de un salto, porque
  en Windows "reduce" suele estar activo sin que el usuario lo sepa. La alternativa estricta es un salto
  instantáneo pero con el destino ya bien calculado (B2).
- **D6 — Tarjetas en móvil.** Recomiendo una columna (más legible). La alternativa es un carrusel horizontal con
  scroll-snap (más compacto).
- **D7 — Terminal VIP de muestra.** Confirmar que se pueden mostrar alertas de ejemplo, etiquetadas como "Ejemplo",
  o si se prefieren solo los beneficios.
