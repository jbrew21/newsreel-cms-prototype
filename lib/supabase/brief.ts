import { supabase } from './client'
import {
  STORAGE_BUCKET,
  getFileExtension,
  getPublicUrl,
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
  QuizInsert,
  PollInsert,
  EditBriefMetadata,
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
    // If no story_date provided, use the publish date or current date
    const storyDate = draftState.story_date || (publishedAt ? publishedAt.split('T')[0] : new Date().toISOString().split('T')[0])
    // If no story_type provided, default to 'brief'
    const storyType = draftState.story_type?.trim() || 'brief'

    const storyInsert: StoryInsert = {
      story_headline: draftState.story_headline || null,
      story_date: storyDate,
      story_type: storyType,
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
        slide_media_source: slide.slide_media_source || null,
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
    // Step 6: Create Quiz (Optional)
    // ========================================
    if (draftState.quiz && draftState.quiz.quiz_content) {
      const quizInsert: QuizInsert = {
        story_id: storyId,
        quiz_content: draftState.quiz.quiz_content || null,
        quiz_answer_a: draftState.quiz.quiz_answer_a || null,
        quiz_answer_b: draftState.quiz.quiz_answer_b || null,
        quiz_answer_c: draftState.quiz.quiz_answer_c || null,
        quiz_answer_d: draftState.quiz.quiz_answer_d || null,
        published_at: publishedAt,
      }

      const { error: quizError } = await supabase
        .from('quizzes')
        .insert(quizInsert)

      if (quizError) {
        console.error('Failed to create quiz:', quizError)
        // Non-fatal: story is still created
      }
    }

    // ========================================
    // Step 7: Create Poll (Optional)
    // ========================================
    if (draftState.poll && draftState.poll.question) {
      const pollInsert: PollInsert = {
        story_id: storyId,
        question: draftState.poll.question || null,
        econ_weight: draftState.poll.econ_weight,
        social_weight: draftState.poll.social_weight,
        importance: draftState.poll.importance,
        published_at: publishedAt,
      }

      const { error: pollError } = await supabase
        .from('polls')
        .insert(pollInsert)

      if (pollError) {
        console.error('Failed to create poll:', pollError)
        // Non-fatal: story is still created
      }
    }

    // ========================================
    // Step 8: Link Author to Story
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

// ============================================
// Fetch Full Story for Editing
// ============================================

/**
 * Fetch a story with all related data (slides, media, quiz, poll, author)
 * for pre-populating the edit form.
 */
export async function getFullBriefStory(storyId: string): Promise<{
  storyData: BriefFormData
  editMetadata: EditBriefMetadata
} | null> {
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
          media_type
        )
      ),
      slides (
        id,
        slide_index,
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
            media_type
          )
        )
      ),
      authors_stories_links (
        author_id
      )
    `)
    .eq('id', storyId)
    .single()

  if (error || !story) {
    console.error('Failed to fetch story:', error)
    return null
  }

  // Fetch quiz for this story
  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id, quiz_content, quiz_answer_a, quiz_answer_b, quiz_answer_c, quiz_answer_d')
    .eq('story_id', storyId)
    .limit(1)

  // Fetch poll for this story
  const { data: polls } = await supabase
    .from('polls')
    .select('id, question, econ_weight, social_weight, importance')
    .eq('story_id', storyId)
    .limit(1)

  // Build cover URL
  const coverMedia = story.story_media?.find((sm: any) => sm.role === 'cover')
  let coverUrl: string | null = null
  if (coverMedia?.media_assets) {
    const asset = coverMedia.media_assets
    coverUrl = getPublicUrl(asset.bucket, asset.object_path)
  }

  // Build slides sorted by slide_index
  const sortedSlides = (story.slides || []).sort(
    (a: any, b: any) => a.slide_index - b.slide_index
  )

  const slides = sortedSlides.map((slide: any) => {
    // Build media URLs for this slide
    const mediaUrls = (slide.slide_media || [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((sm: any) => {
        if (sm.media_assets) {
          return getPublicUrl(sm.media_assets.bucket, sm.media_assets.object_path)
        }
        return null
      })
      .filter(Boolean) as string[]

    return {
      id: slide.id, // Use database ID
      slideIndex: slide.slide_index,
      slide_headline_1: slide.slide_headline_1 || '',
      slide_content_1: slide.slide_content_1 || '',
      slide_headline_2: slide.slide_headline_2 || '',
      slide_content_2: slide.slide_content_2 || '',
      slide_quote: slide.slide_quote || '',
      slide_media_source: slide.slide_media_source || '',
      portrait_video: slide.portrait_video || false,
      mediaFiles: [] as File[], // No File objects for existing media
      savedMediaUrls: mediaUrls,
    }
  })

  // Build quiz form data
  const existingQuiz = quizzes?.[0] || null
  const quizFormData = existingQuiz
    ? {
        quiz_content: existingQuiz.quiz_content || '',
        quiz_answer_a: existingQuiz.quiz_answer_a || '',
        quiz_answer_b: existingQuiz.quiz_answer_b || '',
        quiz_answer_c: existingQuiz.quiz_answer_c || '',
        quiz_answer_d: existingQuiz.quiz_answer_d || '',
      }
    : null

  // Build poll form data
  const existingPoll = polls?.[0] || null
  const pollFormData = existingPoll
    ? {
        question: existingPoll.question || '',
        econ_weight: existingPoll.econ_weight,
        social_weight: existingPoll.social_weight,
        importance: existingPoll.importance,
      }
    : null

  // Get author info
  const authorId = story.authors_stories_links?.[0]?.author_id || null
  let authorName = ''
  if (authorId) {
    const { data: authorData } = await supabase
      .from('authors')
      .select('author_first_name, author_last_name')
      .eq('id', authorId)
      .single()
    if (authorData) {
      authorName = `${authorData.author_first_name || ''} ${authorData.author_last_name || ''}`.trim()
    }
  }

  const storyData: BriefFormData = {
    story_headline: story.story_headline || '',
    headlinePhoto: null, // Can't fetch File from URL
    headlinePhotoUrl: coverUrl || undefined,
    author_id: authorId,
    author_name: authorName,
    story_type: story.story_type || null,
    story_date: story.story_date || null,
    slides,
    quiz: quizFormData,
    poll: pollFormData,
  }

  const editMetadata: EditBriefMetadata = {
    storyId,
    existingCoverUrl: coverUrl,
    existingSlideIds: sortedSlides.map((s: any) => s.id),
    existingQuizId: existingQuiz?.id || null,
    existingPollId: existingPoll?.id || null,
  }

  return { storyData, editMetadata }
}

// ============================================
// Update Existing Brief
// ============================================

/**
 * Update an existing Brief post. Handles:
 * - Updating story headline and published_at
 * - Replacing cover photo if new one uploaded
 * - Adding/updating/deleting slides
 * - Adding/updating/deleting quiz and poll
 */
export async function updateBriefPost(params: {
  mode: SaveMode
  draftState: BriefFormData
  userId: string
  editMetadata: EditBriefMetadata
}): Promise<SaveBriefResult> {
  const { mode, draftState, userId, editMetadata } = params
  const { storyId, existingSlideIds, existingQuizId, existingPollId } = editMetadata
  const publishedAt = mode === 'publish' ? new Date().toISOString() : null

  try {
    // ========================================
    // Step 1: Update Story Record
    // ========================================
    // If no story_date provided, keep existing or use publish/update date
    const storyDate = draftState.story_date || (publishedAt ? publishedAt.split('T')[0] : new Date().toISOString().split('T')[0])
    // If no story_type provided, default to 'brief'
    const storyType = draftState.story_type?.trim() || 'brief'

    const { error: storyError } = await supabase
      .from('stories')
      .update({
        story_headline: draftState.story_headline || null,
        story_date: storyDate,
        story_type: storyType,
        published_at: publishedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', storyId)

    if (storyError) {
      throw new Error(`Failed to update story: ${storyError.message}`)
    }

    // ========================================
    // Step 2: Handle Cover Photo
    // ========================================
    if (draftState.headlinePhoto) {
      // New cover uploaded - delete old one first
      const { data: oldCoverLinks } = await supabase
        .from('story_media')
        .select('media_id, media_assets ( id, bucket, object_path )')
        .eq('story_id', storyId)
        .eq('role', 'cover')

      if (oldCoverLinks && oldCoverLinks.length > 0) {
        for (const link of oldCoverLinks) {
          const asset = (link as any).media_assets
          if (asset) {
            await supabase.storage.from(asset.bucket).remove([asset.object_path])
            await supabase.from('story_media').delete().eq('story_id', storyId).eq('media_id', link.media_id)
            await supabase.from('media_assets').delete().eq('id', asset.id)
          }
        }
      }

      // Upload new cover
      const file = draftState.headlinePhoto
      const ext = getFileExtension(file)
      const tempMediaId = crypto.randomUUID()
      const objectPath = buildObjectPathForStoryCover(storyId, tempMediaId, ext)

      const { mediaId } = await uploadAndCreateMediaAsset({
        file,
        bucket: STORAGE_BUCKET,
        objectPath,
        createdBy: userId,
      })

      await insertStoryMedia({
        story_id: storyId,
        media_id: mediaId,
        role: 'cover',
        sort_order: 0,
      })
    }
    // If no new headlinePhoto, existing cover is kept as-is

    // ========================================
    // Step 3: Handle Slides
    // ========================================
    const currentSlideIds = draftState.slides.map(s => s.id)

    // 3a: Delete removed slides
    const slidesToDelete = existingSlideIds.filter(id => !currentSlideIds.includes(id))
    for (const slideId of slidesToDelete) {
      // Delete slide media from storage
      const { data: slideMediaLinks } = await supabase
        .from('slide_media')
        .select('media_id, media_assets ( id, bucket, object_path )')
        .eq('slide_id', slideId)

      if (slideMediaLinks) {
        for (const link of slideMediaLinks) {
          const asset = (link as any).media_assets
          if (asset) {
            await supabase.storage.from(asset.bucket).remove([asset.object_path])
            await supabase.from('slide_media').delete().eq('slide_id', slideId).eq('media_id', link.media_id)
            await supabase.from('media_assets').delete().eq('id', asset.id)
          }
        }
      }

      // Delete the slide record
      await supabase.from('slides').delete().eq('id', slideId)
    }

    // 3b: Update existing slides and create new ones
    const sortedSlides = [...draftState.slides].sort(
      (a, b) => a.slideIndex - b.slideIndex
    )

    for (let i = 0; i < sortedSlides.length; i++) {
      const slide = sortedSlides[i]
      const isExisting = existingSlideIds.includes(slide.id)

      if (isExisting) {
        // Update existing slide
        await supabase
          .from('slides')
          .update({
            slide_index: i + 1,
            slide_headline_1: slide.slide_headline_1 || null,
            slide_content_1: slide.slide_content_1 || null,
            slide_headline_2: slide.slide_headline_2 || null,
            slide_content_2: slide.slide_content_2 || null,
            slide_quote: slide.slide_quote || null,
            slide_media_source: slide.slide_media_source || null,
            portrait_video: slide.portrait_video,
            published_at: publishedAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', slide.id)

        // If new media files uploaded, replace old media
        if (slide.mediaFiles && slide.mediaFiles.length > 0) {
          // Delete old slide media
          const { data: oldSlideMedia } = await supabase
            .from('slide_media')
            .select('media_id, media_assets ( id, bucket, object_path )')
            .eq('slide_id', slide.id)

          if (oldSlideMedia) {
            for (const link of oldSlideMedia) {
              const asset = (link as any).media_assets
              if (asset) {
                await supabase.storage.from(asset.bucket).remove([asset.object_path])
                await supabase.from('slide_media').delete().eq('slide_id', slide.id).eq('media_id', link.media_id)
                await supabase.from('media_assets').delete().eq('id', asset.id)
              }
            }
          }

          // Upload new media
          for (let j = 0; j < slide.mediaFiles.length; j++) {
            const file = slide.mediaFiles[j]
            const ext = getFileExtension(file)
            const tempMediaId = crypto.randomUUID()
            const role = 'hero'
            const objectPath = buildObjectPathForSlideMedia(storyId, slide.id, role, tempMediaId, ext)

            const { mediaId } = await uploadAndCreateMediaAsset({
              file,
              bucket: STORAGE_BUCKET,
              objectPath,
              createdBy: userId,
            })

            await insertSlideMedia({
              slide_id: slide.id,
              media_id: mediaId,
              role,
              sort_order: j,
            })
          }
        }
        // If no new mediaFiles, existing media is kept
      } else {
        // Insert new slide
        const slideInsert: SlideInsert = {
          story_id: storyId,
          slide_index: i + 1,
          slide_headline_1: slide.slide_headline_1 || null,
          slide_content_1: slide.slide_content_1 || null,
          slide_headline_2: slide.slide_headline_2 || null,
          slide_content_2: slide.slide_content_2 || null,
          slide_quote: slide.slide_quote || null,
          slide_media_source: slide.slide_media_source || null,
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

        const newSlideId = slideData.id

        // Upload media for new slide
        if (slide.mediaFiles && slide.mediaFiles.length > 0) {
          for (let j = 0; j < slide.mediaFiles.length; j++) {
            const file = slide.mediaFiles[j]
            const ext = getFileExtension(file)
            const tempMediaId = crypto.randomUUID()
            const role = 'hero'
            const objectPath = buildObjectPathForSlideMedia(storyId, newSlideId, role, tempMediaId, ext)

            const { mediaId } = await uploadAndCreateMediaAsset({
              file,
              bucket: STORAGE_BUCKET,
              objectPath,
              createdBy: userId,
            })

            await insertSlideMedia({
              slide_id: newSlideId,
              media_id: mediaId,
              role,
              sort_order: j,
            })
          }
        }
      }
    }

    // ========================================
    // Step 4: Handle Quiz
    // ========================================
    if (draftState.quiz && draftState.quiz.quiz_content) {
      if (existingQuizId) {
        // Update existing quiz
        await supabase
          .from('quizzes')
          .update({
            quiz_content: draftState.quiz.quiz_content || null,
            quiz_answer_a: draftState.quiz.quiz_answer_a || null,
            quiz_answer_b: draftState.quiz.quiz_answer_b || null,
            quiz_answer_c: draftState.quiz.quiz_answer_c || null,
            quiz_answer_d: draftState.quiz.quiz_answer_d || null,
            published_at: publishedAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingQuizId)
      } else {
        // Insert new quiz
        await supabase.from('quizzes').insert({
          story_id: storyId,
          quiz_content: draftState.quiz.quiz_content || null,
          quiz_answer_a: draftState.quiz.quiz_answer_a || null,
          quiz_answer_b: draftState.quiz.quiz_answer_b || null,
          quiz_answer_c: draftState.quiz.quiz_answer_c || null,
          quiz_answer_d: draftState.quiz.quiz_answer_d || null,
          published_at: publishedAt,
        })
      }
    } else if (existingQuizId) {
      // Quiz was removed - delete it
      await supabase.from('quizzes').delete().eq('id', existingQuizId)
    }

    // ========================================
    // Step 5: Handle Poll
    // ========================================
    if (draftState.poll && draftState.poll.question) {
      if (existingPollId) {
        // Update existing poll
        await supabase
          .from('polls')
          .update({
            question: draftState.poll.question || null,
            econ_weight: draftState.poll.econ_weight,
            social_weight: draftState.poll.social_weight,
            importance: draftState.poll.importance,
            published_at: publishedAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPollId)
      } else {
        // Insert new poll
        await supabase.from('polls').insert({
          story_id: storyId,
          question: draftState.poll.question || null,
          econ_weight: draftState.poll.econ_weight,
          social_weight: draftState.poll.social_weight,
          importance: draftState.poll.importance,
          published_at: publishedAt,
        })
      }
    } else if (existingPollId) {
      // Poll was removed - delete it
      await supabase.from('polls').delete().eq('id', existingPollId)
    }

    return {
      storyId,
      success: true,
    }
  } catch (error) {
    console.error('Error updating brief:', error)
    return {
      storyId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}
