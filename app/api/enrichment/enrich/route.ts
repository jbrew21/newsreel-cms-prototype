import { NextResponse } from 'next/server'
import { enrichStory } from '@/lib/enrichment/enrich-story'

export async function POST(request: Request) {
  try {
    const { storyId } = await request.json()

    if (!storyId || typeof storyId !== 'string') {
      return NextResponse.json({ error: 'storyId is required' }, { status: 400 })
    }

    // Run enrichment — client fires and forgets, so this
    // completes server-side without blocking the UI.
    await enrichStory(storyId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Enrichment API] Error:', error)
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 })
  }
}
