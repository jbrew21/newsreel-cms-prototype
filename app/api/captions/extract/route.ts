import { NextResponse } from 'next/server'
import { extractCaptionsForStory } from '@/lib/captions/extract-captions'

export async function POST(request: Request) {
  try {
    const { storyId } = await request.json()

    if (!storyId || typeof storyId !== 'string') {
      return NextResponse.json({ error: 'storyId is required' }, { status: 400 })
    }

    // Run extraction — client fires and forgets, so this
    // completes server-side without blocking the UI.
    await extractCaptionsForStory(storyId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Captions API] Error:', error)
    return NextResponse.json({ error: 'Caption extraction failed' }, { status: 500 })
  }
}
