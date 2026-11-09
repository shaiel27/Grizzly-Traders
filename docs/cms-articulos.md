# CMS: sección «Artículos»

La lista del CMS separa tres ámbitos que no se mezclan, con búsqueda, filtros y paginación en el servidor (25 por página).

| Ámbito | Qué contiene | Para qué |
|---|---|---|
| **Mis artículos** (por defecto) | lo escrito en el CMS (`origen = 'cms'`): manual o asistido, con sus borradores | lo que más usa quien escribe; antes quedaba enterrado bajo las notas automáticas (la lista mostraba solo los 50 más recientes) |
| **Automáticos** | lo que publica el pipeline (`origen = 'rss'`), sin sus restos de error | revisar y buscar por fuente (EDGAR, EIA, Investing…) |
| **Errores del pipeline** | restos del pipeline: reservas sin terminar (`pendiente-…`), duplicados (`duplicado-…`) y borradores con un fallo guardado | verlos sin que estorben; reintentar o descartar |

`GET /api/posts/list?ambito=mis|auto|errores&estado=todos|published|draft|scheduled&q=…&categoria=id&fuente=id&pagina=n` devuelve la página, el total y los contadores de los tres ámbitos.

## Errores del pipeline
Desde la migración `0015` el pipeline **ya no deja filas de error en `posts`**:
- Una noticia que **falla** o resulta **duplicada** se recuerda en la tabla ligera `pipeline_vistos` (URL, motivo, intentos; se vacía sola a los 10 días, la ventana que mira el pipeline) y el borrador fallido **se borra al momento**. Un fallo técnico se reintenta una vez; un duplicado o un rechazo del checklist no se reintentan.
- Los motivos de cada fallo siguen en `pipeline_logs`.
- Funciones SQL: `pipeline_tratados` (lo ya tratado: artículos + lo visto), `pipeline_registrar_fallo`, `pipeline_registrar_duplicado`; `pipeline_claim_post` no cambia.
- La pestaña **Errores del pipeline** queda solo para las **reservas que se quedan a medias** por una caída (ya no se ven en el sitio y la función `limpiar_errores_pipeline(1)` las borra a las 24 h, cada día a las 07:17 UTC con `pg_cron`). Un borrador con traducciones (contenido real) nunca se borra solo.
- `POST /api/posts/errores` comprueba **en el servidor** que la fila es un resto de error: nunca toca un artículo publicado ni uno escrito en el CMS.

## Edición segura (migración `0014`)
- **Aviso de cambios sin guardar:** indicador en el editor, aviso propio al cambiar de pestaña, abrir otro artículo o cancelar, y aviso del navegador al cerrar la pestaña.
- **Borrador local:** mientras se escribe, una copia se guarda en este navegador (`localStorage`, a los 1,5 s de parar). Al volver a abrir el artículo (o el CMS) se ofrece *Restaurar* o *Descartar*. Caduca a los 14 días. Se borra al guardar.
- **Conflictos:** si el texto de ese idioma cambió desde que se abrió (otra persona o el flujo automático), el guardado responde 409 y **no escribe nada**; el panel lo explica y ofrece cargar la versión actual (el borrador local queda a salvo).
- **Historial:** antes de sustituir un título/texto se guarda la versión anterior (quién y cuándo), últimas 20 por artículo e idioma, en `posts_historial`. *Historial → Restaurar* la devuelve y guarda antes la actual (restaurar también se deshace). Un historial roto nunca impide guardar.
- **Avisos al editar:** un artículo de la automatización o ya publicado muestra una franja informativa.

## Extras de la lista
- **Acciones en lote:** casilla en cada fila (y una general por página). Con selección aparece la barra *Publicar · Despublicar · Borrar* (hasta 50, con confirmación). `POST /api/posts/lote`. Publicar conserva la fecha original y completa lo que falte (portada, categoría, traducción).
- **Nueva portada:** botón ✨ en los artículos publicados que tienen portada. Descarta la actual (y borra el archivo si nadie más lo usa) y lanza el flujo de completado, que genera otra. Los que ya no tienen portada (por la retención de 18 días) muestran «Le falta: portada · Completar». `POST /api/posts/regenerar-portada`.
- **Títulos parecidos:** al salir del campo título, el editor avisa si en los últimos 30 días ya hay un artículo con un título muy parecido (`GET /api/posts/duplicados`). Solo avisa, nunca impide guardar.
