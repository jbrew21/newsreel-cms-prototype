import type { BriefFormData, SlideFormData } from '@/lib/supabase/types'
import type { CmsStory } from './mobile-slide-preview'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inferMediaType(src: string): 'image' | 'video' {
  const lower = src.toLowerCase()
  if (
    lower.endsWith('.mp4') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.ogg') ||
    lower.includes('video')
  ) {
    return 'video'
  }
  return 'image'
}

function inferMediaTypeFromFile(file: File): 'image' | 'video' {
  return file.type.startsWith('video/') ? 'video' : 'image'
}

/**
 * Resolves the first available URL for a slide's media.
 * Priority: recorded author video → local File object URLs → savedMediaUrls → existingMediaUrls
 */
function resolveSlideMedia(
  slide: SlideFormData,
  fileObjectUrls: Map<string, string[]>,
  authorVideoUrls: Map<string, string>,
): Array<{ url: string; media_type: 'image' | 'video' | string; role: string }> {
  const media: Array<{ url: string; media_type: string; role: string }> = []

  // 0. Recorded author video (greenscreen / webcam) — takes priority
  const authorVideoUrl = authorVideoUrls.get(slide.id)
  if (authorVideoUrl) {
    media.push({ url: authorVideoUrl, media_type: 'video', role: 'hero' })
    return media
  }

  // 1. Local File object URLs (from uploads)
  const localUrls = fileObjectUrls.get(slide.id)
  if (localUrls && localUrls.length > 0) {
    const files = slide.mediaFiles
    localUrls.forEach((url, i) => {
      media.push({
        url,
        media_type: files[i] ? inferMediaTypeFromFile(files[i]) : inferMediaType(url),
        role: 'hero',
      })
    })
    return media
  }

  // 2. Saved media URLs (from media search — Pexels, Unsplash, etc.)
  if (slide.savedMediaUrls && slide.savedMediaUrls.length > 0) {
    slide.savedMediaUrls.forEach((url) => {
      media.push({ url, media_type: inferMediaType(url), role: 'hero' })
    })
    return media
  }

  // 3. Existing media URLs (from DB in edit mode)
  if (slide.existingMediaUrls && slide.existingMediaUrls.length > 0) {
    slide.existingMediaUrls.forEach((url) => {
      media.push({ url, media_type: inferMediaType(url), role: 'hero' })
    })
    return media
  }

  return media
}

// ─── Main Adapter ────────────────────────────────────────────────────────────

interface AdapterOptions {
  /** Object URL for the cover photo/video (from headlinePhotoPreview state) */
  coverPreviewUrl: string | null
  /** The cover File object (to detect video vs image) */
  coverFile: File | null
  /** Map of slide ID → object URL[] for slide media previews */
  slideMediaPreviewUrls: Map<string, string[]>
  /** Map of slide ID → preview URL for recorded author videos (greenscreen/webcam) */
  authorVideoUrls: Map<string, string>
  /** Recorded story headline video preview URL (greenscreen/webcam for cover) */
  storyHeadlineVideoUrl: string | null
  /** Author avatar URL if available */
  authorAvatarUrl: string | null
}

/**
 * Converts live BriefFormData (in-memory draft) to the CmsStory shape
 * expected by MobileSlidePreviewRenderer.
 *
 * No network calls. No Supabase. Pure data transformation.
 */
export function briefFormToCmsStory(
  draft: BriefFormData,
  options: AdapterOptions,
): CmsStory {
  const { coverPreviewUrl, coverFile, slideMediaPreviewUrls, authorVideoUrls, storyHeadlineVideoUrl, authorAvatarUrl } = options

  // Resolve cover: recorded headline video takes priority over photo
  const resolvedCoverUrl = storyHeadlineVideoUrl || coverPreviewUrl
  let coverMediaType: string | null = null
  if (storyHeadlineVideoUrl) {
    coverMediaType = 'video'
  } else if (coverFile) {
    coverMediaType = inferMediaTypeFromFile(coverFile)
  } else if (coverPreviewUrl) {
    coverMediaType = inferMediaType(coverPreviewUrl)
  }

  // Split author_name into first/last
  const nameParts = (draft.author_name || '').trim().split(/\s+/)
  const firstName = nameParts[0] || null
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null

  return {
    id: 'draft-preview',
    story_headline: draft.story_headline || 'Untitled Story',
    subhead: draft.subhead || null,
    story_media_source: draft.story_media_source || null,
    partner_name: null,
    partner_article_link: null,

    cover: resolvedCoverUrl
      ? { url: resolvedCoverUrl, media_type: coverMediaType }
      : null,

    authors: draft.author_id
      ? [
          {
            id: draft.author_id,
            first_name: firstName,
            last_name: lastName,
            avatar_url: authorAvatarUrl,
            role: null,
            organization: null,
          },
        ]
      : [],

    slides: draft.slides.map((slide) => ({
      id: slide.id,
      slide_index: slide.slideIndex,
      slide_headline_1: slide.slide_headline_1 || null,
      slide_content_1: slide.slide_content_1 || null,
      slide_headline_2: slide.slide_headline_2 || null,
      slide_content_2: slide.slide_content_2 || null,
      slide_quote: slide.slide_quote || null,
      slide_media_source: slide.slide_media_source || null,
      portrait_video: slide.portrait_video,
      media: resolveSlideMedia(slide, slideMediaPreviewUrls, authorVideoUrls),
      captions: null,
    })),

    quiz: draft.quiz
      ? {
          id: 'draft-quiz',
          question: draft.quiz.quiz_content,
          answer_a: draft.quiz.quiz_answer_a,
          answer_b: draft.quiz.quiz_answer_b || null,
          answer_c: draft.quiz.quiz_answer_c || null,
          answer_d: draft.quiz.quiz_answer_d || null,
        }
      : null,

    poll: draft.poll
      ? {
          id: 'draft-poll',
          question: draft.poll.question,
          econ_weight: draft.poll.econ_weight,
          social_weight: draft.poll.social_weight,
          importance: draft.poll.importance,
        }
      : null,
  }
}
