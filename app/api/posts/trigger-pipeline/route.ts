import { NextResponse } from 'next/server'
import { requireEditor } from '@/lib/auth'

const N8N_MCP_URL = process.env.N8N_MCP_URL ?? 'https://shai27.app.n8n.cloud/mcp-server/http'
const WORKFLOW_ID = process.env.N8N_WORKFLOW_ID ?? 'xvENLqv9HYCbOVcj'
const TIMEOUT_MS = 30_000
const MIN_INTERVAL_MS = 15_000

let lastRun = 0

// The MCP endpoint may answer with plain JSON or an SSE frame ("event: message\ndata: {...}")
function parseMcpBody(raw: string): { error?: { message?: string }; result?: { content?: { text?: string }[] } } {
  const dataLine = raw.split('\n').find((line) => line.startsWith('data:'))
  return JSON.parse(dataLine ? dataLine.slice(5).trim() : raw)
}

export async function POST() {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  const token = process.env.N8N_MCP_TOKEN
  if (!token) {
    return NextResponse.json({ success: false, error: 'Pipeline no configurado' }, { status: 503 })
  }

  const now = Date.now()
  if (now - lastRun < MIN_INTERVAL_MS) {
    return NextResponse.json(
      { success: false, error: 'Espera unos segundos antes de volver a ejecutar el pipeline' },
      { status: 429 }
    )
  }
  lastRun = now

  try {
    const response = await fetch(N8N_MCP_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: now,
        method: 'tools/call',
        params: { name: 'execute_workflow', arguments: { workflowId: WORKFLOW_ID } },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      console.error('Pipeline HTTP error:', response.status)
      return NextResponse.json({ success: false, error: 'El pipeline respondió con error' }, { status: 502 })
    }

    const data = parseMcpBody(await response.text())

    if (data.error) {
      console.error('Pipeline MCP error:', data.error)
      return NextResponse.json({ success: false, error: 'El pipeline devolvió un error' }, { status: 502 })
    }

    const text = data.result?.content?.[0]?.text
    let executionId: string | undefined
    if (text) {
      try {
        executionId = JSON.parse(text).executionId
      } catch {
        // non-JSON payload: workflow still ran
      }
    }

    return NextResponse.json({ success: true, executionId, message: 'Pipeline ejecutado correctamente' })
  } catch (error) {
    console.error('Trigger pipeline error:', error)
    return NextResponse.json({ success: false, error: 'No se pudo ejecutar el pipeline' }, { status: 502 })
  }
}
