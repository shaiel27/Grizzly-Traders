import { NextResponse } from 'next/server'
import { requireEditor } from '@/lib/auth'
import { N8N_API_KEY, n8nUrl } from '@/lib/n8n'


// Turns the publishing pipeline on or off. This is a system-wide switch (every scheduled run),
// not a per-article action, so it lives in its own route rather than beside /trigger-pipeline.
export async function POST(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  if (!N8N_API_KEY) {
    return NextResponse.json({ success: false, error: 'Automatización no configurada (falta N8N_API_KEY)' }, { status: 503 })
  }

  const { active } = await request.json().catch(() => ({ active: undefined }))
  if (typeof active !== 'boolean') {
    return NextResponse.json({ success: false, error: 'Falta indicar el estado deseado' }, { status: 400 })
  }

  try {
    const response = await fetch(n8nUrl(active ? '/activate' : '/deactivate'), {
      method: 'POST',
      headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error(`n8n respondió HTTP ${response.status}`)
    const data = await response.json()
    return NextResponse.json({ success: true, active: Boolean(data.active) })
  } catch (error) {
    console.error('n8n automation toggle error:', error)
    return NextResponse.json({ success: false, error: 'No se pudo cambiar el estado de la automatización' }, { status: 502 })
  }
}
