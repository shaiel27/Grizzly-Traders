# CMS: sección «Artículos»

La lista del CMS separa tres ámbitos que no se mezclan, con búsqueda, filtros y paginación en el servidor (25 por página).

| Ámbito | Qué contiene | Para qué |
|---|---|---|
| **Mis artículos** (por defecto) | lo escrito en el CMS (`origen = 'cms'`): manual o asistido, con sus borradores | lo que más usa quien escribe; antes quedaba enterrado bajo las notas automáticas (la lista mostraba solo los 50 más recientes) |
| **Automáticos** | lo que publica el pipeline (`origen = 'rss'`), sin sus restos de error | revisar y buscar por fuente (EDGAR, EIA, Investing…) |
| **Errores del pipeline** | restos del pipeline: reservas sin terminar (`pendiente-…`), duplicados (`duplicado-…`) y borradores con un fallo guardado | verlos sin que estorben; reintentar o descartar |

`GET /api/posts/list?ambito=mis|auto|errores&estado=todos|published|draft|scheduled&q=…&categoria=id&fuente=id&pagina=n` devuelve la página, el total y los contadores de los tres ámbitos.

## Errores del pipeline
- **No se ven en el sitio** (son borradores) y salen de la lista normal.
- **Por qué no se borran al instante:** el pipeline usa esas filas como marca de «esta noticia ya se trató» (mira 10 días atrás). Se limpian solos a los **7 días**, cuando la noticia ya no entra por la ventana de fechas de las fuentes.
- **Limpieza automática:** la función SQL `limpiar_errores_pipeline(7)` (migración `0013`) corre cada día a las 07:17 UTC con `pg_cron` y deja una línea en `pipeline_logs`. El botón «Limpiar los de más de 7 días» hace lo mismo desde el CMS.
- **Acciones por fila:** *Reintentar* (pone los intentos a 0; el pipeline lo vuelve a procesar si la noticia sigue en el feed), *Descartar* (borra la fila) y, en los rechazados por el checklist, *Editar*. Un duplicado no se reintenta.
- `POST /api/posts/errores` comprueba **en el servidor** que la fila es un resto de error: nunca borra ni toca un artículo publicado ni uno escrito en el CMS.

## Edición segura (migración `0014`)
- **Aviso de cambios sin guardar:** indicador en el editor, aviso propio al cambiar de pestaña, abrir otro artículo o cancelar, y aviso del navegador al cerrar la pestaña.
- **Borrador local:** mientras se escribe, una copia se guarda en este navegador (`localStorage`, a los 1,5 s de parar). Al volver a abrir el artículo (o el CMS) se ofrece *Restaurar* o *Descartar*. Caduca a los 14 días. Se borra al guardar.
- **Conflictos:** si el texto de ese idioma cambió desde que se abrió (otra persona o el flujo automático), el guardado responde 409 y **no escribe nada**; el panel lo explica y ofrece cargar la versión actual (el borrador local queda a salvo).
- **Historial:** antes de sustituir un título/texto se guarda la versión anterior (quién y cuándo), últimas 20 por artículo e idioma, en `posts_historial`. *Historial → Restaurar* la devuelve y guarda antes la actual (restaurar también se deshace). Un historial roto nunca impide guardar.
- **Avisos al editar:** un artículo de la automatización o ya publicado muestra una franja informativa.
