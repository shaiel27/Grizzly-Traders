import { NextResponse } from 'next/server'
import { requireEditor } from '@/lib/auth'
import { N8N_API_KEY, n8nUrl } from '@/lib/n8n'


// Whether the CMS can control the pipeline at all. Until N8N_API_KEY is set, the button stays
// disabled instead of pretending to reflect a state the server has no way to actually check.
export async function GET() {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  if (!N8N_API_KEY) {
    return NextResponse.json({ success: true, configured: false, active: null })
  }

  try {
    const response = await fetch(n8nUrl(''), {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`n8n respondió HTTP ${response.status}`)
    const data = await response.json()
    return NextResponse.json({ success: true, configured: true, active: Boolean(data.active) })
  } catch (error) {
    console.error('n8n automation status error:', error)
    return NextResponse.json({ success: false, configured: true, active: null, error: 'No se pudo consultar el estado' }, { status: 502 })
  }
}
