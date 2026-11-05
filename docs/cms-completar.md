# CMS: completar artículos (portada, categoría y traducción)

El CMS tiene dos modos de escribir. Los dos deben terminar con un artículo completo:

| | **Asistido** | **Manual** (y editar un artículo ya guardado) |
|---|---|---|
| Quién escribe | n8n a partir de titular y cuerpo | el editor |
| Portada, categoría y traducción | las genera el flujo `CMS Editorial` (`cms-editorial`) | las genera el flujo **`CMS Completar articulo`** (`cms-completar`) |

Antes de este cambio, un artículo manual se guardaba tal cual: sin portada, sin categoría y sin versión en el otro idioma, y nadie lo avisaba.

## Cómo funciona
1. Al **publicar** (nuevo o editado) o al **publicar un borrador desde la lista**, la ruta del sitio calcula qué le falta (`lib/completar.ts`: `calcularFaltantes`).
2. Si falta algo, responde al editor enseguida y, **en segundo plano** (`after()` de Next), llama al webhook `cms-completar` de n8n con solo `{ post_id, solicitado_por }`. Si no falta nada, no hay llamada y no cuesta nada.
3. El flujo lee el artículo de la base y genera **solo lo que falta**:
   - **Portada:** una llamada a GPT (categoría y escena) + Higgsfield (≈ 0,006 $), con respaldo de OpenAI en calidad baja. Se guarda solo si el artículo sigue sin portada.
   - **Categoría:** la de GPT entre las cuatro existentes; solo si estaba vacía.
   - **Traducción:** el mismo traductor del modo Asistido; solo si falta el idioma opuesto, y sin sobrescribir una que el editor haya creado mientras tanto.
4. Revalida el sitio, deja registro en `pipeline_logs` y responde `{ ok, hecho, pendientes, errores }`.
5. El CMS muestra en la lista un aviso **«Le falta: portada · traducción»** con un botón **Completar**, y refresca la lista solo mientras se completa (máx. 6 min).

El **texto del editor no se toca nunca**. Tampoco se pisan portada ni categoría al guardar el formulario: un campo vacío no borra lo que el flujo ya puso (el formulario pudo abrirse antes).

## Rutas
- `POST /api/posts/completar` `{ id }` → lanza el completado (202 si falta algo, 200 si no).
- `GET /api/posts/completar?id=…` → qué le falta, sin hacer nada.
- Las rutas de publicar/editar devuelven `data.completando` con lo que faltaba.

## Configuración
- El webhook se deduce de `N8N_WEBHOOK_EDITORIAL` cambiando el final `cms-editorial` por `cms-completar`. Si hace falta otra dirección: `N8N_WEBHOOK_COMPLETAR`.
- Credenciales de n8n que usa: `Supabase account 2`, `OpenAI account 2`, `Higgsfield API` y `Pipeline API portadas` (para revalidar).
- Importar: `n8n import:workflow --input=n8n/cms-completar.json` y `n8n publish:workflow --id=cmsCompletar0001`.

## Límites conocidos
- Si el editor **cambia el texto** de un artículo que ya tiene traducción, la traducción **no se regenera** (puede quedar desfasada). Hoy solo se crea cuando falta.
- La categoría la elige GPT entre cuatro; el editor puede cambiarla a mano.
- Un artículo no se completa dos veces a la vez (guardia en memoria del servidor del sitio).
