# Telegram y Discord: noticias en las comunidades

Por cada artículo que publica el pipeline sale **un mensaje** en Discord (y en Telegram cuando se configure) con **solo el titular y el enlace a nuestro artículo** (`https://grizzlytraders.com/articulos/<slug>`), no a la fuente original. Discord y Telegram muestran solos la vista previa del enlace con la portada, tomada de las etiquetas Open Graph del artículo.

## Cómo sale
- **Discord (webhook):** `**Titular**` y el enlace en la línea siguiente, con el nombre «Grizzly Traders» y el logo del sitio (`/logo.png`). El mensaje no puede mencionar a nadie (`allowed_mentions` vacío) y el Markdown del titular se escapa.
- **Telegram (canal):** `<b>Titular</b>` y el enlace, con vista previa grande. Se envía con `sendMessage`.
- Solo español por ahora (el enlace abre la versión del lector).
- A 3 artículos cada 45 min son ~96 mensajes al día por canal.

## Estado
- **Discord: encendido** (nodo `Discord - Difundir`). La URL del webhook vive solo en el `.env` de n8n del VPS (`/srv/grizzly/n8n/.env`, permisos 600).
- **Telegram: apagado** hasta tener `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`. Se enciende activando `Telegram - Difundir` en `n8n/pipeline-noticias.json`. Un fallo de Telegram no impide el envío a Discord.

## Dónde está en el flujo
`Publicar post → Revalidar sitio → Armar mensaje comunidades → Telegram - Difundir → Discord - Difundir`. Va **después** de revalidar el sitio para que el enlace no dé 404. Un fallo de Discord no detiene el pipeline. El código del mensaje se prueba en `n8n/comunidades.test.ts`.

## Variables de entorno de n8n (en `/srv/grizzly/n8n/.env`; nunca en el repositorio)
| Variable | Valor |
|---|---|
| `SITE_URL` | `https://grizzlytraders.com` (ya fija en el compose) |
| `DISCORD_WEBHOOK_URL` | la URL del webhook del canal de noticias |
| `TELEGRAM_BOT_TOKEN` | el token que da @BotFather |
| `TELEGRAM_CHAT_ID` | `@nombre_del_canal` (canal público) o el id numérico `-100…` |

Tras cambiar el `.env`: `cd /srv/grizzly/n8n && docker compose up -d` (un simple `restart` no relee las variables).

## Preparar Discord
1. Canal de noticias → Editar canal → Integraciones → Webhooks → Nuevo webhook → copiar la URL.
2. Quien tenga esa URL puede publicar en el canal: si se filtra (por ejemplo, se pega en un chat), bórrala y crea otra.

## Preparar Telegram
1. En @BotFather: `/newbot` y guarda el token.
2. Añade el bot al canal como **administrador** con permiso para publicar.
3. Pon `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` en el `.env` de n8n, recrea el contenedor y activa `Telegram - Difundir`.

## Límites
Telegram: ~20 mensajes por minuto en un canal; Discord: ~30 por minuto por webhook. Con 3 artículos por ciclo sobra.
