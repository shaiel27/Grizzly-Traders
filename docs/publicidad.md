# Publicidad (Adsterra)

Estado: **fase 1 de 3 hecha** (consentimiento y textos legales). Todavía no se carga ningún anuncio.

## Interruptor
`NEXT_PUBLIC_ADS_ACTIVO=true` (se fija **al compilar**: activarlo o apagarlo exige recompilar y reiniciar, ~2 min). Apagado (por defecto) el sitio no pide ni carga nada de publicidad y los textos legales dicen que no usamos cookies de publicidad. Los textos legales **cambian solos** con el interruptor (`lib/publicidad.ts`).

## Consentimiento
- La publicidad tiene su **propia decisión** (`localStorage` → `gt_consent_ads`), separada de la analítica (`gt_consent`). Aceptar una no acepta la otra.
- Con el interruptor encendido el aviso ofrece **Aceptar todo / Rechazar todo** (mismo peso visual) y **Elegir** (casillas por categoría, todas apagadas por defecto).
- Quien ya había decidido sobre la analítica y aún no sobre la publicidad vuelve a ver el aviso (solo entonces). Con **Global Privacy Control** la publicidad se rechaza sin preguntar.
- «Preferencias de cookies» (pie) reabre el aviso; retirar la publicidad detiene la carga de anuncios. Las cookies que Adsterra ya guardó están en su dominio: solo el usuario puede borrarlas desde el navegador (el aviso lo explica).
- Para cargar un anuncio: `puedeMostrarAnuncios(PUBLICIDAD_ACTIVA, useEstadoPublicidad())` (`lib/analytics.ts`, `components/analytics/consentimiento.ts`).

## Textos legales (siguen siendo borrador: requieren revisión legal)
Con el interruptor encendido, las políticas de cookies y de privacidad: añaden la cookie/identificadores de publicidad y a Adsterra como tercero, y sustituyen «no usamos cookies de publicidad» y «no vendemos ni compartimos (CPRA)» por el aviso de que, si aceptas, el tratamiento puede considerarse venta/compartición y cómo rechazarlo. **No activar la publicidad sin revisar estos textos.**

## Lo que falta (fases 2 y 3)
- Fase 2: componente `AdSlot` (carga con consentimiento, perezosa, altura fija), CSP más permisiva **solo en las rutas con anuncios** (los dominios de Adsterra rotan: hay que sacar la lista del panel), `ads.txt`.
- Fase 3: un espacio en artículos, medir 7 días (LCP, CLS, ingresos, % que acepta) y ampliar. Solo banners y nativos; **sin popunder**.
- Términos de Adsterra a respetar: política de privacidad y aviso de cookies a cada visitante (4.9), no colocar su código dentro de un iframe (4.7), nada de tráfico inflado ni clics propios (6).
