// Conexión con la API REST de n8n para pausar/reanudar el flujo de publicación desde el CMS.
// n8n corre en el mismo servidor que el sitio y solo escucha en local, por eso la dirección por defecto es 127.0.0.1:5678.
// Solo la llave es secreta (N8N_API_KEY, creada en n8n → Ajustes → n8n API); la dirección y el id del flujo no.

export const N8N_BASE_URL = (process.env.N8N_BASE_URL ?? 'http://127.0.0.1:5678').replace(/\/+$/, '')
export const N8N_WORKFLOW_ID = process.env.N8N_WORKFLOW_ID ?? 'xvENLqv9HYCbOVcj'
export const N8N_API_KEY = process.env.N8N_API_KEY ?? ''

export const n8nUrl = (ruta: string) => `${N8N_BASE_URL}/api/v1/workflows/${N8N_WORKFLOW_ID}${ruta}`
