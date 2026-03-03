import { NextResponse } from 'next/server'
import { generateAudioForStory } from '@/lib/audio/generate-audio'

export async function POST(request: Request) {
  try {
    const { storyId } = await request.json()

    if (!storyId || typeof storyId !== 'string') {
      return NextResponse.json({ error: 'storyId is required' }, { status: 400 })
    }

    // Run generation — client fires and forgets, so this
    // completes server-side without blocking the UI.
    await generateAudioForStory(storyId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Audio API] Error:', error)
    return NextResponse.json({ error: 'Audio generation failed' }, { status: 500 })
  }
}
