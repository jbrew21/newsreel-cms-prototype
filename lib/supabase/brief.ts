import { supabase } from './client'
import {
  STORAGE_BUCKET,
  getFileExtension,
  buildObjectPathForStoryCover,
  buildObjectPathForSlideMedia,
  uploadAndCreateMediaAsset,
  insertStoryMedia,
  insertSlideMedia,
} from './storage'
import type {
  SaveMode,
  BriefFormData,
  SaveBriefResult,
  StoryInsert,
  SlideInsert,
} from './types'

// ============================================
// Main Save Function
// ============================================

/**
 * Save a Brief post to Supabase with all associated media and slides.
 *
 * Write order:
 * 1. Create story record (draft or published based on mode)
 * 2. Upload headline photo to storage
 * 3. Create media_asset record for headline photo
 * 4. Create story_media link (role='cover')
 * 5. For each slide:
 *    a. Create slide record
 *    b. Upload slide media to storage (if any)
 *    c. Create media_asset record for slide media
 *    d. Create slide_media link (role='hero')
 *
 * @param params.mode - 'draft' or 'publish'
 * @param params.draftState - The form data
 * @param params.userId - The authenticated user's ID
 * @returns The created story ID
 */
export async function saveBriefPost(params: {
  mode: SaveMode
  draftState: BriefFormData
  userId: string
}): Promise<SaveBriefResult> {
  const { mode, draftState, userId } = params
  const publishedAt = mode === 'publish' ? new Date().toISOString() : null

  try {
    // ========================================
    // Step 1: Create Story Record
    // ========================================
    const storyInsert: StoryInsert = {
      story_headline: draftState.story_headline || null,
      published_at: publishedAt,
      // Default values for brief format
      is_premium: false,
      is_k12: true,
      is_breaking: false,
    }

    const { data: storyData, error: storyError } = await supabase
      .from('stories')
      .insert(storyInsert)
      .select('id')
      .single()

    if (storyError || !storyData) {
      throw new Error(`Failed to create story: ${storyError?.message}`)
    }

    const storyId = storyData.id

    // ========================================
    // Step 2-4: Upload & Link Headline Photo
    // ========================================
    if (draftState.headlinePhoto) {
      const file = draftState.headlinePhoto
      const ext = getFileExtension(file)

      // Generate a temporary media ID (will be replaced by actual ID)
      const tempMediaId = crypto.randomUUID()
      const objectPath = buildObjectPathForStoryCover(storyId, tempMediaId, ext)

      // Upload file and create media asset
      const { mediaId } = await uploadAndCreateMediaAsset({
        file,
        bucket: STORAGE_BUCKET,
        objectPath,
        createdBy: userId,
      })

      // Link media to story as cover
      await insertStoryMedia({
        story_id: storyId,
        media_id: mediaId,
        role: 'cover',
        sort_order: 0,
      })
    }

    // ========================================
    // Step 5: Create Slides with Media
    // ========================================
    // Sort slides by slideIndex to ensure correct order
    const sortedSlides = [...draftState.slides].sort(
      (a, b) => a.slideIndex - b.slideIndex
    )

    for (let i = 0; i < sortedSlides.length; i++) {
      const slide = sortedSlides[i]

      // 5a: Create slide record
      // Use 1-based indexing (UI shows "Slide 1", "Slide 2", etc.)
      const slideInsert: SlideInsert = {
        story_id: storyId,
        slide_index: i + 1, // 1-based
        slide_headline_1: slide.slide_headline_1 || null,
        slide_content_1: slide.slide_content_1 || null,
        slide_headline_2: slide.slide_headline_2 || null,
        slide_content_2: slide.slide_content_2 || null,
        slide_quote: slide.slide_quote || null,
        slide_quote_source: slide.slide_quote_source || null,
        portrait_video: slide.portrait_video,
        published_at: publishedAt,
      }

      const { data: slideData, error: slideError } = await supabase
        .from('slides')
        .insert(slideInsert)
        .select('id')
        .single()

      if (slideError || !slideData) {
        throw new Error(`Failed to create slide ${i + 1}: ${slideError?.message}`)
      }

      const slideId = slideData.id

      // 5b-5d: Upload slide media (if any)
      if (slide.mediaFiles && slide.mediaFiles.length > 0) {
        for (let j = 0; j < slide.mediaFiles.length; j++) {
          const file = slide.mediaFiles[j]
          const ext = getFileExtension(file)
          const tempMediaId = crypto.randomUUID()
          const role = 'hero' // Default role for slide media
          const objectPath = buildObjectPathForSlideMedia(
            storyId,
            slideId,
            role,
            tempMediaId,
            ext
          )

          // Upload file and create media asset
          const { mediaId } = await uploadAndCreateMediaAsset({
            file,
            bucket: STORAGE_BUCKET,
            objectPath,
            createdBy: userId,
          })

          // Link media to slide
          await insertSlideMedia({
            slide_id: slideId,
            media_id: mediaId,
            role,
            sort_order: j,
          })
        }
      }
    }

    // ========================================
    // Step 6: Link Author to Story
    // ========================================
    if (draftState.author_id) {
      const { error: authorLinkError } = await supabase
        .from('authors_stories_links')
        .insert({
          author_id: draftState.author_id,
          story_id: storyId,
          author_order: 0,
          story_order: 0,
        })

      if (authorLinkError) {
        console.error('Failed to link author to story:', authorLinkError)
        // Non-fatal: story is still created
      }
    }

    return {
      storyId,
      success: true,
    }
  } catch (error) {
    console.error('Error saving brief:', error)
    return {
      storyId: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// ============================================
// Helper: Get Story with Media
// ============================================

/**
 * Fetch a story with its cover media URL
 */
export async function getStoryWithCover(storyId: string): Promise<{
  story: any
  coverUrl: string | null
} | null> {
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
          media_type
        )
      )
    `)
    .eq('id', storyId)
    .single()

  if (error || !story) {
    return null
  }

  // Find cover media
  const coverMedia = story.story_media?.find((sm: any) => sm.role === 'cover')
  let coverUrl: string | null = null

  if (coverMedia?.media_assets) {
    const asset = coverMedia.media_assets
    const { data } = supabase.storage
      .from(asset.bucket)
      .getPublicUrl(asset.object_path)
    coverUrl = data.publicUrl
  }

  return { story, coverUrl }
}
