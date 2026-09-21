import { NextResponse } from 'next/server'
import { getAssets } from '@/lib/api'

export async function GET() {
  try {
    const assets = await getAssets()
    return NextResponse.json({ success: true, data: assets })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch assets', data: [] },
      { status: 500 }
    )
  }
}
