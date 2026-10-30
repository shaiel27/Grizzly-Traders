# Flujos de n8n

`pipeline-noticias.json` es el flujo "Pipeline Noticias Financieras" (RSS → GPT → portada → Supabase). No contiene llaves: las credenciales se referencian por nombre (`Supabase account 2`, `Pipeline API portadas`, OpenAI, Firecrawl) y hay que crearlas en cada instancia.

Importar y activar (con n8n parado o reiniciándolo después):

```
n8n import:workflow --input=n8n/pipeline-noticias.json
n8n publish:workflow --id=xvENLqv9HYCbOVcj
```

Probar una vuelta sin esperar los 15 minutos: `n8n execute --id=xvENLqv9HYCbOVcj` (arranca desde el nodo "Prueba manual"; si n8n ya está corriendo, usar otro `N8N_RUNNERS_BROKER_PORT`).

Antes de desplegar en el VPS: el nodo "Componer portada" apunta a `http://localhost:3100`; cambiarlo a la dirección del sitio. Detalles en `docs/portadas.md`.
