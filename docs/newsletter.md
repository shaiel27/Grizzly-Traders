# Boletín por correo

Alta con doble confirmación y un resumen diario de noticias, en español e inglés. La lista de suscriptores vive en Supabase; el proveedor de correo (Resend) solo recibe contactos ya confirmados. Todo el código del proveedor está detrás de la interfaz de `lib/email/provider.ts`, así que cambiar a otro (por ejemplo Kit) es escribir otro adaptador.

## Cómo funciona

1. **Alta**: el formulario del pie (`components/ui/NewsletterForm.tsx`) envía el correo, el idioma y la casilla de consentimiento a `POST /api/subscribe`. Se guarda como `pending` con el consentimiento y se envía un correo con un enlace.
2. **Confirmación**: el enlace abre `/newsletter/confirmar?token=…`. Un botón hace `POST /api/subscribe/confirm`; solo entonces el contacto pasa a `confirmed` y se crea en Resend. Es un POST a propósito: los antivirus que abren los enlaces del correo no pueden confirmar por la persona.
3. **Resumen diario**: `POST /api/newsletter/digest` (protegido) elige los artículos publicados en las últimas 24 horas, arma el correo y crea una difusión por idioma en Resend.
4. **Baja**: cada difusión lleva el enlace de baja de Resend. Además, `/newsletter/baja` permite pedir la baja por correo (se envía un enlace de confirmación a la propia dirección) y `POST /api/subscribe/unsubscribe/confirm` la aplica.

Los tokens se guardan solo como hash (SHA-256) y vencen a las 48 horas. La IP solo se guarda como hash con sal.

## Puesta en marcha

1. Aplicar `supabase/migrations/0007_newsletter.sql` a mano en el editor SQL de Supabase. Cierra la inserción pública (antes cualquiera podía insertar filas con la llave anónima) y crea `newsletter_digests`. Quien ya estaba en la tabla queda `pending` y sin token: no recibe nada hasta que vuelva a suscribirse y confirme.
2. Resend: verificar el dominio (SPF, DKIM y DMARC), crear dos segmentos (español e inglés) y una llave de API.
3. Variables de entorno en el servidor (nunca en el repositorio):

| Variable | Para qué |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Obligatoria: la tabla de suscriptores solo se accede desde el servidor |
| `NEXT_PUBLIC_SITE_URL` | Obligatoria en producción: base de los enlaces de los correos |
| `RESEND_API_KEY`, `EMAIL_FROM` | Llave y remitente (`Grizzly Traders <resumen@tudominio.com>`) |
| `EMAIL_REPLY_TO` | Correo de respuesta (opcional) |
| `RESEND_SEGMENT_ES`, `RESEND_SEGMENT_EN` | Id del segmento de cada idioma |
| `NEWSLETTER_POSTAL_ADDRESS` | Dirección postal del remitente: sin ella no se envía el resumen |
| `NEWSLETTER_LOGO_URL` | URL pública (https) del logo de los correos, de 96×96 px. Opcional: sin ella se usa `NEXT_PUBLIC_SITE_URL/logo.png`, que en desarrollo (localhost) no carga en la bandeja de entrada |
| `DIGEST_CRON_SECRET` | Secreto de al menos 32 caracteres para disparar el resumen |
| `DIGEST_TIMEZONE` | Zona horaria del "día" del resumen (por defecto `UTC`) |
| `NEWSLETTER_IP_SALT` | Sal para el hash de la IP; sin ella no se guarda ninguna IP |

Sin `RESEND_API_KEY`, en desarrollo se usa un proveedor simulado que no envía nada (escribe los correos en la consola); en producción el boletín queda "no disponible".

4. Disparar el resumen una vez al día (n8n o `cron` del sistema):

```
curl -X POST https://tudominio.com/api/newsletter/digest -H "Authorization: Bearer $DIGEST_CRON_SECRET"
```

Cuerpo opcional: `{"locale":"es"}` o `{"locale":"en"}` para un solo idioma.

## Ver el correo sin enviarlo

```
curl -X POST .../api/newsletter/digest -H "Authorization: Bearer $DIGEST_CRON_SECRET" \
  -H "Content-Type: application/json" -d '{"locale":"es","dryRun":true,"windowHours":168}'
```

Devuelve el asunto, el HTML y el texto con los artículos reales, sin enviar ni reservar el día. `windowHours` (1–720) solo se respeta con `dryRun`.

## Reglas que cumple el envío

- No se envía con menos de 3 artículos, ni sin dirección postal, ni dos veces el mismo día e idioma (`newsletter_digests`).
- Un artículo sin traducción al idioma del resumen no entra en ese resumen.
- Cada envío lleva el aviso de que es informativo y no asesoría, la nota de contenido con ayuda de IA y el enlace de baja.
- No se incluyen datos de bolsa ni de TradingView en el correo.
- Si Resend rechaza claramente la difusión (error 4xx), el día queda libre y el siguiente intento sí la envía. Si hay un corte de red, un timeout (20 s) o una respuesta ilegible, no se sabe si salió: el día queda en `sending` y el error lo dice. Revisa en Resend (Broadcasts) si salió antes de reintentar.
- Si un envío queda en `sending` por una caída, **no se reintenta solo** (evita duplicar el envío a toda la lista). Para reintentarlo a mano, comprobar en Resend que no salió y marcarlo `failed` (instrucción al final de la migración).

## Pendiente o por confirmar

- **Cabecera de la IP**: el límite de intentos usa `x-forwarded-for`. Detrás de Nginx hay que fijarla con la IP real (`proxy_set_header X-Forwarded-For $remote_addr;`); si no, un cliente puede falsificarla.
- **Resend**: los códigos 409/422 al crear un contacto que ya existe son una suposición; confirmar con una cuenta real. No hay todavía un webhook que traiga de vuelta a Supabase las bajas hechas desde el enlace de Resend: hoy esas bajas quedan en Resend, que deja de enviar a ese contacto, y Supabase las verá cuando se añada el webhook (necesita el sitio publicado).
- **Límites del plan gratuito de Resend**: 1.000 contactos con difusiones ilimitadas; los correos de confirmación cuentan contra 100 al día y 3.000 al mes.
- **Nombre de categoría**: las categorías de la base de datos están en español ("Acciones"), también en el resumen en inglés.
- **Textos legales**: `legal/privacidad` ya menciona a Resend, la doble confirmación y la baja, pero sigue siendo borrador y debe revisarlo un abogado. Cuando se activen los anuncios habrá que revisar también su afirmación de que no se comparten datos con terceros.
