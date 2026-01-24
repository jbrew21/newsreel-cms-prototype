import { supabase } from './client'
import type { MediaType, MediaAssetInsert, MediaAsset } from './types'

// ============================================
// Constants
// ============================================

export const STORAGE_BUCKET = 'story-media'

// ============================================
// File Utilities
// ============================================

/**
 * Extract file extension from a File object
 */
export function getFileExtension(file: File): string {
  const name = file.name
  const lastDot = name.lastIndexOf('.')
  if (lastDot === -1) {
    // Fallback to mime type
    const mimeExt = file.type.split('/')[1]
    return mimeExt || 'bin'
  }
  return name.slice(lastDot + 1).toLowerCase()
}

/**
 * Determine media type from file
 */
export function getMediaType(file: File): MediaType {
  return file.type.startsWith('video/') ? 'video' : 'image'
}

// ============================================
// Path Builders
// ============================================

/**
 * Build storage path for story cover image
 * Format: stories/{storyId}/cover/{mediaId}.{ext}
 */
export function buildObjectPathForStoryCover(
  storyId: string,
  mediaId: string,
  ext: string
): string {
  return `stories/${storyId}/cover/${mediaId}.${ext}`
}

/**
 * Build storage path for slide media
 * Format: stories/{storyId}/slides/{slideId}/{role}/{mediaId}.{ext}
 */
export function buildObjectPathForSlideMedia(
  storyId: string,
  slideId: string,
  role: string,
  mediaId: string,
  ext: string
): string {
  return `stories/${storyId}/slides/${slideId}/${role}/${mediaId}.${ext}`
}

/**
 * Build storage path for video feed video
 * Format: video_feeds/{videoFeedId}/video/{mediaId}.{ext}
 */
export function buildObjectPathForVideoFeedVideo(
  videoFeedId: string,
  mediaId: string,
  ext: string
): string {
  return `video_feeds/${videoFeedId}/video/${mediaId}.${ext}`
}

/**
 * Build storage path for video feed poster/thumbnail
 * Format: video_feeds/{videoFeedId}/poster/{mediaId}.{ext}
 */
export function buildObjectPathForVideoFeedPoster(
  videoFeedId: string,
  mediaId: string,
  ext: string
): string {
  return `video_feeds/${videoFeedId}/poster/${mediaId}.${ext}`
}

// ============================================
// Storage Operations
// ============================================

/**
 * Upload a file to Supabase storage
 * @throws Error if upload fails
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<{ path: string }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`)
  }

  return { path: data.path }
}

/**
 * Get public URL for a file in storage
 */
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

// ============================================
// Media Asset Operations
// ============================================

/**
 * Insert a media asset record into the database
 * @returns The created media asset ID
 */
export async function insertMediaAsset(params: {
  bucket: string
  object_path: string
  media_type: MediaType
  mime_type?: string | null
  bytes?: number | null
  width?: number | null
  height?: number | null
  duration_ms?: number | null
  created_by?: string | null
}): Promise<string> {
  const insertData: MediaAssetInsert = {
    bucket: params.bucket,
    object_path: params.object_path,
    media_type: params.media_type,
    mime_type: params.mime_type ?? null,
    bytes: params.bytes ?? null,
    width: params.width ?? null,
    height: params.height ?? null,
    duration_ms: params.duration_ms ?? null,
    created_by: params.created_by ?? null,
  }

  const { data, error } = await supabase
    .from('media_assets')
    .insert(insertData)
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to insert media asset: ${error.message}`)
  }

  return data.id
}

/**
 * Link media to a story
 */
export async function insertStoryMedia(params: {
  story_id: string
  media_id: string
  role: string
  sort_order?: number
}): Promise<void> {
  const { error } = await supabase.from('story_media').insert({
    story_id: params.story_id,
    media_id: params.media_id,
    role: params.role,
    sort_order: params.sort_order ?? 0,
  })

  if (error) {
    throw new Error(`Failed to link media to story: ${error.message}`)
  }
}

/**
 * Link media to a slide
 */
export async function insertSlideMedia(params: {
  slide_id: string
  media_id: string
  role: string
  sort_order?: number
}): Promise<void> {
  const { error } = await supabase.from('slide_media').insert({
    slide_id: params.slide_id,
    media_id: params.media_id,
    role: params.role,
    sort_order: params.sort_order ?? 0,
  })

  if (error) {
    throw new Error(`Failed to link media to slide: ${error.message}`)
  }
}

/**
 * Link media to a video feed
 */
export async function insertVideoFeedMedia(params: {
  video_feed_id: string
  media_id: string
  role: string
  sort_order?: number
}): Promise<void> {
  const { error } = await supabase.from('video_feed_media').insert({
    video_feed_id: params.video_feed_id,
    media_id: params.media_id,
    role: params.role,
    sort_order: params.sort_order ?? 0,
  })

  if (error) {
    throw new Error(`Failed to link media to video feed: ${error.message}`)
  }
}

// ============================================
// Composite Upload + Insert Operations
// ============================================

/**
 * Upload a file and create the media asset record in one operation
 * @returns The media asset ID and public URL
 */
export async function uploadAndCreateMediaAsset(params: {
  file: File
  bucket: string
  objectPath: string
  createdBy?: string | null
}): Promise<{ mediaId: string; publicUrl: string }> {
  const { file, bucket, objectPath, createdBy } = params

  // Upload file to storage
  await uploadFile(bucket, objectPath, file)

  // Create media asset record
  const mediaId = await insertMediaAsset({
    bucket,
    object_path: objectPath,
    media_type: getMediaType(file),
    mime_type: file.type,
    bytes: file.size,
    created_by: createdBy,
  })

  // Get public URL
  const publicUrl = getPublicUrl(bucket, objectPath)

  return { mediaId, publicUrl }
}
