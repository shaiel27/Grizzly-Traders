# Portadas de los artículos

La portada de cada artículo automático se hace en dos pasos:

1. **Imagen base (IA).** El flujo de n8n pide a GPT una *escena fotográfica* específica del protagonista de la noticia (lingotes en una cámara acorazada, una plataforma petrolera, obleas de silicio…) y `gpt-image-1-mini` la dibuja con la plantilla de la casa (duotono de imprenta, sin texto). La IA **no** dibuja banderas ni logos: los inventa mal.
2. **Insignias (código).** n8n llama a `POST /api/cover/compose` con la imagen y dos listas que sacó del análisis: `cover_flags` (países, ISO alfa-2) y `cover_assets` (símbolos del catálogo). El sitio (`lib/cover/*`, con `sharp`) redimensiona a 1536×1024, oscurece la esquina inferior izquierda y dibuja hasta 4 insignias circulares: banderas oficiales, logos de criptomonedas y glifos propios para metales, petróleo, gas y granos. Un par de divisas (EURUSD) pone las dos banderas; un índice (DAX), la de su mercado. Las acciones de empresas no llevan logo (marcas registradas).

## Lo que sabe dibujar

- Banderas: `lib/cover/assets.generated.ts` (flag-icons, MIT).
- Criptomonedas: mismo archivo (cryptocurrency-icons, CC0).
- Metales (XAUUSD, XAGUSD, PLATINUM, PALLADIUM, COPPER), petróleo (WTI, BRENT), gas (NG) y granos (CORN, WHEAT, SUGAR, COFFEE): `lib/cover/badges.ts`.
- Para añadir banderas o criptos: editar las listas de `scripts/build-cover-assets.mjs` y ejecutar `node scripts/build-cover-assets.mjs`. También hay que añadir el código a las listas cerradas del nodo "Parsear JSON" y del prompt de análisis en n8n.

## Configuración

| Variable | Dónde | Para qué |
|---|---|---|
| `PIPELINE_API_SECRET` | sitio | Secreto (32+ caracteres) del endpoint. Sin él la ruta responde 503 |
| Credencial "Pipeline API portadas" | n8n (Header Auth) | `Authorization: Bearer <PIPELINE_API_SECRET>` |

El nodo "Componer portada" apunta a `http://localhost:3100`. En el VPS hay que cambiarlo por la dirección del sitio (por ejemplo `http://localhost:3000`).

## Si el sitio no responde

"Componer portada" reintenta 3 veces. Si sigue sin responder, el nodo "Elegir portada" publica la imagen base sin insignias (queda `cover_mode: respaldo_sin_insignias` en la ejecución): el artículo no se pierde ni queda en borrador.
