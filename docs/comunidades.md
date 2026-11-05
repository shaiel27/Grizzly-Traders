# Discord: noticias en la comunidad

Por cada artículo que publica el pipeline sale **un mensaje** en Discord con **solo el titular y el enlace a nuestro artículo** (`https://grizzlytraders.com/articulos/<slug>`), no a la fuente original. Discord muestra solo la vista previa del enlace con la portada, tomada de las etiquetas Open Graph del artículo.

## Cómo sale
- **Discord (webhook):** `**Titular**` y el enlace en la línea siguiente, con el nombre «Grizzly Traders» y el logo del sitio (`/logo.png`). El mensaje no puede mencionar a nadie (`allowed_mentions` vacío) y el Markdown del titular se escapa.
- Solo español por ahora (el enlace abre la versión del lector).
- A 3 artículos cada 45 min son ~96 mensajes al día por canal.

## Estado
- **Discord: encendido** (nodo `Discord - Difundir`). La URL del webhook vive solo en el `.env` de n8n del VPS (`/srv/grizzly/n8n/.env`, permisos 600).
- **Telegram: descartado.** El cliente decidió no abrir comunidad de Telegram; se eliminaron su nodo, sus variables y la ruta `/api/cover/jpeg`. Queda solo el botón de **compartir** un artículo por Telegram, que es del lector.

## Botón del sitio
La invitación a la comunidad es `NEXT_PUBLIC_DISCORD_URL` (se fija **al compilar**: tras cambiarla hay que recompilar el sitio). Si no está definida, el botón de la cabecera no se muestra y la tarjeta de la portada ofrece solo el correo. Con ella aparece el botón **Discord** en la cabecera (escritorio) y **Unirse al Discord** en la tarjeta (también en móvil), que abren la invitación en una pestaña nueva. **Usar una invitación que no caduque** (al crearla en Discord, «Caduca: nunca»).

## Dónde está en el flujo
`Publicar post → Revalidar sitio → Armar mensaje comunidades → Discord - Difundir`. Va **después** de revalidar el sitio para que el enlace no dé 404. Un fallo de Discord no detiene el pipeline. El código del mensaje se prueba en `n8n/comunidades.test.ts`.

## Variables de entorno de n8n (en `/srv/grizzly/n8n/.env`; nunca en el repositorio)
| Variable | Valor |
|---|---|
| `SITE_URL` | `https://grizzlytraders.com` (ya fija en el compose) |
| `DISCORD_WEBHOOK_URL` | la URL del webhook del canal de noticias |

Tras cambiar el `.env`: `cd /srv/grizzly/n8n && docker compose up -d` (un simple `restart` no relee las variables).

## Preparar Discord
1. Canal de noticias → Editar canal → Integraciones → Webhooks → Nuevo webhook → copiar la URL.
2. Quien tenga esa URL puede publicar en el canal: si se filtra (por ejemplo, se pega en un chat), bórrala y crea otra.

## Límites
Discord: ~30 mensajes por minuto por webhook. Con 3 artículos por ciclo sobra.
