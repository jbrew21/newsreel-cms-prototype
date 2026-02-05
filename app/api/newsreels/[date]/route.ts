import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { corsHeaders, resolveMediaUrl } from '@/lib/supabase/api-helpers'

/**
 * GET /api/newsreels/:date
 *
 * Public endpoint to get all published stories for a specific date.
 * Date format: YYYY-MM-DD
 *
 * Returns: { date, newsreel (if exists), stories: [...] }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params

  // Validate date format
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD' },
      { status: 400, headers: corsHeaders }
    )
  }

  try {
    // Fetch the newsreel record for this date (if it exists)
    const { data: newsreel } = await supabase
      .from('newsreels')
      .select('id, newsreel_date, newsreel_day, is_active')
      .eq('newsreel_date', date)
      .maybeSingle()

    // Fetch all published stories for this date
    const { data: stories, error } = await supabase
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
            author_avatar
          )
        )
      `)
      .eq('story_date', date)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders })
    }

    const result = (stories || []).map((story: any) => {
      const coverMedia = story.story_media?.find((sm: any) => sm.role === 'cover')
      const coverUrl = coverMedia?.media_assets ? resolveMediaUrl(coverMedia.media_assets) : null

      const authorLink = story.authors_stories_links?.[0]
      const author = authorLink?.authors || null

      return {
        id: story.id,
        story_headline: story.story_headline,
        subhead: story.subhead || null,
        story_type: story.story_type || null,
        story_date: story.story_date || null,
        story_link: story.story_link || null,
        cover_url: coverUrl,
        cover_media_type: coverMedia?.media_assets?.media_type || null,
        is_premium: story.is_premium,
        is_k12: story.is_k12,
        is_breaking: story.is_breaking,
        author: author
          ? {
              id: author.id,
              name: `${author.author_first_name || ''} ${author.author_last_name || ''}`.trim(),
              avatar_url: author.author_avatar || null,
            }
          : null,
        slide_count: story.slides?.length || 0,
        created_at: story.created_at,
        published_at: story.published_at,
      }
    })

    return NextResponse.json({
      date,
      newsreel: newsreel
        ? {
            id: newsreel.id,
            date: newsreel.newsreel_date,
            day: newsreel.newsreel_day,
            is_active: newsreel.is_active,
          }
        : null,
      stories: result,
      story_count: result.length,
    }, { headers: corsHeaders })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500, headers: corsHeaders })
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}
