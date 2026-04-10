import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { corsHeaders, resolveMediaUrl, buildSlideResponse } from '@/lib/supabase/api-helpers'
import {
  NEWSREEL_HOUSE_DOMAIN,
  getAuthorBrandByDomain,
  resolveBrandDomain,
  resolveDisplayBrand,
} from '@/lib/supabase/author-brand'

/**
 * GET /api/stories/:id
 *
 * Public endpoint to get a complete story with all its data:
 * - Story details
 * - Cover media URL
 * - All slides with their media URLs (sorted by slide_index)
 * - Quiz (if any)
 * - Poll (if any)
 * - Author details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'Story ID is required' }, { status: 400, headers: corsHeaders })
  }

  try {
    // Fetch story with all nested relations
    const { data: story, error } = await supabase
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
            media_type,
            mime_type,
            width,
            height,
            duration_ms
          )
        ),
        slides (
          id,
          slide_index,
          slide_title,
          slide_headline_1,
          slide_content_1,
          slide_headline_2,
          slide_content_2,
          slide_quote,
          slide_media_source,
          portrait_video,
          slide_media (
            media_id,
            role,
            sort_order,
            media_assets (
              id,
              bucket,
              object_path,
              media_type,
              mime_type,
              width,
              height,
              duration_ms
            )
          )
        ),
        authors_stories_links (
          author_id,
          author_order,
          authors (
            id,
            author_first_name,
            author_last_name,
            author_bio,
            author_role,
            author_organization,
            author_avatar,
            author_cover,
            author_twitter,
            author_linked_in
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error || !story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404, headers: corsHeaders })
    }

    // Fetch quiz
    const { data: quizzes } = await supabase
      .from('quizzes')
      .select('id, quiz_content, quiz_answer_a, quiz_answer_b, quiz_answer_c, quiz_answer_d')
      .eq('story_id', id)
      .limit(1)

    // Fetch poll
    const { data: polls } = await supabase
      .from('polls')
      .select('id, question, econ_weight, social_weight, importance')
      .eq('story_id', id)
      .limit(1)

    // Fetch captions for all slides in this story
    const { data: captionRows } = await supabase
      .from('slide_captions')
      .select('slide_id, captions')
      .eq('story_id', id)

    // Build a lookup: slide_id → captions array
    const captionsMap: Record<string, any> = {}
    if (captionRows) {
      for (const row of captionRows) {
        captionsMap[row.slide_id] = row.captions
      }
    }

    // Fetch audio narration for this story
    const { data: storyAudio } = await supabase
      .from('story_audio')
      .select('audio_url, narration_text, voice, duration_ms')
      .eq('story_id', id)
      .limit(1)
      .single()

    // Fetch enrichment data for this story
    const { data: storyEnrichment } = await supabase
      .from('story_enrichment')
      .select('category, subcategory, topics, tags, entities, locale_country, locale_region, locale_city, coordinates, scope, sentiment')
      .eq('story_id', id)
      .limit(1)
      .single()

    // Resolve cover media
    const coverMedia = story.story_media?.find((sm: any) => sm.role === 'cover')
    const coverAsset = coverMedia?.media_assets || null
    const coverUrl = resolveMediaUrl(coverAsset)

    // Build slides sorted by slide_index, with captions attached
    const sortedSlides = (story.slides || [])
      .sort((a: any, b: any) => a.slide_index - b.slide_index)
      .map((slide: any) => ({
        ...buildSlideResponse(slide),
        captions: captionsMap[slide.id] || null,
      }))

    // Build author info
    const authorLinks = (story.authors_stories_links || [])
      .sort((a: any, b: any) => (a.author_order || 0) - (b.author_order || 0))
    const authors = authorLinks
      .map((link: any) => link.authors)
      .filter(Boolean)
      .map((author: any) => ({
        id: author.id,
        first_name: author.author_first_name || null,
        last_name: author.author_last_name || null,
        name: `${author.author_first_name || ''} ${author.author_last_name || ''}`.trim(),
        bio: author.author_bio || null,
        role: author.author_role || null,
        organization: author.author_organization || null,
        avatar_url: author.author_avatar || null,
        cover_url: author.author_cover || null,
        twitter: author.author_twitter || null,
        linkedin: author.author_linked_in || null,
      }))

    // ── Publisher brand resolution ───────────────────────────────────────
    // Resolve the brand for this story's first author. Email is fetched
    // in a separate query so it never lands in the public `authors[]`
    // response. Both lookups run in parallel to keep latency flat.
    const firstAuthorId: string | null = authors[0]?.id ?? null
    let brandDomain: string | null = null
    if (firstAuthorId) {
      const { data: emailRow } = await supabase
        .from('authors')
        .select('author_email')
        .eq('id', firstAuthorId)
        .maybeSingle()
      brandDomain = resolveBrandDomain(emailRow?.author_email ?? null)
    }

    const [authorBrand, houseBrand] = await Promise.all([
      brandDomain ? getAuthorBrandByDomain(brandDomain).catch(() => null) : null,
      getAuthorBrandByDomain(NEWSREEL_HOUSE_DOMAIN).catch(() => null),
    ])
    const resolvedBrand = resolveDisplayBrand(authorBrand, houseBrand)
    const brand = {
      logo_url: resolvedBrand.logo_url,
      primary_color: resolvedBrand.primary_color,
      secondary_color: resolvedBrand.secondary_color,
    }

    // Build quiz
    const quiz = quizzes?.[0]
      ? {
          id: quizzes[0].id,
          question: quizzes[0].quiz_content,
          answer_a: quizzes[0].quiz_answer_a,
          answer_b: quizzes[0].quiz_answer_b,
          answer_c: quizzes[0].quiz_answer_c,
          answer_d: quizzes[0].quiz_answer_d,
        }
      : null

    // Build poll
    const poll = polls?.[0]
      ? {
          id: polls[0].id,
          question: polls[0].question,
          econ_weight: polls[0].econ_weight,
          social_weight: polls[0].social_weight,
          importance: polls[0].importance,
        }
      : null

    const response = {
      id: story.id,
      story_headline: story.story_headline,
      subhead: story.subhead || null,
      story_type: story.story_type || null,
      story_date: story.story_date || null,
      story_link: story.story_link || null,
      university: story.university || null,
      is_premium: story.is_premium,
      is_k12: story.is_k12,
      is_breaking: story.is_breaking,
      access_code: story.access_code || null,
      partner_name: story.partner_name || null,
      partner_article_link: story.partner_article_link || null,
      story_media_source: story.story_media_source || null,
      allowed_domains: story.allowed_domains || null,
      cover: {
        url: coverUrl,
        media_type: coverAsset?.media_type || null,
        mime_type: coverAsset?.mime_type || null,
        width: coverAsset?.width || null,
        height: coverAsset?.height || null,
        duration_ms: coverAsset?.duration_ms || null,
      },
      slides: sortedSlides,
      slide_count: sortedSlides.length,
      authors,
      brand,
      quiz,
      poll,
      audio: storyAudio
        ? {
            url: storyAudio.audio_url,
            narration_text: storyAudio.narration_text,
            voice: storyAudio.voice,
            duration_ms: storyAudio.duration_ms,
          }
        : null,
      enrichment: storyEnrichment
        ? {
            category: storyEnrichment.category,
            subcategory: storyEnrichment.subcategory,
            topics: storyEnrichment.topics,
            tags: storyEnrichment.tags,
            entities: storyEnrichment.entities,
            locale_country: storyEnrichment.locale_country,
            locale_region: storyEnrichment.locale_region,
            locale_city: storyEnrichment.locale_city,
            coordinates: storyEnrichment.coordinates,
            scope: storyEnrichment.scope,
            sentiment: storyEnrichment.sentiment,
          }
        : null,
      created_at: story.created_at,
      updated_at: story.updated_at,
      published_at: story.published_at,
    }

    return NextResponse.json({ story: response }, { headers: corsHeaders })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500, headers: corsHeaders })
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}
