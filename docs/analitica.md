# Analítica: Google Analytics 4 con consentimiento previo

El sitio mide su tráfico con **Google Analytics 4**, pero **solo si el visitante lo acepta**. Hasta entonces no se carga nada de Google ni se guarda ninguna cookie suya.

## Cómo funciona
- `components/analytics/Analytics.tsx` (en el layout del sitio público) muestra un **aviso de cookies** con «Aceptar» y «Rechazar» **con el mismo peso visual**.
- **Aceptar:** se carga `gtag.js` y se envía un `page_view` por cada cambio de ruta.
- **Rechazar** (o la señal **Global Privacy Control** del navegador, que cuenta como rechazo y no pregunta): no se carga nada y se borran las cookies `_ga*` si las hubiera.
- La decisión se guarda en `localStorage` (`gt_consent`), no en una cookie ni en el servidor.
- El enlace **«Preferencias de cookies»** del pie de página reabre el aviso: retirar el consentimiento es tan fácil como darlo.
- Ajustes de GA4 que enviamos: **sin señales de Google, sin personalización de anuncios**, anuncios siempre denegados, y sin `page_view` automático (lo mandamos nosotros por ruta, para que las páginas que navegan sin recargar también cuenten).
- No se mide el CMS ni el login (tienen otro layout raíz).
- Sin `NEXT_PUBLIC_GA_MEASUREMENT_ID` válido el componente **no renderiza nada**, no se muestra el aviso y la política de seguridad no cambia.

## Activarlo (una vez)
1. **Crear la propiedad** en <https://analytics.google.com>: *Administrar → Crear → Propiedad* (zona horaria y moneda del sitio) → *Flujos de datos → Web* → `https://grizzlytraders.com`.
2. Copiar el **ID de medición** (`G-XXXXXXXXXX`).
3. En el VPS: añadir `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX` a `/srv/grizzly/web/.env.production` y **recompilar** el sitio (la variable se fija al compilar). En local: `.env.local`.
4. En GA4, *Administrar → Recopilación de datos → Retención de datos*: dejar **2 meses** (es lo que dice la política de privacidad).
5. En GA4, *Administrar → Recopilación de datos → Señales de Google*: **desactivadas**.
6. Probar: abrir el sitio, aceptar el aviso y mirar **Informes → Tiempo real** (o *Administrar → DebugView*).

## Política de seguridad (CSP)
`next.config.ts` solo añade los dominios de Google (`googletagmanager.com`, `*.google-analytics.com`, `*.analytics.google.com`) a `script-src`, `connect-src` e `img-src` **cuando hay un ID válido** al compilar. Sin ID, la política queda como estaba.

## Textos legales
Se actualizaron la **Política de Cookies** (cookies `_ga` y `_ga_*`, sección «Analítica y lo que no usamos») y la **Política de Privacidad** (datos de analítica, Google como proveedor, retención de 2 meses). Siguen marcadas como **borrador pendiente de revisión legal**: conviene que las valide un abogado, sobre todo si hay visitantes de la UE (el consentimiento previo está pensado para eso).

## Límites
- Quien rechaza o usa un bloqueador no aparece en GA: las cifras son **una estimación por defecto**, no un recuento exacto.
- Mientras la decisión es «pendiente» no se mide nada: las primeras visitas de cada persona no cuentan hasta que acepta.
- Los datos de GA los trata Google (posible transferencia a EE. UU.); está dicho en la política de privacidad.
- Alternativa sin cookies ni aviso: una analítica sin consentimiento previo (por ejemplo Plausible o Umami autoalojado). No se usa por haber pedido Google Analytics.
