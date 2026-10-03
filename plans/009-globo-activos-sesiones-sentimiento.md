# 009: Globo vivo. Mapa de activos, sesiones de mercado y sentimiento

- **Estado**: PLAN, sin implementar
- **Base**: el globo que ya está en `feature/home-video-hero` (`components/globe/*`, planes 006–008)
- **Objetivo**: que el globo deje de ser decorativo y muestre datos reales: dónde están los activos, qué mercados
  están abiertos ahora y si el día es "risk-on" o "risk-off".

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

## Decisiones abiertas

- **D1 — Activos en la base de datos.** ¿Existen `BRENT`, `WTI` y los índices en la tabla `activos` y tienen
  noticias asociadas? Si no, la tarjeta mostrará "sin noticias". Recomiendo revisarlo con una consulta antes del paso 4
  (puedo hacerlo yo con el conector de Supabase si me lo permites).
- **D2 — Todo a la vez o con selector.** Recomiendo mostrar las tres capas combinadas (tono = sentimiento, brillo =
  sesión, pines encima). La alternativa es un selector `Activos | Sesiones | Sentimiento` bajo el globo, más claro
  pero menos "vivo".
- **D3 — China y Australia.** Añadir `SSE` (o `HSI`) y `XJO` solo para el globo. Recomiendo `SSE` + `XJO`.
- **D4 — Terminador día/noche.** Probarlo y quedarse con él solo si no compite con las sesiones.
