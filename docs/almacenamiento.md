# Almacenamiento de portadas (Supabase)

El plan gratuito da **1 GB** de almacenamiento. Las portadas pesan ~574 KB y entran ~70 al día (~40 MB/día): sin limpieza el bucket `post-images` se llena en ~2 semanas.

## Retención (18 días)
Cada día se borran las portadas de las notas **automáticas** (`origen = 'rss'`) publicadas hace más de **18 días**. Uso estable estimado: ~720 MB (70 %).
- Se **conserva** el texto, la URL y el SEO del artículo; solo pierde la imagen.
- **Nunca se tocan:** artículos de Moisés (CMS), destacados, las 20 notas más vistas, imágenes incrustadas en un texto, ni archivos en carpetas (subidas del CMS).
- **Huérfanos:** archivos que ningún artículo usa y llevan más de 24 h subidos (restos de portadas regeneradas).
- Los archivos se borran con la API de Storage (borrar filas de `storage.objects` por SQL deja el archivo físico).
- Tope de 200 artículos por ejecución; el resto sigue al día siguiente.
- **Es irreversible**, pero las portadas son generadas: se pueden regenerar.

## Cómo corre
`deploy/mantenimiento-portadas.sh` (cron del VPS, 06:23 UTC) llama a `POST /api/mantenimiento/portadas` (Bearer `PIPELINE_API_SECRET`). La ruta **solo informa** salvo que reciba `{"ensayo": false}`; el script diario envía ese valor. Cada ejecución real queda en `pipeline_logs`.
Prueba sin borrar: `bash deploy/mantenimiento-portadas.sh ensayo`.

## Alerta
Si el uso pasa del 80 %, o el mantenimiento falla, el script avisa por Discord si existe `ALERT_WEBHOOK_URL` en `.env.production`.

## A largo plazo
Reducir el peso de cada portada (≈100 KB) permite conservarlas mucho más tiempo, o pasar al plan Pro (100 GB).
