# PROMPT DE CONTEXTO — Conversión de generación de portadas: OpenAI → Higgsfield

> **Cómo usar este documento:** Pégalo completo como primer mensaje en una sesión nueva de Claude. Contiene todo el contexto, las decisiones ya tomadas y los objetivos exactos de la conversión. No hace falta nada más.

---

## 1. Tu rol

Eres el ingeniero que ejecuta la **migración del nodo de generación de imágenes** del pipeline automatizado de noticias de **Grizzly Traders** (portal de noticias financieras) desde OpenAI (`gpt-image-1-mini`) hasta **Higgsfield Soul 2**, incluyendo el **rediseño del prompt de portada** para que sea "seguro" (óptimo) para el nuevo modelo.

## 2. Contexto del proyecto

- **Stack:** Next.js (App Router) + Supabase (DB, Auth, Storage) + n8n local para el pipeline de noticias.
- **Supabase:** proyecto `pudzvatuubywmwdmboiq`; tablas `posts` (columna `content_html`, `status='published'`, `author_id=5`), `posts_translations`, `pipeline_logs`; bucket de Storage `post-images`.
- **n8n local:** `http://localhost:5678`, instalado en `C:\Users\Admin\Desktop\n8n` (v2.41.0), DB en `C:\Users\Admin\.n8n\database.sqlite`.
- **Workflow del pipeline:** id `xvENLqv9HYCbOVcj`. Cadena actual: Schedule (cada 15 min) → RSS/Firecrawl → dedup (~30 consultas Supabase) → **"OpenAI - Analisis GPT"** (`gpt-4o-mini`, devuelve JSON estricto en español: title, slug, content_html, sentiment, category, meta_description, **prompt_imagen**) → **"OpenAI - Imagen GPT"** (`gpt-image-1-mini`, quality `high`, size `1536x1024`) → **"Optimizar imagen"** (GraphicsMagick → WebP 23–42 KB) → upload a Storage → Insertar post / Insertar traducción / Log.
- **Estado actual del workflow:** inactivo y sin publicar (a propósito, pendiente de fixes de prompts). El trigger se ejecuta sobre la **versión publicada**, no el borrador.
- **GraphicsMagick** (no ImageMagick) en `C:\Users\Admin\tools\GraphicsMagick` — debe estar en el PATH del proceso de n8n para que el nodo EditImage funcione.
- **VPN:** el usuario necesita VPN encendida para acceder a OpenAI, y **no puede apagarla ni cambiarla** mientras trabaja con Claude (rompe su conexión).

## 3. Problema y decisión (ya resuelta — no revisar)

Costo actual por imagen (`gpt-image-1-mini`, high, 1536×1024): **≈ $0.05**. Se comparó con Higgsfield:

| Vía | Costo/imagen | Notas |
|---|---|---|
| OpenAI actual (high) | $0.05 | referencia |
| OpenAI (medium) | $0.0127 | alternativa barata sin cambiar de proveedor |
| **Higgsfield Soul 2 (API)** | **$0.0032–0.0057** | ✅ elegida — la más barata |
| Higgsfield Ideogram 4.0 | $0.03 | alternativa |
| Higgsfield Recraft V4.1 | $0.035 | alternativa |
| Higgsfield GPT Image 2.5 | ~$0.19 | más caro que OpenAI directo |

**Decisión del usuario (explícita): Opción 2 — Higgsfield Soul 2**, y rediseñar las portadas para que el modelo rinda bien.

### Vías de Higgsfield (dos cuentas distintas)

1. **App/CLI (créditos de plan):** CLI `higgsfield` instalado y autenticado en la máquina (`higgsfield account status`). Plan free con **10 créditos**; Soul 2 cuesta **0.12 créditos/imagen** (≈83 imágenes). Calidades permitidas en CLI: `1.5k` o `2k` (NO `1080p`).
2. **API de plataforma (USD por uso):** `console.higgsfield.ai` → credencial `Key ID:Secret`, endpoint `POST https://api.higgsfield.ai/higgsfield-ai/soul/v2/standard`, autenticación `Authorization: Key ID:Secret`, proceso **asíncrono** (devuelve `request_id` → poll de `status_url` hasta `completed` → URL de la imagen). **Esta cuenta está sin fondos** (top-up en console; los fallos no se cobran y se reembolsan).

### Bloqueador descubierto (importante)

- **Higgsfield rechaza las IPs de la VPN** → los jobs del CLI fallan con estado `ip_detected` (probado 2 veces). OpenAI en cambio **requiere** la VPN. Conflicto directo: con VPN encendida, el CLI de Higgsfield no genera.
- La API de plataforma (MCP/Herramientas) no devolvió `ip_detected`, solo `403 Not enough credits` — es la vía candidata a funcionar con VPN, pero necesita fondos.
- **Pendiente:** verificar si la API de plataforma genera bien con VPN activa (una vez con fondos), o si también bloquea.

## 4. Rediseño de portada (especificación — ya diseñada, úsala tal cual)

Soul es un modelo entrenado con **fotografía editorial** (retrato, moda, bodegón). El prompt 3D abstracto "tipo Octane/Unreal" del pipeline actual **no es su fuerte**. El nuevo diseño convierte la portada en **naturaleza muerta editorial cinematográfica (still-life)** respetando la identidad de marca:

- **Fondo:** carbón casi negro (equivalente a `#090909`–`#141414`).
- **Luz:** cinematográfica, dramática, profundidad de campo y bokeh suave.
- **Texturas:** vidrio esmerilado, metal cepillado, acentos de neón sutil.
- **Composición:** bodegón escultórico **centrado**; un objeto-símbolo concreto por noticia (ej. moneda de cristal flotando con cúpula de luz → privacidad del dinero digital), escena derivada del `prompt_imagen` que genera el GPT de análisis.
- **Negativos obligatorios:** sin texto/letras/números/tipografía, sin logotipos o marcas reales, sin rostros de personas reales, sin banderas ni mapas de países.

**Plantilla de prompt (inglés, formato final para Soul 2):**

```
Cinematic editorial still-life photography for a financial news portal cover.
Dark charcoal background near black (#090909), dramatic moody cinematic lighting
with shallow depth of field, soft bokeh, premium textures: frosted glass,
brushed dark metal, subtle neon light accents. Centered sculptural arrangement:
[OBJETO-SÍMBOLO derivado del prompt_imagen del artículo]. Calm, premium,
high-end magazine aesthetic. Absolutely no text, no letters, no numbers,
no typography, no logos, no real human faces, no flags, no maps.
```

Ejemplo real (noticia "efectivo digital y privacidad — informe BPI"): `[OBJETO-SÍMBOLO]` = *"a single large translucent glass coin levitating above a dark reflective surface, thin streams of light curving around it forming a protective dome shape, a faint circuit-board pattern reflected below, evoking digital money and privacy protection"*.

## 5. Objetivos de esta conversion (tu tarea)

1. **Prompt del nodo de análisis (GPT):** ajustar la instrucción `prompt_imagen` para que produzca el **objeto-símbolo físico concreto** de still-life (no descripciones de renders 3D abstractos), manteniendo el banco de motivos por temática financiera que ya existe y los negativos de marca.
2. **Reemplazar el nodo "OpenAI - Imagen GPT"** por la vía Higgsfield elegida:
   - **API plataforma:** 2 nodos (HTTP Request de generación → Wait/Poll de estado → salida con URL) — n8n solo necesita el HTTP Request + un poll; la imagen se descarga después.
   - **CLI (si la API sigue bloqueada):** nodo Execute Command con `higgsfield generate create text2image_soul_v2 --prompt "<prompt>" --quality 1.5k --json` + `higgsfield generate wait <job_id>`.
3. **Mantener la cadena posterior intacta:** Optimizar (GraphicsMagick → WebP) → subir a Storage `post-images` → inserts. Solo cambia de dónde viene la imagen.
4. **Timeout:** subir `executionTimeout` de **180 → 300 s** en la configuración del workflow (con la latencia del poll asíncrono, 180 s corta el loop).
5. **Pruebas:** una corrida manual end-to-end con la noticia más reciente; verificar imagen final WebP con `HEAD 200` en Storage y el post + traducción + log insertados.
6. **Al terminar:** recordar al usuario **publicar** la nueva versión del workflow (el Schedule dispara sobre la versión publicada) y dejarlo inactivo hasta su visto bueno.

## 6. Reglas y cuidados

- Nunca escribas claves/secrets en el código del workflow ni en archivos del repo; van en credenciales de n8n o `.env.local`.
- Si tocas la DB de n8n, trabaja sobre `workflow_entity.nodes/connections` con respaldo previo (`wf_backup.json`).
- El workflow inserta 2 posts por ejecución antes del timeout actual; no cambies ese comportamiento sin pedirlo.
- Idioma de todo el contenido del portal: **español**; los prompts de imagen van **en inglés**.
- Si Higgsfield devuelve `ip_detected` o `nsfw`, el job no se cobra; reintenta cambiando el prompt (para `nsfw`) o escala el bloqueo de IP al usuario (para `ip_detected`).

## 7. Pendientes abiertos relacionados (no incluidos en esta tarea salvo petición explícita)

- Borrar o conservar los 4 posts de prueba reales publicados en Supabase (decisión del usuario).
- Cambio R1 de prompts (artículo completo dentro del prompt) — aplazado por el usuario.
- Reposo de la VPN: la prueba de generación con el nuevo diseño quedó pendiente por `ip_detected`; script de prueba vía OpenAI como plan B en `C:\Users\Admin\AppData\Local\Temp\opencode\test_portada_openai.js`.
