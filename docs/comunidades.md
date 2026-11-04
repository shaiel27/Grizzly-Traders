# Telegram y Discord: noticias en las comunidades

Cada artículo que publica el pipeline sale **una vez** en el canal de Telegram y en `#noticias` de Discord, con la portada, el extracto y el enlace a **nuestro** artículo (`https://grizzlytraders.com/articulos/<slug>`), no a la fuente original.

## Cómo sale
- **Telegram (canal):** foto de la portada, titular en negrita, extracto, `Categoría · Sentimiento · Fuente`, y un botón **Leer artículo**. La foto se pide en JPEG a `GET /api/cover/jpeg?u=…` (Telegram no siempre acepta WebP). Si la foto falla, se envía un mensaje de texto con vista previa grande del enlace.
- **Discord (webhook):** un *embed* con título enlazado, extracto, la portada grande y pie `Grizzly Traders · …`. El color sigue el sentimiento (verde, rojo, azul).
- Solo español por ahora (el flujo envía el artículo en su idioma original y el enlace abre la versión del lector).

## Dónde está en el flujo
`n8n/pipeline-noticias.json`: `Publicar post → Revalidar sitio → Armar mensaje comunidades → Telegram - Difundir → Discord - Difundir` (con `Telegram - Respaldo texto` si falla la foto). Va **después** de revalidar el sitio para que el enlace no dé 404. Los tres nodos de envío están **apagados** hasta el despliegue. El código del mensaje se prueba en `n8n/comunidades.test.ts`.

## Variables de n8n (Settings → Variables). Nunca van en el repositorio
| Variable | Valor |
|---|---|
| `SITE_URL` | `https://grizzlytraders.com` |
| `TELEGRAM_BOT_TOKEN` | el token que da @BotFather |
| `TELEGRAM_CHAT_ID` | `@nombre_del_canal` (canal público) o el id numérico `-100…` |
| `DISCORD_WEBHOOK_URL` | la URL del webhook de `#noticias` |

## Preparar Telegram
1. En @BotFather: `/newbot` y guarda el token.
2. Añade el bot al canal como **administrador** con permiso para publicar mensajes.
3. Pon `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` en las variables.

## Preparar Discord
1. Canal `#noticias` → Editar canal → Integraciones → Webhooks → Nuevo webhook.
2. Copia la URL en `DISCORD_WEBHOOK_URL`. Quien tenga esa URL puede publicar en el canal: si se filtró (por ejemplo, se pegó en un chat), bórrala y crea otra.

## Encender (el día del despliegue)
1. Sitio ya en `https://grizzlytraders.com` y `NEXT_PUBLIC_SITE_URL` apuntando ahí.
2. Variables puestas y probadas en un canal privado de prueba.
3. En n8n, activar `Telegram - Difundir`, `Telegram - Respaldo texto` y `Discord - Difundir`.
4. Vigilar un ciclo (cada 15 min): debe salir un mensaje por artículo publicado.

## Probar sin molestar a la comunidad
Cambia temporalmente `TELEGRAM_CHAT_ID` y `DISCORD_WEBHOOK_URL` a un canal privado tuyo, activa los nodos y espera un ciclo (o lanza `n8n execute --id=xvENLqv9HYCbOVcj`). Después vuelve a poner los valores reales.

## Límites
Telegram: ~20 mensajes por minuto en un canal; Discord: ~30 por minuto por webhook. Con hasta 5 artículos por ciclo sobra.
