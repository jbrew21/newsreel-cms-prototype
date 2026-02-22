import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { corsHeaders, resolveMediaUrl, buildStorySummary } from '@/lib/supabase/api-helpers'

/**
 * GET /api/stories
 *
 * Public endpoint to list published stories.
 *
 * Query params:
 *   - page (default: 1)
 *   - limit (default: 20, max: 100)
 *   - date (YYYY-MM-DD) — filter by story_date
 *   - type (string) — filter by story_type e.g. "brief"
 *   - author_id (uuid) — filter by author
 *   - status ("published" | "draft" | "all", default: "published")
 *   - sort ("newest" | "oldest", default: "newest")
 *   - search or q (string) — search in story_headline and subhead (case-insensitive)
 *   - domain (string) — filter stories visible to this email domain (e.g. "nyu.edu").
 *       Returns stories where allowed_domains is null (public) OR contains the domain.
 *
 * Returns: { stories: [...], pagination: { page, limit, total, total_pages } }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const date = searchParams.get('date')
  const type = searchParams.get('type')
  const authorId = searchParams.get('author_id')
  const status = searchParams.get('status') || 'published'
  const sort = searchParams.get('sort') || 'newest'
  const search = searchParams.get('search') || searchParams.get('q')
  const domain = searchParams.get('domain')

  const offset = (page - 1) * limit

  try {
    // Build query
    let query = supabase
      .from('stories')
      .select(`
        *,
        story_media (
          media_id,
          role,
          sort_order,
          media_assets (
            id,
            bucket,
            object_path,
            media_type
          )
        ),
        slides ( id ),
        authors_stories_links (
          author_id,
          authors (
            id,
            author_first_name,
            author_last_name,
            author_avatar,
            author_role,
            author_organization,
            author_bio,
            author_cover
          )
        )
      `, { count: 'exact' })

    // Filters
    if (status === 'published') {
      query = query.not('published_at', 'is', null)
    } else if (status === 'draft') {
      query = query.is('published_at', null)
    }
    // "all" = no published_at filter

    if (date) {
      query = query.eq('story_date', date)
    }
    if (type) {
      query = query.eq('story_type', type)
    }
    if (search) {
      // Case-insensitive search in headline and subhead
      query = query.or(`story_headline.ilike.%${search}%,subhead.ilike.%${search}%`)
    }
    if (domain) {
      // Return public stories (null allowed_domains) + stories that include this domain
      query = query.or(`allowed_domains.is.null,allowed_domains.cs.{"${domain}"}`)
    }

    // Sort
    const ascending = sort === 'oldest'
    query = query.order('published_at', { ascending, nullsFirst: false })
      .order('created_at', { ascending })

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data: stories, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders })
    }

    // If filtering by author_id, we need to post-filter since it's a junction table
    let filteredStories = stories || []
    if (authorId) {
      filteredStories = filteredStories.filter((story: any) =>
        story.authors_stories_links?.some((link: any) => link.author_id === authorId)
      )
    }

    // Build clean response
    const result = filteredStories.map((story: any) => {
      // Resolve cover URL
      const coverMedia = story.story_media?.find((sm: any) => sm.role === 'cover')
      const coverUrl = coverMedia?.media_assets ? resolveMediaUrl(coverMedia.media_assets) : null

      // Get author from junction table
      const authorLink = story.authors_stories_links?.[0]
      const author = authorLink?.authors || null

      return buildStorySummary(story, coverUrl, author)
    })

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      stories: result,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    }, { headers: corsHeaders })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500, headers: corsHeaders })
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}
