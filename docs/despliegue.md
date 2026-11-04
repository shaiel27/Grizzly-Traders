# Despliegue en Hostinger (VPS KVM 2)

Un solo servidor con Ubuntu 24.04: el sitio (Next.js, puerto 3000), n8n (puerto 5678, solo local) y Caddy delante (HTTPS).
Los flujos de n8n llaman al sitio por `http://localhost:3000`, por eso van en la misma máquina.

## 1. DNS de grizzlytraders.com (hoy en Wix: ns8/ns9.wixdns.net)
Primero, en Wix, **desconectar el dominio del sitio antiguo** (si sigue conectado Wix bloquea esos registros) y confirmar con el cliente que la web vieja se apaga.

| Registro | Acción |
|---|---|
| A `grizzlytraders.com` → 185.230.63.171, .186, .107 (Wix) | **Borrar los 3** y crear 1 A → IP del VPS |
| CNAME `www` → cdn3.wixdns.net | **Cambiar** a CNAME → `grizzlytraders.com` (o A → IP del VPS) |
| CNAME `en`, `es`, `fr`, `he`, `ru` → cdn3.wixdns.net | **Borrar** (idiomas del sitio viejo; el nuevo no usa subdominios) |
| CNAME `rsend.mail` y `send.mail` → *.forge.rmta.net | **No tocar** (Resend) |
| TXT `resend._domainkey.mail` | **No tocar** (firma DKIM de Resend) |
| TXT `_dmarc` = `v=DMARC1; p=none;` | Dejar; subir a `p=quarantine` cuando los correos lleguen bien |
| MX | No hay: el dominio no recibe correo. `EMAIL_REPLY_TO` debe ser un buzón en otro servicio |

Opcional: `AAAA` si el VPS tiene IPv6. Los nameservers pueden seguir en Wix; si más adelante se pasan a Hostinger hay que recrear los registros de Resend.

## 2. Servidor (una vez)
```bash
adduser --disabled-password grizzly && usermod -aG sudo grizzly
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw enable
apt install -y caddy git docker.io docker-compose-v2 && curl -fsSL https://get.pnpm.io/install.sh | sh   # Node 22+ (nvm o NodeSource)
mkdir -p /srv/grizzly && chown grizzly /srv/grizzly
```
Como `grizzly`: `git clone https://github.com/shaiel27/Grizzly-Traders.git /srv/grizzly/web`, crear `/srv/grizzly/web/.env.production` (ver `.env.example`; **rotar antes** la llave de servicio de Supabase y la de Resend; `NEXT_PUBLIC_SITE_URL=https://grizzlytraders.com`), `pnpm install --frozen-lockfile && pnpm build`.

Copiar `deploy/Caddyfile` a `/etc/caddy/Caddyfile` y `deploy/grizzly-web.service` a `/etc/systemd/system/`, luego `systemctl enable --now grizzly-web && systemctl reload caddy`. (Caddy pide el certificado solo cuando el DNS ya apunta al VPS.)

## 3. n8n
`deploy/docker-compose.n8n.yml` con un `.env` junto a él (`N8N_ENCRYPTION_KEY`, y luego los de Telegram/Discord). Entrar por túnel SSH a `http://localhost:5678`, importar `n8n/*.json`, recrear las credenciales (Supabase, "Pipeline API portadas", Resend…) y activar los flujos. **Aviso:** las *Variables* de n8n (`$vars`) son de pago en la edición gratuita; el pipeline las usa para SITE_URL, Telegram y Discord. Con la imagen oficial hay que cambiarlas por `$env` (el compose ya las pasa como variables de entorno) — pendiente antes de activar las comunidades.

## 4. Después de publicar
Supabase → Auth → URL del sitio y redirecciones a `https://grizzlytraders.com`; comprobar un correo de prueba de la newsletter; activar los nodos de Telegram/Discord; regenerar el webhook de Discord; copias de seguridad/snapshots del VPS; etiqueta `v0.1.0`.
Actualizar el sitio: `bash deploy/actualizar.sh`. CDN delante (si se añade): debe variar por la cookie `gt_locale`.
