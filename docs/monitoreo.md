# Monitoreo externo del sitio

El 6-nov-2026 el sitio estuvo caído más de una hora sin que nada lo avisara: la máquina estaba sana por dentro (carga 0, sin errores) y un corte de red **por delante del servidor** dejó de dejar entrar tráfico. Desde dentro no se puede ver una caída así, así que el chequeo corre **fuera**.

## Qué hace
Un flujo de GitHub Actions (`.github/workflows/monitoreo.yml`) ejecuta `scripts/uptime-check.mjs` **cada 5 minutos**. Comprueba, con 3 intentos (10 s entre ellos) para no alertar por un fallo puntual de la red del ejecutor:

| Comprobación | Falla si… |
|---|---|
| Portada | no responde 200 en 15 s, o no es nuestra página |
| Último artículo del feed | su enlace no abre (200) |
| Feed y frescura | `/feed.xml` no responde, o la nota más reciente tiene **más de 4 h** (pipeline parado) |
| Certificado TLS | caduca en menos de 10 días (Caddy lo renueva solo; esto avisa si no lo hace) |

Si algo falla, la ejecución termina en rojo y **GitHub envía un correo** al dueño del repositorio. Opcionalmente también avisa a un webhook de Discord, y el registro de la ejecución dice si Discord aceptó el aviso (`📨 … webhook respondió 204`) o lo rechazó (`⚠️ … HTTP 404: revisa el secreto ALERT_WEBHOOK`).

## Activar los avisos (una vez, desde GitHub)
1. **Correo:** GitHub → tu perfil → *Settings → Notifications → Actions* → marca *Send notifications for failed workflows only* y el correo que quieras. (Por defecto ya avisa al último que tocó el calendario del flujo.)
2. **Discord (opcional, recomendado):** crea un canal **privado de alertas** distinto del de noticias, un webhook en él y guárdalo en el repositorio: *Settings → Secrets and variables → Actions → New repository secret* → nombre `ALERT_WEBHOOK`. Sin ese secreto solo hay correo.

## Probarlo
- *Actions → Monitoreo del sitio → Run workflow* lo lanza a mano.
- En local: `node scripts/uptime-check.mjs` (contra producción) o `SITE_URL=https://127.0.0.1:9 CHEQUEO_RAPIDO=1 node scripts/uptime-check.mjs` para simular una caída (sale con código 1).

## Límites
- El cron usa los minutos 2, 7, 12… a propósito: los minutos redondos (:00, :05…) son los más saturados y GitHub retrasa o salta ahí los flujos programados.
- GitHub puede **retrasar** los flujos programados unos minutos en horas de mucha carga; no es un SLA, pero basta para enterarse de una caída en menos de ~10 min.
- Mientras dure una caída llegará **un correo por cada ejecución fallida** (cada 5 min). Si molesta, sube el intervalo en el `cron` o silencia el hilo.
- GitHub desactiva los flujos programados tras **60 días sin actividad** en el repositorio; el sitio recibe cambios con regularidad, pero conviene saberlo.
- No ve lo que no sea público: el CMS, n8n (solo local en el VPS) y el envío del resumen diario no están cubiertos.
- La frescura del feed usa un máximo de 4 h; si el ritmo de publicación baja de forma permanente (por ejemplo, solo fuentes oficiales), hay que subirlo en `MAX_HORAS_SIN_PUBLICAR`.
