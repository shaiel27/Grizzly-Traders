# Flujos de n8n

`cms-editorial.json` es el flujo "CMS Editorial" (webhook del modo Asistido del CMS: análisis, portada, inserción y traducción; id `LsHnIJHOeA3iHrEG`). Recibe `titular`, `cuerpo` e `imagenes` (ver `docs/cms-imagenes.md`).

`pipeline-noticias.json` es el flujo "Pipeline Noticias Financieras" (RSS → GPT → portada → Supabase). No contiene llaves: las credenciales se referencian por nombre (`Supabase account 2`, `Pipeline API portadas`, OpenAI, Firecrawl) y hay que crearlas en cada instancia.

Importar y activar (con n8n parado o reiniciándolo después):

```
n8n import:workflow --input=n8n/pipeline-noticias.json
n8n publish:workflow --id=xvENLqv9HYCbOVcj
```

Probar una vuelta sin esperar al siguiente ciclo (cada 45 min): `n8n execute --id=xvENLqv9HYCbOVcj` (arranca desde el nodo "Prueba manual"; si n8n ya está corriendo, usar otro `N8N_RUNNERS_BROKER_PORT`).

Antes de desplegar en el VPS: el nodo "Componer portada" apunta a `http://localhost:3000`; cambiarlo a la dirección del sitio. Detalles en `docs/portadas.md`.

Telegram y Discord: `docs/comunidades.md` (variables de n8n, formato del mensaje y cómo encenderlos).

## Ritmo y portadas (desde nov-2026)
- **Ritmo:** 3 notas por ciclo, un ciclo cada 45 min (32 al día). El disparador corre cada 15 min y la compuerta `¿Toca ciclo? (cada 45 min)` deja pasar cuando los minutos del día son múltiplos de 45; un intervalo de 45 min del propio disparador daría `*/45` (minutos :00 y :45 de cada hora, 48 al día y desiguales). "Prueba manual" no pasa por la compuerta.
- **Portada:** Higgsfield (Soul 2, 1080p, 3:2) con el mismo prompt de siempre. Envía la solicitud, consulta cada 12 s (máx. 14 veces, ~3 min) y descarga la imagen. Si algo falla (sin saldo, moderación, tiempo agotado, error de red), cae en el respaldo `OpenAI - Imagen GPT`; el post nunca se queda sin portada por esto.
- **Credencial:** `Higgsfield API` (id `higgsfieldCred0001`, tipo Header Auth): nombre `Authorization`, valor `Key <ID>:<SECRET>`. Nunca en el repositorio. Se crea en el n8n del VPS (importación de credenciales o interfaz).
- **Costes:** Soul 2 1080p ≈ 0,006 $ por imagen (`POST /estimate/<modelo>` da el precio exacto de la cuenta, sin gastar). El saldo es prepago y caduca al año.
- **Volver atrás:** reimportar la versión anterior del flujo (`git show <commit anterior>:n8n/pipeline-noticias.json`), `unpublish:workflow` + `publish:workflow` y reiniciar n8n.
