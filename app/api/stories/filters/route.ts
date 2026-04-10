import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { corsHeaders } from '@/lib/supabase/api-helpers'

/**
 * GET /api/stories/filters
 *
 * Returns available enrichment filter values for building filter UIs.
 * Only returns values from stories published in the last N days (default: 14).
 *
 * Query params:
 *   - days (number, default: 14) — how far back to look for active values.
 *       Use 0 for all time.
 *
 * Returns: { categories, subcategories, topics, tags, entities, scopes, sentiments, countries }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const days = parseInt(searchParams.get('days') || '14')

  try {
    let query = supabase
      .from('story_enrichment')
      .select('category, subcategory, topics, tags, entities, scope, sentiment, locale_country, story_id')

    // Filter by recent stories if days > 0
    if (days > 0) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days)
      const cutoffISO = cutoff.toISOString()

      // Get recent story IDs first
      const { data: recentStories } = await supabase
        .from('stories')
        .select('id')
        .not('published_at', 'is', null)
        .gte('published_at', cutoffISO)

      if (!recentStories?.length) {
        return NextResponse.json({
          categories: [],
          subcategories: [],
          topics: [],
          tags: [],
          entities: [],
          scopes: [],
          sentiments: [],
          countries: [],
        }, { headers: corsHeaders })
      }

      const recentIds = recentStories.map((s) => s.id)
      query = query.in('story_id', recentIds)
    }

    const { data: rows, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders })
    }

    if (!rows?.length) {
      return NextResponse.json({
        categories: [],
        subcategories: [],
        topics: [],
        tags: [],
        entities: [],
        scopes: [],
        sentiments: [],
        countries: [],
      }, { headers: corsHeaders })
    }

    // Aggregate unique values with counts
    const categoryCounts: Record<string, number> = {}
    const subcategoryCounts: Record<string, number> = {}
    const topicCounts: Record<string, number> = {}
    const tagCounts: Record<string, number> = {}
    const entityCounts: Record<string, number> = {}
    const scopeCounts: Record<string, number> = {}
    const sentimentCounts: Record<string, number> = {}
    const countryCounts: Record<string, number> = {}

    for (const row of rows) {
      if (row.category) categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1
      if (row.subcategory) subcategoryCounts[row.subcategory] = (subcategoryCounts[row.subcategory] || 0) + 1
      if (row.scope) scopeCounts[row.scope] = (scopeCounts[row.scope] || 0) + 1
      if (row.sentiment) sentimentCounts[row.sentiment] = (sentimentCounts[row.sentiment] || 0) + 1
      if (row.locale_country) countryCounts[row.locale_country] = (countryCounts[row.locale_country] || 0) + 1

      const topics = Array.isArray(row.topics) ? row.topics : []
      for (const t of topics) {
        if (typeof t === 'string') topicCounts[t] = (topicCounts[t] || 0) + 1
      }

      const tags = Array.isArray(row.tags) ? row.tags : []
      for (const t of tags) {
        if (typeof t === 'string') tagCounts[t] = (tagCounts[t] || 0) + 1
      }

      const entities = Array.isArray(row.entities) ? row.entities : []
      for (const e of entities) {
        if (e && typeof e.name === 'string') entityCounts[e.name] = (entityCounts[e.name] || 0) + 1
      }
    }

    // Sort by count descending
    const sortByCount = (counts: Record<string, number>) =>
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count }))

    return NextResponse.json({
      categories: sortByCount(categoryCounts),
      subcategories: sortByCount(subcategoryCounts),
      topics: sortByCount(topicCounts),
      tags: sortByCount(tagCounts),
      entities: sortByCount(entityCounts),
      scopes: sortByCount(scopeCounts),
      sentiments: sortByCount(sentimentCounts),
      countries: sortByCount(countryCounts),
    }, { headers: corsHeaders })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500, headers: corsHeaders })
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}
