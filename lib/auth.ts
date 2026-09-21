import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function editorEmails(): string[] {
  return (process.env.CMS_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export type EditorResult =
  | { status: 'ok'; user: User }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }

export async function getEditor(): Promise<EditorResult> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user

  if (!user?.email) return { status: 'unauthenticated' }
  if (!editorEmails().includes(user.email.toLowerCase())) return { status: 'forbidden' }

  return { status: 'ok', user }
}

export async function requireEditor(): Promise<{ user: User } | { response: NextResponse }> {
  const result = await getEditor()

  if (result.status === 'ok') return { user: result.user }

  const forbidden = result.status === 'forbidden'
  return {
    response: NextResponse.json(
      { success: false, error: forbidden ? 'Sin permisos' : 'No autenticado' },
      { status: forbidden ? 403 : 401 }
    ),
  }
}
