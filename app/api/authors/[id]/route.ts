import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { corsHeaders, resolveMediaUrl } from '@/lib/supabase/api-helpers'

/**
 * GET /api/authors/:id
 *
 * Public endpoint to get an author's profile along with their published stories.
 *
 * Query params:
 *   - page (default: 1)
 *   - limit (default: 20, max: 100)
 *   - status ("published" | "draft" | "all", default: "all")
 *
 * Returns: { author: {...}, stories: [...], pagination: {...} }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = request.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const status = searchParams.get('status') || 'all'
  const offset = (page - 1) * limit

  if (!id) {
    return NextResponse.json({ error: 'Author ID is required' }, { status: 400, headers: corsHeaders })
  }

  try {
    // Fetch author
    const { data: author, error: authorError } = await supabase
      .from('authors')
      .select(`
        id,
        author_first_name,
        author_last_name,
        author_bio,
        author_role,
        author_organization,
        author_email,
        author_avatar,
        author_cover,
        author_twitter,
        author_linked_in,
        created_at
      `)
      .eq('id', id)
      .single()

    if (authorError || !author) {
      return NextResponse.json({ error: 'Author not found' }, { status: 404, headers: corsHeaders })
    }

    // Fetch author's story links
    const { data: storyLinks, error: linksError, count } = await supabase
      .from('authors_stories_links')
      .select('story_id', { count: 'exact' })
      .eq('author_id', id)
      .range(offset, offset + limit - 1)

    if (linksError) {
      return NextResponse.json({ error: linksError.message }, { status: 500, headers: corsHeaders })
    }

    const storyIds = (storyLinks || []).map((link: any) => link.story_id)

    // Fetch the actual stories with cover media
    let stories: any[] = []
    if (storyIds.length > 0) {
      let storyQuery = supabase
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
          slides ( id )
        `)
        .in('id', storyIds)

      if (status === 'published') {
        storyQuery = storyQuery.not('published_at', 'is', null)
      } else if (status === 'draft') {
        storyQuery = storyQuery.is('published_at', null)
      }
      // "all" = no filter

      storyQuery = storyQuery.order('created_at', { ascending: false })

      const { data: storyData } = await storyQuery

      stories = (storyData || []).map((story: any) => {
        const coverMedia = story.story_media?.find((sm: any) => sm.role === 'cover')
        const coverUrl = coverMedia?.media_assets ? resolveMediaUrl(coverMedia.media_assets) : null

        return {
          id: story.id,
          story_headline: story.story_headline,
          subhead: story.subhead || null,
          story_type: story.story_type || null,
          story_date: story.story_date || null,
          cover_url: coverUrl,
          cover_media_type: coverMedia?.media_assets?.media_type || null,
          slide_count: story.slides?.length || 0,
          is_premium: story.is_premium,
          is_k12: story.is_k12,
          is_breaking: story.is_breaking,
          status: story.published_at ? 'published' : 'draft',
          created_at: story.created_at,
          published_at: story.published_at,
        }
      })
    }

    // Fetch ALL story IDs for stats (unpaginated)
    const { data: allLinks } = await supabase
      .from('authors_stories_links')
      .select('story_id')
      .eq('author_id', id)

    let monthlyReaders = 0
    let quizAccuracy = 0
    const allStoryIds = (allLinks || []).map((link: any) => link.story_id)
    if (allStoryIds.length > 0) {
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`

      const { data: readersCount } = await supabase
        .rpc('get_author_monthly_readers', {
          story_ids: allStoryIds,
          month_start: monthStart,
          month_end: monthEnd,
        })

      if (typeof readersCount === 'number') {
        monthlyReaders = readersCount
      }

      const { data: accuracy } = await supabase
        .rpc('get_author_quiz_accuracy', {
          story_ids: allStoryIds,
        })

      if (accuracy !== null && accuracy !== undefined) {
        quizAccuracy = Number(accuracy)
      }
    }

    const authorResponse = {
      id: author.id,
      first_name: author.author_first_name || null,
      last_name: author.author_last_name || null,
      name: `${author.author_first_name || ''} ${author.author_last_name || ''}`.trim(),
      bio: author.author_bio || null,
      role: author.author_role || null,
      organization: author.author_organization || null,
      email: author.author_email || null,
      avatar_url: author.author_avatar || null,
      cover_url: author.author_cover || null,
      twitter: author.author_twitter || null,
      linkedin: author.author_linked_in || null,
      created_at: author.created_at,
      monthly_readers: monthlyReaders,
      total_stories: count || 0,
      quiz_accuracy: quizAccuracy,
    }

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      author: authorResponse,
      stories,
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
