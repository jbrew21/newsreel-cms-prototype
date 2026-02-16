import { supabase } from './client'

/**
 * CORS headers for public API endpoints
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/**
 * Resolve a media asset's public URL from its bucket + object_path
 */
export function resolveMediaUrl(asset: {
  bucket: string
  object_path: string
} | null): string | null {
  if (!asset) return null
  const { data } = supabase.storage
    .from(asset.bucket)
    .getPublicUrl(asset.object_path)
  return data.publicUrl
}

/**
 * Build a clean slide object for API response
 */
export function buildSlideResponse(slide: any) {
  const mediaUrls = (slide.slide_media || [])
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((sm: any) => ({
      url: resolveMediaUrl(sm.media_assets),
      media_type: sm.media_assets?.media_type || null,
      role: sm.role,
    }))
    .filter((m: any) => m.url)

  return {
    id: slide.id,
    slide_index: slide.slide_index,
    slide_title: slide.slide_title || null,
    slide_headline_1: slide.slide_headline_1 || null,
    slide_content_1: slide.slide_content_1 || null,
    slide_headline_2: slide.slide_headline_2 || null,
    slide_content_2: slide.slide_content_2 || null,
    slide_quote: slide.slide_quote || null,
    slide_media_source: slide.slide_media_source || null,
    portrait_video: slide.portrait_video || false,
    media: mediaUrls,
  }
}

/**
 * Build a clean story summary for list endpoints (no slides)
 */
export function buildStorySummary(story: any, coverUrl: string | null, author: any | null) {
  return {
    id: story.id,
    story_headline: story.story_headline,
    subhead: story.subhead || null,
    story_type: story.story_type || null,
    story_date: story.story_date || null,
    story_link: story.story_link || null,
    is_premium: story.is_premium,
    is_k12: story.is_k12,
    is_breaking: story.is_breaking,
    cover_url: coverUrl,
    cover_media_type: story.story_media?.find((sm: any) => sm.role === 'cover')?.media_assets?.media_type || null,
    story_media_source: story.story_media_source || null,
    author: author
      ? {
          id: author.id,
          name: `${author.author_first_name || ''} ${author.author_last_name || ''}`.trim(),
          avatar_url: author.author_avatar || null,
          role: author.author_role || null,
          organization: author.author_organization || null,
          bio: author.author_bio || null,
          cover_url: author.author_cover || null,
        }
      : null,
    slide_count: story.slides?.length || 0,
    status: story.published_at ? 'published' : 'draft',
    created_at: story.created_at,
    updated_at: story.updated_at,
    published_at: story.published_at,
  }
}
