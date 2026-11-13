# Publicación en X (@grizzlytraders)

Al final de cada tanda del pipeline (cada 45 min, 32 al día) se publica **un artículo** en la cuenta de X, **sin ningún enlace**. Todas las publicaciones terminan con la frase fija «Para más noticias, visita el enlace de la bio.»: el enlace al sitio va solo en la biografía del perfil.

## Qué se publica
```
📈 Titular del artículo (hasta ~140 caracteres)

Una frase de contexto (la meta descripción del artículo).

#SP500 #Mercados

Para más noticias, visita el enlace de la bio.
```
- Emoji por categoría: 📈 acciones, ₿ criptomonedas, 💱 forex, 🛢️ materias primas. Etiquetas: hasta 2, primero las del activo protagonista (`cover_assets`) y después la de la categoría.
- Presupuesto de 275 de los 280 caracteres, con los emojis contados como 2. Si no cabe se recorta primero el contexto y después el titular.
- **Nunca lleva enlaces.** X cobra una publicación con enlace a US$0.20 y sin enlace a US$0.015 (13 veces más). El código quita URL, `www.` y dominios sueltos (`Nasdaq.com` → `Nasdaq`), y también `@` y `#` sueltos.
- Un contexto de menos de 20 letras, o igual al titular, no se pone.

## La portada
La imagen es la misma que se publica en el sitio (WebP de 1536×1024, unos 500 KB; el límite de X para imágenes es 5 MB). Su dirección sale de la fila del artículo (`cover_image_url`); si no está, se reconstruye con la misma fórmula con que el flujo la sube al almacenamiento. Una publicación con imagen sin enlace entra, según las fuentes consultadas, en la tarifa de US$0.015 (sin confirmar un precio aparte por la subida: verificar en la consola de X). El permiso `media.write` ya va en la credencial.

## Cómo se elige el artículo
GPT puntúa cada artículo del 1 al 10 (`relevancia`, en el mismo análisis que ya hacía). Al final de la tanda gana el de mayor puntuación; a igualdad, el de fuente con más prioridad (oficiales 2, GlobeNewswire y PR Newswire 1, resto 0). Máximo uno por tanda y al menos 30 minutos entre publicaciones. La publicación sale unos 3 minutos después del último artículo de la tanda.

## Flujo (n8n)
`Loop Over Items` (sin más candidatas) o `Control de cupo` → `¿Fin de la tanda?` → `Elegir artículo para X` → `Armar texto X` → `¿Publicar en X?`:
- **Modo de prueba** (por defecto): `X - Registrar prueba` guarda el texto en `pipeline_logs` con la fuente «X (prueba)». No se llama a X ni se gasta saldo.
- **Publicar**: `X - Descargar portada` → `X - Subir portada` (POST `https://api.x.com/2/media/upload`, permiso `media.write`) → `X - Media id` → `X - Publicar` (POST `https://api.x.com/2/tweets`, sin reintentos para no publicar dos veces) → `X - Resultado` → `¿X publicó?` → `X - Guardar id` (columnas `posts.x_post_id` y `x_publicado_at`) → `X - Log`.
- **La publicación lleva la portada del artículo.** **Respaldo a solo texto:** si la descarga o la subida de la imagen fallan por lo que sea (permiso, formato, saldo, red), `X - Media id` deja el identificador vacío y se publica igual el texto; el motivo queda en `pipeline_logs` («solo texto: portada no subida (X respondió …)»). La portada nunca impide una publicación. En modo de prueba, el registro «X (prueba)» anota la dirección de la portada que se habría subido.
- Ningún nodo de esta rama detiene el pipeline si falla. Un 402 (sin saldo), 401/403 (credencial) o 429 quedan en `pipeline_logs` con fuente «X» y estado `failed`.

## Costos (API de X, pago por uso)
| Concepto | Costo |
|---|---|
| 32 publicaciones al día × 30 días × US$0.015 (sin enlace) | **US$14.40 al mes** |
| Saldo inicial sugerido | US$15 a US$20 (5 a 6 semanas) |
| Semana en modo de prueba | US$0 |

Cifras de blogs de terceros: confirmar en la consola de X.

## Puesta en marcha
1. **Cliente (X):** registrar la cuenta como desarrollador y crear la app (ver la guía «Cómo registrar la cuenta @grizzlytraders como desarrollador en X»): OAuth 2.0, permisos *Read and write*, tipo *Web App, Automated App or Bot*, callback `http://localhost:5678/rest/oauth2-credential/callback`, saldo de US$15 a US$20, y el enlace del sitio en la biografía.
2. **Base de datos:** aplicar `supabase/migrations/0017_posts_x.sql`.
3. **Credencial en n8n (sin claves):** `bash /srv/grizzly/web/deploy/crear-credencial-x.sh`. Después, abrir la credencial «X (grizzlytraders)» en n8n (por túnel SSH: `ssh -L 5678:127.0.0.1:5678 grizzly@179.236.75.184`), pegar el **OAuth 2.0 Client ID** y el **Client Secret** (nunca por chat) y pulsar **Connect my account**; el cliente inicia sesión él mismo y pulsa *Authorize app*.
4. **Importar el flujo** (con respaldo) y reiniciar n8n. Desde ese momento corre en **modo de prueba**.
5. **Una semana en modo de prueba:** revisar los textos en `pipeline_logs` (fuente «X (prueba)»).
6. **Encender:** añadir `X_PUBLICAR_ACTIVO=true` al `environment` de n8n en `/srv/grizzly/n8n/docker-compose.yml` y recrear el contenedor (`docker compose up -d`). Para apagar: quitar la variable.

## Cosas a vigilar
- X puede rechazar algunas direcciones `localhost` como callback; si pasa, usar una dirección protegida del servidor o autorizar con un script.
- Las reglas de X piden etiquetar las cuentas automáticas y no repetir contenido. Si X ofrece la etiqueta de «cuenta automatizada», activarla.
- El saldo es prepagado: si se agota, las publicaciones fallan (402) sin afectar al sitio.
