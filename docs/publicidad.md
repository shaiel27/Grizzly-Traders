# Publicidad (Adsterra)

Estado: **fases 1 y 2 hechas** (consentimiento, textos legales y componente de anuncios). Se cargan anuncios solo cuando hay códigos configurados y la publicidad está activada.

## Interruptor
`NEXT_PUBLIC_ADS_ACTIVO=true` (se fija **al compilar**: activarlo o apagarlo exige recompilar y reiniciar, ~2 min). Apagado (por defecto) el sitio no pide ni carga nada de publicidad y los textos legales dicen que no usamos cookies de publicidad. Los textos legales **cambian solos** con el interruptor (`lib/publicidad.ts`).

## Consentimiento
- La publicidad tiene su **propia decisión** (`localStorage` → `gt_consent_ads`), separada de la analítica (`gt_consent`). Aceptar una no acepta la otra.
- Con el interruptor encendido el aviso ofrece **Aceptar todo / Rechazar todo** (mismo peso visual) y **Elegir** (casillas por categoría, todas apagadas por defecto).
- Quien ya había decidido sobre la analítica y aún no sobre la publicidad vuelve a ver el aviso (solo entonces). Con **Global Privacy Control** la publicidad se rechaza sin preguntar.
- «Preferencias de cookies» (pie) reabre el aviso; retirar la publicidad detiene la carga de anuncios. Las cookies que Adsterra ya guardó están en su dominio: solo el usuario puede borrarlas desde el navegador (el aviso lo explica).
- Para cargar un anuncio: `puedeMostrarAnuncios(PUBLICIDAD_ACTIVA, useEstadoPublicidad())` (`lib/analytics.ts`, `components/analytics/consentimiento.ts`).

## Textos legales (siguen siendo borrador: requieren revisión legal)
Con el interruptor encendido, las políticas de cookies y de privacidad: añaden la cookie/identificadores de publicidad y a Adsterra como tercero, y sustituyen «no usamos cookies de publicidad» y «no vendemos ni compartimos (CPRA)» por el aviso de que, si aceptas, el tratamiento puede considerarse venta/compartición## Anuncios (fase 2)
- `components/ads/AdSlot.tsx`: no pinta nada (ni el rótulo «Publicidad») salvo que la publicidad esté activada, el espacio esté bien configurado y el visitante la haya aceptado. Carga el código solo al acercarse a la pantalla, con la altura reservada (sin saltos de diseño), de uno en uno (los banners de Adsterra comparten una variable global) y lo quita si se retira el consentimiento. Hoy hay un espacio, `articulo`, tras el texto de cada artículo.
- **Configuración** (variables que se fijan al compilar; las claves de los espacios no son secretas, van en el HTML de cualquier sitio con anuncios):
  - `NEXT_PUBLIC_ADS_ACTIVO=true`
  - `NEXT_PUBLIC_ADS_SLOTS={"articulo":{"tipo":"nativo","clave":"…","host":"…"}}` (o `{"tipo":"banner","clave":"…","host":"…","ancho":300,"alto":250}`). La clave y el servidor (`host`) salen del código que da el panel de Adsterra (`//HOST/CLAVE/invoke.js`). Valores mal escritos apagan el espacio, no rompen la página.
  - `NEXT_PUBLIC_ADS_HOSTS=a.com,b.com` (opcional): otros servidores que usen los anuncios (imágenes, marcos…); se sacan de los errores de la consola del navegador al probar.
  - `ADS_TXT` (en ejecución, no al compilar): las líneas que dé el panel, con `
` entre ellas → `/ads.txt`. Sin variable, 404.
- **Política de seguridad (CSP):** con la publicidad activada, solo las páginas de **artículo** admiten los servidores de los anuncios; el resto del sitio conserva la política estricta (una sola cabecera CSP por página). Los anuncios cargan scripts de terceros dentro de esas páginas: es el coste de la publicidad. El contenido de los artículos sigue pasando por la sanitización. Si al probar con códigos reales la consola muestra bloqueos, se añaden esos servidores a `NEXT_PUBLIC_ADS_HOSTS`.
- **Pendiente de comprobar con códigos reales** (no se puede sin cuenta): que el `invoke.js` de cada formato funciona al cargarse de forma dinámica y cuántos servidores usa. Se probó con un servidor de anuncios simulado.

## Puesta en marcha (fase 3)
1. En Adsterra: añadir el sitio, esperar la aprobación y crear **un** espacio (nativo o banner 300×250). **Sin popunder.**
2. Poner las variables, recompilar, desplegar y mirar la consola del navegador en un artículo (con la publicidad aceptada).
3. Medir 7 días: LCP y CLS antes/después, ingresos y % que acepta. Si algo empeora, `NEXT_PUBLIC_ADS_ACTIVO` vacío + recompilar la apaga por completo (los textos legales vuelven solos).
4. **Antes de activar:** revisión legal de los textos de cookies y privacidad.
- Términos de Adsterra: política de privacidad y aviso de cookies a cada visitante (4.9), su código no va en un iframe nuestro ni se modifica (4.7), nada de tráfico inflado ni clics propios (6).
