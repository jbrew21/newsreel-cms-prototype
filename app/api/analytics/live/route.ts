/**
 * GET /api/analytics/live?authorId=X
 *
 * Returns live pulse data + recent events feed for an author's stories.
 * Called on a short interval (e.g. 20-30s) from the dashboard pulse widget.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getLivePulse, getRecentEvents } from '@/lib/supabase/analytics-events'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const authorId = searchParams.get('authorId')
  const storyId = searchParams.get('storyId')
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

  if (!authorId && !storyId) {
    return NextResponse.json(
      { error: 'authorId or storyId required' },
      { status: 400, headers: corsHeaders }
    )
  }

  const admin = getSupabaseAdmin()

  try {
    let storyIds: string[] = []
    if (storyId) {
      storyIds = [storyId]
    } else if (authorId) {
      const { data: links } = await admin
        .from('authors_stories_links')
        .select('story_id')
        .eq('author_id', authorId)
      storyIds = (links || []).map((l: any) => l.story_id)
    }

    const [pulse, recent] = await Promise.all([
      getLivePulse(admin, storyIds),
      getRecentEvents(admin, storyIds, limit),
    ])

    return NextResponse.json(
      { pulse, recent, storyCount: storyIds.length },
      { headers: corsHeaders }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[analytics/live] error:', msg)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: corsHeaders })
  }
}
