# 007: Prompt para corregir la carga del globo, añadir un fondo animado y mejorar su aspecto

Copia el bloque de abajo tal cual en la sesión que tiene el código del globo. Es la continuación del
[plan 006](006-home-globo-holografico.md).

---

```text
Contexto: Grizzly Traders (Next.js 16 App Router, React 19, Tailwind v4, three + @react-three/fiber + drei +
@react-three/postprocessing). El hero de la home (components/modules/HomeHero.tsx) ya muestra el globo holográfico
(components/globe/*) según plans/006-home-globo-holografico.md. Antes de tocar nada, lee esos archivos,
app/globals.css, components/ui/Header.tsx y la guía de next/dynamic en node_modules/next/dist/docs/.

En dos capturas a 1440 px de ancho se ven estos problemas:
A) Mientras carga, el canvas aparece como un RECTÁNGULO BLANCO de ~760×700 px con esquinas cian, a la derecha del
   texto.
B) Cuando termina de cargar:
   - la esfera es GRIS OPACA y lisa: no se ven los continentes de puntos ni la retícula;
   - alrededor hay una MANCHA BLANCA saturada con forma de lóbulos/nube, en lugar de un halo cian fino;
   - los anillos HUD se ven bien, pero sus etiquetas se solapan ("133 NOTICIAS · 1… ACTIVOS");
   - el fondo es negro plano y la sección se ve vacía.
C) Maquetación:
   - el H1 se parte en 7 líneas de una o dos palabras ("La / inteligencia / de / mercado…");
   - la primera línea queda tapada por el header fijo;
   - el botón "Ver las noticias de hoy" se parte en dos líneas;
   - el globo está desplazado a la derecha y recortado por el borde del viewport.

Trabaja en la rama actual. Haz commits en español, uno por bloque, y NO hagas push sin preguntarme.

## 1. Diagnóstico (primero confírmalo, después corrige)

Hipótesis, en orden de probabilidad. Comprueba cada una antes de cambiar código:

1. NaN en los shaders → el bloom lo propaga en blanco. En GLSL, `pow(x, y)` con x < 0 es indefinido (NaN o Inf
   en muchas GPU), y en la atmósfera `pow(0.65 - dot(N, V), 2.5)` la base se vuelve negativa en el centro. El
   mipmapBlur del Bloom extiende un solo píxel NaN/Inf a toda la textura: eso explica tanto el rectángulo blanco
   como la nube de lóbulos.
   Corrección: `pow(max(x, 0.0), y)` en TODOS los shaders, normalizar `N` y `V` en el fragment, y limitar la
   salida con `gl_FragColor = vec4(min(color, vec3(4.0)), alpha)`.
   Verificación: pon temporalmente `return vec4(isnan(c.r) || isinf(c.r) ? 1.0 : 0.0, 0, 0, 1)` y mira si hay rojo.
2. El canvas pinta antes de tener estado válido. El primer frame del EffectComposer llega antes de cargar la
   máscara y los uniforms y lee un render target sin inicializar.
   Corrección: no montar el <EffectComposer> hasta que `listo === true` (textura cargada y buffer de puntos creado).
   Hasta entonces, el canvas lleva `style={{ opacity: 0 }}` y debajo queda el fallback CSS (ver §2).
3. Espacio de color y tone mapping. La esfera base sale gris porque su material no es transparente o porque el
   tone mapping ACES la aclara.
   Corrección: en la esfera base `transparent: true, depthWrite: false, blending: NormalBlending` y alfa ≤ 0.35.
   En todo lo que brilla, `toneMapped: false`. En el Canvas,
   `gl={{ alpha: false, antialias: true, toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace }}`
   y `onCreated` con `setClearColor('#000000', 1)`.
4. Los puntos de los continentes no se dibujan. Comprueba en este orden:
   - que la máscara se lea DESPUÉS de `img.decode()`;
   - que `getImageData` no devuelva todo ceros (con CSP `img-src 'self'` debe salir de /globo/);
   - que `geometry.setAttribute('position', …)` tenga 40–60k puntos (haz un console.log en dev);
   - que `gl_PointSize` no sea < 1 px (usa `max(1.5, …)` y multiplícalo por `uDpr`);
   - que la esfera base no los tape. Debe dibujarse antes (`renderOrder` −1) y con `depthWrite: false`.

Documenta en el commit qué hipótesis resultó cierta.

## 2. Animación de carga (sustituye al rectángulo blanco)

Objetivo: el usuario nunca ve un frame blanco ni gris. Mientras carga el chunk o la textura, ve un "arranque del
proyector" que se funde sin cortes con el globo real.

- Componente `components/globe/GloboCargando.tsx`, solo CSS/SVG y sin JS de animación, que sirve a la vez de fallback
  de `next/dynamic` y de capa mientras `listo === false`. Ocupa exactamente la misma caja que el canvas, para que no
  haya saltos de layout. Contiene:
  1. la base elíptica luminosa (`radial-gradient` cian `#4fc3ff` → transparente, `blur(8px)`) con un pulso suave
     (`opacity 0.4 ↔ 0.8`, 1.6 s);
  2. un círculo SVG del tamaño del globo con trazo cian 1 px y `stroke-dasharray` que se dibuja en bucle
     (`stroke-dashoffset`, 1.4 s, `--ease-in-out`);
  3. un barrido de escaneo horizontal: una línea de 1 px con brillo que sube y baja dentro del círculo, recortada con
     `clip-path: circle()`;
  4. un texto diminuto en mono `#7fd4ff` al 60 %: "INICIALIZANDO PROYECCIÓN…" / "INITIALIZING PROJECTION…" (i18n),
     con tres puntos que parpadean.
- Transición: cuando `listo` pasa a `true`, el canvas hace fade-in en 500 ms y `GloboCargando` hace fade-out a la vez.
  El círculo SVG escala de 1 a 1.04 al desaparecer, para que parezca que "se convierte" en el globo. Arranca la
  secuencia de entrada del plan 006 (base → globo desde 0.6 → anillos → textos).
- Sin WebGL o con error en `onCreated`: `GloboCargando` se queda en estado estático (sin bucles) y se oculta la pista
  "Arrastra para girar".
- Timeout de 6 s: si no hay `listo`, se muestra el mismo estado estático y se registra un `console.warn` en dev.
- `prefers-reduced-motion`: sin bucles. Solo el círculo y la base fijos. El global de app/globals.css ya anula las
  animaciones CSS; comprueba que cubra estas.

## 3. Fondo animado para toda la sección del hero: recreación del video original con la paleta del sitio

El hero tenía un video (public/market-loop-1080p.{mp4,webm}, 24 s en bucle). Quiero el MISMO tipo de animación,
recreada en código y con los colores de app/globals.css. Antes de empezar, extrae fotogramas del video con
`ffmpeg -i public/market-loop-1080p.mp4 -vf "fps=1/2,scale=640:-1,tile=4x3" -frames:v 1 frames.png` y míralos.
Esto es lo que contiene, de atrás hacia delante:

1. Fondo casi negro con un resplandor violeta difuso en la esquina superior izquierda y otro naranja muy leve abajo
   a la derecha.
2. Una cuadrícula muy tenue, con líneas verticales y horizontales casi invisibles.
3. 3–4 líneas onduladas, finas y desenfocadas, que cruzan la pantalla de lado a lado y ondulan despacio (como
   curvas de precio).
4. Una fila de velas japonesas, solo el cuerpo y la mecha y sin relleno de fondo, a ~55–65 % de la altura. Se
   desplaza horizontalmente de derecha a izquierda, con profundidad de campo: unas nítidas y otras desenfocadas.
   La mayoría son azules y alguna violeta.
5. Bokeh: 6–10 círculos grandes y desenfocados (40–120 px, blur alto) azules/violetas, que flotan despacio y
   aparecen y desaparecen.
6. Pequeños guiones y cifras horizontales tipo "ticker", muy tenues, repartidos por la pantalla.

Paleta (usa los tokens, no hex sueltos):
- Velas alcistas `--accent-blue` (#0099ff) y velas bajistas `--gradient-violet` (#6a4cf5). Alguna, de vez en cuando,
  en `--accent-cyan` (#4fc3ff) para enlazar con el globo.
- Líneas onduladas: `--accent-cyan` al 10–18 %.
- Bokeh: `--accent-blue`, `--gradient-violet` y `--gradient-magenta` (#d44df0) al 8–20 %.
- Resplandor de esquina: `--gradient-violet` al 18 %. El naranja del video se cambia por `--gradient-magenta` al 6 %.
- Cuadrícula y cifras: blanco al 3–5 %.
- Opacidad global de la capa ≤ 0.55. Debe quedar tan oscuro como el video (mira la luminancia media de los
  fotogramas y apunta a la misma, ±10 %).

Implementación:
- Componente `components/globe/FondoMercado.tsx` ('use client'): un `<canvas>` 2D a pantalla completa de la
  sección, `absolute inset-0 -z-10` y `pointer-events: none`, FUERA de la escena de Three (el bloom lo
  blanquearía). Las velas se generan con un random walk de PRNG con semilla (mulberry32), así que nada de
  `Math.random()` en el render (`react-hooks/purity`). El buffer es circular: la vela que sale por la izquierda se
  recicla por la derecha.
- Desenfoque: dos pasadas a dos canvas (capa "lejos" con `ctx.filter = 'blur(6px)'` y opacidad baja, capa "cerca"
  nítida) que se precalculan cada N frames si `filter` resulta caro. El bokeh se dibuja con `createRadialGradient`
  en vez de `filter`.
- Velocidad: las velas recorren el ancho de la pantalla en ~40 s. Las líneas onduladas desfasan `sin(x*f + t*w)`
  con periodos de 10–20 s. El bokeh deriva a ~6 px/s.
- Las esquinas del hero deben dar EXACTAMENTE rgb(0,0,0): aplica sobre la capa una `mask-image` radial/lineal que
  llegue a transparente en los bordes. El resplandor violeta del video queda dentro, sin tocar la esquina misma.
- Deja una "ventana" más oscura detrás del globo (máscara radial) para que el globo destaque y las velas pasen por
  detrás sin competir con él.
- Parallax mínimo: como máximo 8 px según el puntero o el arrastre del globo (`requestAnimationFrame`, sin
  re-renders).
- Rendimiento: pausa con IntersectionObserver y `document.hidden`. `dpr` como máximo 1.5 (el desenfoque esconde la
  resolución), < 2 ms por frame en escritorio. En móvil, la mitad de las velas y del bokeh.
- `prefers-reduced-motion`: se pinta un único frame estático.
- Cuando esté listo, borra `public/market-loop-1080p.{mp4,webm}` y `market-loop-poster.jpg` si nada más los usa
  (`grep -rn market-loop`).
- Verificación extra: una captura del video original y otra del fondo nuevo a 1440×900, en paralelo, para comparar
  el parecido.

## 4. Mejorar el aspecto del globo

Referencia visual: un holograma azul eléctrico/cian sobre negro, nítido y con detalle. NO una bola de luz difusa.

- Bloom contenido: `luminanceThreshold 0.2`, `luminanceSmoothing 0.15`, `intensity 0.9`, `mipmapBlur`, `radius 0.7`.
  Ningún elemento debe superar luminancia 2–3 antes del bloom. Ajusta los valores de forma que el halo mida como mucho
  ~6 % del radio del globo.
- Esfera base: `#020a18` con alfa 0.3. Fresnel cian `#4fc3ff`, con `pow(max(1.0 - dot(N,V), 0.0), 3.5) * 1.2`.
  Debe leerse como un borde fino, no como un relleno.
- Continentes: 50k puntos (25k en gama baja), color `#7fd4ff`, tamaño base 1.6 px × dpr. En las costas, el doble de
  densidad y 1.6× de brillo. En la cara trasera, 0.2 de opacidad para que se intuya a través del océano. Parpadeo de
  amplitud ±15 %, no más.
- Añadir: puntos de "ciudades/mercados" (NY, Londres, Fráncfort, Tokio, Hong Kong, Singapur, Sídney, São Paulo) con
  un pulso circular que se expande y arcos de conexión entre ellos (`QuadraticBezierCurve3` elevada sobre la
  superficie, línea de 1 px con un "paquete" de luz que la recorre en 3–5 s, `AdditiveBlending`). Como máximo 6
  arcos visibles a la vez.
- Retícula: meridianos y paralelos cada 15° con opacidad 0.07, y el ecuador un poco más marcado (0.14).
- Atmósfera: radio ×1.08 (no ×1.12), BackSide, `pow(max(0.7 - dot(N,V), 0.0), 3.0)`, color `#1e7bff`,
  intensidad 0.6.
- Anillos HUD: sus etiquetas no deben solaparse. Reparte las etiquetas en ángulos fijos con una separación mínima de
  40°, y cada `CanvasTexture` a 2× con `anisotropy` máxima, texto mono de 11 px renderizado a 22 px. Inclinaciones
  12°, −18° y 28°.
- Base proyector: elipse con un gradiente radial y 2 anillos concéntricos finos que pulsan hacia fuera, más un cono de
  luz volumétrico muy tenue (cilindro abierto con shader de opacidad vertical) entre la base y el globo.
- Antialias real: si el EffectComposer anula el MSAA del canvas, añade `<SMAA />` o usa `multisampling={4}` en el
  EffectComposer.

## 5. Maquetación del hero

- Grid de 2 columnas desde `lg`: `grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]` dentro de un `max-w-[1400px]`
  centrado, con el texto a la izquierda y el globo a la derecha, centrado en su columna y sin recortarse:
  `aspect-square w-full max-w-[min(72vh,680px)]`. En móvil se apila en una columna y el globo mide `min(92vw, 420px)`.
- H1: `text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.02] tracking-tight` y `max-w-[14ch]`. Las dos líneas del
  diccionario (`heroTitleLine1/2`) deben quedar en 2–3 líneas en escritorio, nunca en 7.
- Padding superior `pt-[calc(var(--header-height)+48px)]` y alto `min-h-[100svh]`, para que el header no tape el
  título.
- Botones con `whitespace-nowrap` y lado a lado (`flex flex-wrap gap-3`). Primario blanco y secundario con borde cian
  al 40 %.
- La pista "Arrastra para girar el planeta" va bajo el globo y centrada, no bajo el texto, con un pequeño ícono de
  mano/flechas que se mueve de lado a lado una vez cada 4 s.

## 6. Verificación obligatoria

1. `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` sin errores. Reporta el tamaño del chunk del globo antes y
   después.
2. Playwright con Chromium (`/opt/pw-browsers/chromium`; si no hay GPU, `--use-angle=swiftshader`), a 1440×900 y
   390×844:
   - captura a los 100 ms, a los 400 ms y tras `listo`. En NINGUNA puede haber un área blanca: recorre los píxeles de
     la caja del globo y falla si más del 2 % tiene luminancia > 0.9;
   - las cuatro esquinas del hero deben dar exactamente rgb(0,0,0);
   - tras `listo`, el centro del globo NO debe ser gris uniforme: la desviación estándar de la luminancia en un
     círculo del 60 % del radio debe ser > 0.05 (es decir, se ven puntos);
   - el H1 ocupa ≤ 3 líneas en escritorio (`getClientRects` o altura ÷ line-height) y su `top` está por debajo del
     `bottom` del header;
   - no hay scroll horizontal (`scrollWidth === clientWidth`).
3. Repite la prueba de arrastre del plan 006 (derecha y abajo) y confirma la dirección con `window.__globo` en dev.
4. Con `reducedMotion: 'reduce'`, dos capturas separadas 1 s son idénticas.
5. Muéstrame las capturas de carga (100 ms), del estado final en escritorio y móvil, y de antes/después del arrastre.
```
