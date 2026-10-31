# Imágenes en el editor del CMS

El texto del artículo se escribe en un editor visual (`components/ui/RichEditor.tsx`, TipTap) y se guarda como HTML, igual que antes.

- **Insertar una imagen:** pegarla (Ctrl+V), arrastrarla al texto o usar el botón "Imagen". Pide texto alternativo y permite un pie de foto; se guarda como `<figure><img><figcaption>`.
- **Subida:** `POST /api/posts/upload-image` (solo editores, 40 por minuto). Acepta PNG, JPEG o WebP de hasta 10 MB; comprueba el formato real, aplica la orientación, **quita los metadatos (EXIF/GPS)**, limita el ancho a 1600 px y la guarda en WebP en `post-images/inline/<año>/<hash>.webp`. Con `kind=cover` la ajusta a 1536×1024 en `post-images/covers/`. El botón "Subir portada" del panel usa lo mismo.
- **Seguridad:** el saneador (`lib/sanitize.ts`) solo deja pasar `<img>` cuyo `src` sea del bucket público `post-images` de esta web; cualquier otra URL se elimina al guardar. La CSP ya solo permite imágenes de ese origen.
- **Versiones es/en:** cada idioma tiene su propio HTML. El botón "Copiar imágenes a la versión en…" añade al final de la otra versión las figuras que le faltan.
- **Modo HTML:** el botón "HTML" muestra el código. Un texto con tablas, `div`, `h1`/`h4+` u otros elementos que el editor visual no maneja se abre directamente en HTML para no perderlos al guardar.
- **Modo Asistido:** el cuerpo también es el editor visual. Las imágenes se pegan o arrastran entre los párrafos (máximo 10). Al generar, `lib/brief.ts` cambia cada figura por un marcador `<p>[[IMG:n]]</p>` y manda los datos de las imágenes aparte (`imagenes`: url, alt, pie, tamaño). `/api/posts/asistir` exige que cada URL sea del bucket propio. En n8n ("CMS Editorial"), GPT recibe la orden de conservar cada marcador junto al párrafo que lo precedía; el nodo "Parsear analisis" lo sustituye por la `<figure>` real con los datos del editor (nunca los de GPT) y, si GPT se comió un marcador, añade la imagen al final. El traductor traduce también el `alt` y el pie. GPT puede fundir párrafos: la imagen queda junto al mismo contenido, no necesariamente en la misma línea exacta; el borrador se abre en el editor visual para moverla.
- **Pendiente:** las imágenes que se quitan del texto siguen en el bucket (no hay limpieza automática).

Las capturas de TradingView llevan su marca de agua: conviene confirmar con el abogado los términos de TradingView antes de publicarlas.
