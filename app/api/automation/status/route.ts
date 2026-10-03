import { NextResponse } from 'next/server'
import { requireEditor } from '@/lib/auth'

// n8n Cloud instance + workflow id are not secrets (they're just addresses); only the API key is.
const N8N_BASE_URL = 'https://shai27.app.n8n.cloud'
const N8N_WORKFLOW_ID = 'xvENLqv9HYCbOVcj'
const N8N_API_KEY = process.env.N8N_API_KEY ?? ''

// Whether the CMS can control the pipeline at all. Until N8N_API_KEY is set, the button stays
// disabled instead of pretending to reflect a state the server has no way to actually check.
export async function GET() {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  if (!N8N_API_KEY) {
    return NextResponse.json({ success: true, configured: false, active: null })
  }

  try {
    const response = await fetch(`${N8N_BASE_URL}/api/v1/workflows/${N8N_WORKFLOW_ID}`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    return NextResponse.json({ success: true, configured: true, active: Boolean(data.active) })
  } catch (error) {
    console.error('n8n automation status error:', error)
    return NextResponse.json({ success: false, configured: true, active: null, error: 'No se pudo consultar el estado' }, { status: 502 })
  }
}
