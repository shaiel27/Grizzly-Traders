# 008 — Estabilidad del globo + fondo estrellado + tarjetas estilo "Anchor AI"

- **Estado**: PLAN → se implementa en el mismo turno en que se escribe (igual que las rondas anteriores de esta
  sesión: no hay round-trip de aprobación, se revisa con capturas reales después).
- **Alcance**: `components/globe/GloboHolografico.tsx`, `components/modules/HomeHero.tsx`,
  `components/modules/HomeFeatures.tsx`, `app/globals.css`.
- **Referencia visual**: captura "Anchor AI" adjuntada por el usuario. Se usa como referencia de **estilo** (fondo
  estrellado, tipografía del titular, tarjetas numeradas de vidrio oscuro) — no como calco de layout. El objeto 3D
  central sigue siendo nuestro globo: ya cumple el mismo rol visual que el cristal de la referencia (objeto
  holográfico de partículas en el centro) y clonar la composición exacta (objeto perfecto al centro, titular
  arriba-izquierda superpuesto, texto arriba-derecha junto al nav) implicaría re-layoutear el hero desde cero y
  volver a tocar el posicionamiento del globo que costó varias rondas de ajuste fino esta misma sesión. Ver D1.

## Parte A — Estabilidad y optimización

Motivado por "quiero que optimices y corrijas todo para no tener más errores".

**Diagnóstico de lo que pasó**: el servidor de `pnpm dev` se había colgado por completo (ni `/robots.txt`
respondía; el proceso Node estaba en 1.7 GB de RAM) después de cientos de ediciones/Fast Refresh en una sesión muy
larga. Se reinició y volvió a responder normal (`GET / 200` en ~1 s, sin errores en consola salvo un warning
inofensivo de three.js sobre `THREE.Clock` deprecado, que viene de la librería, no de nuestro código). Es un
comportamiento conocido de la caché de HMR de Turbopack en sesiones de dev muy largas — no hay fix de código para
eso; la mitigación es reiniciar `pnpm dev` de vez en cuando, no algo que este plan pueda resolver.

Dicho eso, revisando `components/globe/*` hay 2 mejoras reales de robustez que sí vale la pena aplicar:

1. **Liberar recursos de Three.js al desmontar.** `GloboHolografico.tsx` crea geometrías/texturas con `useMemo`
   (`construirReticula`, `construirAnillo`, `crearTexturaEtiqueta`, la geometría de puntos) pero nunca llama a
   `.dispose()`. Hoy la home nunca desmonta el globo mientras se está viendo, pero si en algún momento se navega
   away/back por el App Router, o durante Fast Refresh en dev, esos buffers de GPU quedan huérfanos. Se agrega
   limpieza por capa.
2. **Pérdida de contexto WebGL.** `LimiteErrorGlobo` atrapa errores de React, pero un evento
   `webglcontextlost` (la GPU se resetea, pestaña mucho tiempo en segundo plano) no lanza una excepción de React —
   el canvas se queda congelado sin aviso. Se agrega un listener que fuerza el mismo fallback estático que ya
   existe para "sin WebGL".
3. **Re-verificación completa** al final: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

## Parte B — Rediseño visual

### B1. Fondo estrellado (reemplaza las filas de cotizaciones de la ronda anterior)

Las 3 filas de cotizaciones en scroll (`FILA_1/2/3`) se quitan — compiten visualmente con el globo y no es lo que
pide la referencia. En su lugar: una capa de estrellas **dentro del mismo `<Canvas>` del globo** (no un segundo
canvas ni un patrón CSS), con `<Stars>` de `@react-three/drei`, detrás del globo. Ventaja real sobre CSS: se
beneficia del mismo bloom sutil que ya existe y gira a un ritmo casi imperceptible (`rotation.y` creciendo en
`useFrame`), dando profundidad real — cumple "el fondo se debe mover constantemente" sin una segunda librería ni un
segundo pase de render. Con `prefers-reduced-motion` la rotación se desactiva (quedan estáticas pero visibles). Se
mantienen los 2 glows CSS de esquina (violeta/cian) en opacidad baja detrás del Canvas, para que el negro del hero
no quede plano donde el canvas no llega a cubrir (mobile).

### B2. Titular — pulido tipográfico

Se mantiene la estructura actual (kicker → H1 → lead → pastilla de arrastre → CTAs) — no se reubica arriba a la
derecha como en la referencia porque esa franja ya la ocupa el header fijo real del sitio (con su propia
navegación). Cambios: `tracking` del H1 más cerrado, chip "Mercados en vivo" con chrome más neutro (blanco/vidrio
en vez de cian), reservando el cian para el globo y las tarjetas.

### B3. Tarjetas "Lo que hay dentro" → vidrio oscuro numerado

Rediseño de `HomeFeatures.tsx`: panel `rounded-2xl` con `bg-white/[0.03]` + `backdrop-blur-sm` + borde
`white/10`, línea de brillo degradado cian en el borde inferior (más intensa en hover), número grande (`01`–`04`)
en la esquina superior derecha en `text-white/15` detrás del contenido, título/cuerpo sin cambios de copy. El grid
y la lógica de entrada por `IntersectionObserver` no cambian, solo el chrome visual.

### B4. Qué NO cambia

Posición/tamaño/arrastre/encogimiento-con-scroll del globo (recién ajustado); el header global del sitio (fuera de
alcance); los datos reales de los anillos HUD.

## Decisiones

- **D1 — Alcance de la recreación**: aplicar el lenguaje visual de la referencia (estrellas, tarjetas numeradas,
  titular más bold) a la composición actual, conservando el globo donde está. Si se prefiere clonar el layout 1:1
  de la referencia (objeto centrado, titular superpuesto arriba-izquierda), es más trabajo/riesgo — se hace si se
  pide explícitamente después de ver el resultado de esta ronda.
- **D2 — Estrellas vía WebGL** (`<Stars>` de drei dentro del Canvas) en vez de CSS puro, por el movimiento/
  profundidad real sin agregar una segunda capa de render.

## Verificación

`pnpm typecheck && pnpm lint && pnpm test && pnpm build`; revisión visual pendiente del usuario en navegador real
(mismo patrón que el resto de la sesión).
