/**
 * GET /api/analytics/story/:id
 *
 * Returns a complete story-scoped analytics bundle for the per-story deep dive.
 * Uses the server-only admin client to bypass RLS on story_events.
 *
 * Query params:
 *   - range: '7d' | '30d' | '90d' | 'all'   (default: '30d')
 *   - compare: 'true' | 'false'              (default: 'false')
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  getOverviewEngagement,
  getTimeSeries,
  getRetentionCurve,
  getTimePerSlide,
  getDomainBreakdown,
  getDeviceBreakdown,
  getCountryBreakdown,
  getEngagementFunnel,
  rangeToDates,
  previousRange,
  type PeriodRange,
} from '@/lib/supabase/analytics-events'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function parseRange(v: string | null): PeriodRange {
  if (v === '7d' || v === '30d' || v === '90d' || v === 'all') return v
  return '30d'
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'story id required' }, { status: 400, headers: corsHeaders })
  }

  const { searchParams } = req.nextUrl
  const range = parseRange(searchParams.get('range'))
  const compare = searchParams.get('compare') === 'true'

  const admin = getSupabaseAdmin()

  try {
    // 1. Load story metadata + slide count + authors
    const { data: story, error: storyError } = await admin
      .from('stories')
      .select(`
        id,
        story_headline,
        subhead,
        story_type,
        published_at,
        created_at,
        story_media ( role, media_assets ( bucket, object_path, media_type ) ),
        slides ( id ),
        authors_stories_links ( authors ( id, author_first_name, author_last_name, author_avatar ) )
      `)
      .eq('id', id)
      .maybeSingle()

    if (storyError || !story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404, headers: corsHeaders })
    }

    const current = rangeToDates(range)

    // 2. Fan out queries in parallel
    const [
      overview,
      funnel,
      timeSeries,
      retention,
      timePerSlide,
      domains,
      devices,
      countries,
    ] = await Promise.all([
      getOverviewEngagement(admin, [id], current),
      getEngagementFunnel(admin, [id], current),
      getTimeSeries(admin, [id], current),
      getRetentionCurve(admin, id, current),
      getTimePerSlide(admin, id, current),
      getDomainBreakdown(admin, [id], current),
      getDeviceBreakdown(admin, [id], current),
      getCountryBreakdown(admin, [id], current),
    ])

    let overviewPrev = null
    if (compare) {
      overviewPrev = await getOverviewEngagement(admin, [id], previousRange(current))
    }

    // Shape cover URL
    const coverLink = (story as any).story_media?.find((sm: any) => sm.role === 'cover')
    let coverUrl: string | null = null
    let coverType: string | null = null
    if (coverLink?.media_assets?.bucket && coverLink?.media_assets?.object_path) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || `${supabaseUrl}/storage/v1/object/public`
      coverUrl = `${cdnUrl}/${coverLink.media_assets.bucket}/${coverLink.media_assets.object_path}`
      coverType = coverLink.media_assets.media_type || null
    }

    const authors = ((story as any).authors_stories_links || [])
      .map((l: any) => l.authors)
      .filter(Boolean)
      .map((a: any) => ({
        id: a.id,
        name: `${a.author_first_name || ''} ${a.author_last_name || ''}`.trim(),
        avatar_url: a.author_avatar || null,
      }))

    return NextResponse.json(
      {
        story: {
          id: story.id,
          headline: story.story_headline,
          subhead: story.subhead,
          story_type: story.story_type,
          published_at: story.published_at,
          created_at: story.created_at,
          slide_count: (story as any).slides?.length ?? 0,
          cover_url: coverUrl,
          cover_media_type: coverType,
          authors,
        },
        range,
        overview,
        overviewPrev,
        funnel,
        timeSeries,
        retention,
        timePerSlide,
        domains,
        devices,
        countries,
      },
      { headers: corsHeaders }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[analytics/story] error:', msg)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: corsHeaders })
  }
}
