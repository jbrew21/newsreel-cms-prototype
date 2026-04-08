/**
 * GET /api/analytics/author/:id
 *
 * Returns a complete author-scoped analytics bundle for the dashboard.
 * Uses the server-only admin client to bypass RLS on story_events.
 *
 * Query params:
 *   - range: '7d' | '30d' | '90d' | 'all'   (default: '30d')
 *   - compare: 'true' | 'false'              (default: 'false') — include previous period
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  getOverviewEngagement,
  getEngagementFunnel,
  getTimeSeries,
  getStoryPerformance,
  getDomainBreakdown,
  getDeviceBreakdown,
  getCountryBreakdown,
  getLoyaltyDistribution,
  getHoursHeatmap,
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
    return NextResponse.json({ error: 'author id required' }, { status: 400, headers: corsHeaders })
  }

  const { searchParams } = req.nextUrl
  const range = parseRange(searchParams.get('range'))
  const compare = searchParams.get('compare') === 'true'

  const admin = getSupabaseAdmin()

  try {
    // 1. Load all story IDs for this author
    const { data: links, error: linksError } = await admin
      .from('authors_stories_links')
      .select('story_id')
      .eq('author_id', id)

    if (linksError) {
      console.error('[analytics/author] links error:', linksError.message)
      return NextResponse.json({ error: 'Failed to load author stories' }, { status: 500, headers: corsHeaders })
    }

    const storyIds = (links || []).map((l: any) => l.story_id)
    const current = rangeToDates(range)

    // 2. Fan out all queries in parallel
    const [
      overview,
      funnel,
      timeSeries,
      performance,
      domains,
      devices,
      countries,
      loyalty,
      heatmap,
    ] = await Promise.all([
      getOverviewEngagement(admin, storyIds, current),
      getEngagementFunnel(admin, storyIds, current),
      getTimeSeries(admin, storyIds, current),
      getStoryPerformance(admin, storyIds, current),
      getDomainBreakdown(admin, storyIds, current),
      getDeviceBreakdown(admin, storyIds, current),
      getCountryBreakdown(admin, storyIds, current),
      getLoyaltyDistribution(admin, storyIds, current),
      getHoursHeatmap(admin, storyIds, current),
    ])

    // 3. Optional compare period (only overview + timeSeries — keeps payload light)
    let overviewPrev = null
    if (compare) {
      const prev = previousRange(current)
      overviewPrev = await getOverviewEngagement(admin, storyIds, prev)
    }

    return NextResponse.json(
      {
        range,
        storyCount: storyIds.length,
        overview,
        overviewPrev,
        funnel,
        timeSeries,
        performance,
        domains,
        devices,
        countries,
        loyalty,
        heatmap,
      },
      { headers: corsHeaders }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[analytics/author] error:', msg)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: corsHeaders })
  }
}
