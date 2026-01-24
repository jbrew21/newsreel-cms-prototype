import { supabase } from './client'
import {
  STORAGE_BUCKET,
  getFileExtension,
  buildObjectPathForVideoFeedVideo,
  buildObjectPathForVideoFeedPoster,
  uploadAndCreateMediaAsset,
  insertVideoFeedMedia,
} from './storage'
import type {
  SaveMode,
  VerticalVideoFormData,
  SaveVerticalVideoResult,
  VideoFeedInsert,
} from './types'

// ============================================
// Main Save Function
// ============================================

/**
 * Save a Vertical Video post to Supabase with video and optional poster.
 *
 * Write order:
 * 1. Create video_feeds record (draft or published based on mode)
 * 2. Upload video file to storage
 * 3. Create media_assets record for video
 * 4. Create video_feed_media link (role='video')
 * 5. If poster provided:
 *    a. Upload poster to storage
 *    b. Create media_assets record for poster
 *    c. Create video_feed_media link (role='poster')
 *
 * @param params.mode - 'draft' or 'publish'
 * @param params.draftState - The form data
 * @param params.userId - The authenticated user's ID
 * @returns The created video feed ID and public URLs
 */
export async function saveVerticalVideoPost(params: {
  mode: SaveMode
  draftState: VerticalVideoFormData
  userId: string
}): Promise<SaveVerticalVideoResult> {
  const { mode, draftState, userId } = params
  const publishedAt = mode === 'publish' ? new Date().toISOString() : null

  let videoUrl: string | undefined
  let posterUrl: string | undefined

  try {
    // Validate required video file
    if (!draftState.videoFile) {
      throw new Error('Video file is required')
    }

    // ========================================
    // Step 1: Create Video Feed Record
    // ========================================
    const videoFeedInsert: VideoFeedInsert = {
      author_id: draftState.author_id,
      headline: draftState.headline || null,
      caption: draftState.caption || null,
      media_source_name: draftState.media_source_name || null,
      is_full: false, // Default for vertical video
      published_at: publishedAt,
    }

    const { data: videoFeedData, error: videoFeedError } = await supabase
      .from('video_feeds')
      .insert(videoFeedInsert)
      .select('id')
      .single()

    if (videoFeedError || !videoFeedData) {
      throw new Error(`Failed to create video feed: ${videoFeedError?.message}`)
    }

    const videoFeedId = videoFeedData.id

    // ========================================
    // Step 2-4: Upload & Link Video File
    // ========================================
    const videoFile = draftState.videoFile
    const videoExt = getFileExtension(videoFile)
    const videoMediaId = crypto.randomUUID()
    const videoObjectPath = buildObjectPathForVideoFeedVideo(
      videoFeedId,
      videoMediaId,
      videoExt
    )

    // Upload video and create media asset
    const videoResult = await uploadAndCreateMediaAsset({
      file: videoFile,
      bucket: STORAGE_BUCKET,
      objectPath: videoObjectPath,
      createdBy: userId,
    })

    videoUrl = videoResult.publicUrl

    // Link video to video feed
    await insertVideoFeedMedia({
      video_feed_id: videoFeedId,
      media_id: videoResult.mediaId,
      role: 'video',
      sort_order: 0,
    })

    // ========================================
    // Step 5: Upload & Link Poster (if provided)
    // ========================================
    if (draftState.posterFile) {
      const posterFile = draftState.posterFile
      const posterExt = getFileExtension(posterFile)
      const posterMediaId = crypto.randomUUID()
      const posterObjectPath = buildObjectPathForVideoFeedPoster(
        videoFeedId,
        posterMediaId,
        posterExt
      )

      // Upload poster and create media asset
      const posterResult = await uploadAndCreateMediaAsset({
        file: posterFile,
        bucket: STORAGE_BUCKET,
        objectPath: posterObjectPath,
        createdBy: userId,
      })

      posterUrl = posterResult.publicUrl

      // Link poster to video feed
      await insertVideoFeedMedia({
        video_feed_id: videoFeedId,
        media_id: posterResult.mediaId,
        role: 'poster',
        sort_order: 0,
      })
    }

    return {
      videoFeedId,
      videoUrl,
      posterUrl,
      success: true,
    }
  } catch (error) {
    console.error('Error saving vertical video:', error)
    return {
      videoFeedId: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// ============================================
// Helper: Get Video Feed with Media
// ============================================

/**
 * Fetch a video feed with its video and poster URLs
 */
export async function getVideoFeedWithMedia(videoFeedId: string): Promise<{
  videoFeed: any
  videoUrl: string | null
  posterUrl: string | null
} | null> {
  const { data: videoFeed, error } = await supabase
    .from('video_feeds')
    .select(`
      *,
      video_feed_media (
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
    .eq('id', videoFeedId)
    .single()

  if (error || !videoFeed) {
    return null
  }

  let videoUrl: string | null = null
  let posterUrl: string | null = null

  // Find video media
  const videoMedia = videoFeed.video_feed_media?.find((vfm: any) => vfm.role === 'video')
  if (videoMedia?.media_assets) {
    const asset = videoMedia.media_assets
    const { data } = supabase.storage
      .from(asset.bucket)
      .getPublicUrl(asset.object_path)
    videoUrl = data.publicUrl
  }

  // Find poster media
  const posterMedia = videoFeed.video_feed_media?.find((vfm: any) => vfm.role === 'poster')
  if (posterMedia?.media_assets) {
    const asset = posterMedia.media_assets
    const { data } = supabase.storage
      .from(asset.bucket)
      .getPublicUrl(asset.object_path)
    posterUrl = data.publicUrl
  }

  return { videoFeed, videoUrl, posterUrl }
}
