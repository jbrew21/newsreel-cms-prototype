/**
 * Database types matching the CMS Supabase schema
 */

// ============================================
// Core Content Types
// ============================================

export interface Author {
  id: string
  author_first_name: string | null
  author_last_name: string | null
  author_bio: string | null
  author_role: string | null
  author_organization: string | null
  author_twitter: string | null
  author_linked_in: string | null
  author_email: string | null
  author_avatar: string | null
  author_cover: string | null
  is_first_login: boolean | null
  created_at: string | null
  updated_at: string | null
  published_at: string | null
}

export interface Newsreel {
  id: string
  newsreel_date: string // date format: YYYY-MM-DD
  newsreel_day: string
  is_active: boolean
  created_at: string | null
  updated_at: string | null
  published_at: string | null
}

export interface Story {
  id: string
  newsreel_id: string | null
  story_headline: string | null
  subhead: string | null
  story_link: string | null
  story_type: string | null
  story_date: string | null
  university: string | null
  is_premium: boolean
  is_k12: boolean
  is_breaking: boolean
  access_code: string | null
  partner_name: string | null
  partner_article_link: string | null
  story_media_source: string | null
  allowed_domains: string[] | null
  created_at: string | null
  updated_at: string | null
  published_at: string | null
}

export interface Slide {
  id: string
  story_id: string
  slide_index: number
  slide_title: string | null
  slide_headline_1: string | null
  slide_content_1: string | null
  slide_headline_2: string | null
  slide_content_2: string | null
  portrait_video: boolean
  slide_quote: string | null
  slide_media_source: string | null
  created_at: string | null
  updated_at: string | null
  published_at: string | null
}

// ============================================
// Media Types
// ============================================

export type MediaType = 'image' | 'video'

export interface MediaAsset {
  id: string
  bucket: string
  object_path: string
  media_type: MediaType
  mime_type: string | null
  bytes: number | null
  width: number | null
  height: number | null
  duration_ms: number | null
  created_at: string | null
  created_by: string | null
}

export interface StoryMedia {
  story_id: string
  media_id: string
  role: string // 'cover', 'hero', etc.
  sort_order: number
}

export interface SlideMedia {
  slide_id: string
  media_id: string
  role: string // 'hero', 'background', etc.
  sort_order: number
}

export interface VideoFeed {
  id: string
  author_id: string | null
  headline: string | null
  caption: string | null
  newsreel_date: string | null // date format: YYYY-MM-DD
  media_source_name: string | null
  is_full: boolean
  created_at: string | null
  updated_at: string | null
  published_at: string | null
}

export interface VideoFeedMedia {
  video_feed_id: string
  media_id: string
  role: string // 'video', 'poster', etc.
  sort_order: number
}

// ============================================
// Engagement Types
// ============================================

export interface Poll {
  id: string
  story_id: string
  question: string | null
  econ_weight: number | null
  social_weight: number | null
  importance: number | null
  created_at: string | null
  updated_at: string | null
  published_at: string | null
}

export interface Quiz {
  id: string
  story_id: string
  quiz_content: string | null
  quiz_answer_a: string | null
  quiz_answer_b: string | null
  quiz_answer_c: string | null
  quiz_answer_d: string | null
  created_at: string | null
  updated_at: string | null
  published_at: string | null
}

// ============================================
// Insert Types (for creating new records)
// ============================================

export interface StoryInsert {
  newsreel_id?: string | null
  story_headline?: string | null
  subhead?: string | null
  story_link?: string | null
  story_type?: string | null
  story_date?: string | null
  university?: string | null
  is_premium?: boolean
  is_k12?: boolean
  is_breaking?: boolean
  access_code?: string | null
  partner_name?: string | null
  partner_article_link?: string | null
  story_media_source?: string | null
  allowed_domains?: string[] | null
  published_at?: string | null
}

export interface SlideInsert {
  story_id: string
  slide_index: number
  slide_title?: string | null
  slide_headline_1?: string | null
  slide_content_1?: string | null
  slide_headline_2?: string | null
  slide_content_2?: string | null
  portrait_video?: boolean
  slide_quote?: string | null
  slide_media_source?: string | null
  published_at?: string | null
}

export interface MediaAssetInsert {
  bucket: string
  object_path: string
  media_type: MediaType
  mime_type?: string | null
  bytes?: number | null
  width?: number | null
  height?: number | null
  duration_ms?: number | null
  created_by?: string | null
}

export interface StoryMediaInsert {
  story_id: string
  media_id: string
  role: string
  sort_order?: number
}

export interface SlideMediaInsert {
  slide_id: string
  media_id: string
  role: string
  sort_order?: number
}

export interface VideoFeedInsert {
  author_id?: string | null
  headline?: string | null
  caption?: string | null
  newsreel_date?: string | null
  media_source_name?: string | null
  is_full?: boolean
  published_at?: string | null
}

export interface VideoFeedMediaInsert {
  video_feed_id: string
  media_id: string
  role: string
  sort_order?: number
}

export interface QuizInsert {
  story_id: string
  quiz_content?: string | null
  quiz_answer_a?: string | null
  quiz_answer_b?: string | null
  quiz_answer_c?: string | null
  quiz_answer_d?: string | null
  published_at?: string | null
}

export interface PollInsert {
  story_id: string
  question?: string | null
  econ_weight?: number | null
  social_weight?: number | null
  importance?: number | null
  published_at?: string | null
}

// ============================================
// Form/UI Types
// ============================================

export interface SlideFormData {
  id: string // temporary client-side ID
  slideIndex: number
  slide_headline_1?: string
  slide_content_1?: string
  slide_headline_2?: string
  slide_content_2?: string
  slide_quote?: string
  slide_media_source?: string
  portrait_video: boolean
  mediaFiles: File[]
  // New external URLs from media search (Pexels, Unsplash, etc.) to be downloaded on save
  savedMediaUrls?: string[]
  // Existing bucket URLs loaded from DB during edit (display-only, never re-downloaded)
  existingMediaUrls?: string[]
}

export interface QuizFormData {
  quiz_content: string
  quiz_answer_a: string
  quiz_answer_b: string
  quiz_answer_c: string
  quiz_answer_d: string
}

export interface PollFormData {
  question: string
  econ_weight: number | null
  social_weight: number | null
  importance: number | null
}

export interface BriefFormData {
  story_headline: string
  subhead?: string | null
  headlinePhoto: File | null
  headlinePhotoUrl?: string // After save
  author_id: string | null
  author_name: string
  story_type?: string | null // Optional - defaults to 'brief'
  story_date?: string | null // Optional - defaults to published_at or updated_at
  is_k12?: boolean
  is_premium?: boolean
  story_media_source?: string | null
  allowed_domains?: string[] | null
  slides: SlideFormData[]
  // Optional quiz and poll
  quiz?: QuizFormData | null
  poll?: PollFormData | null
}

export interface VerticalVideoFormData {
  headline: string
  caption: string
  videoFile: File | null
  videoUrl?: string // After save - public URL
  posterFile: File | null // Optional poster/thumbnail
  posterUrl?: string // After save - public URL
  author_id: string | null
  author_name: string
  media_source_name: string
}

// ============================================
// Save Function Types
// ============================================

export type SaveMode = 'draft' | 'publish'

export interface SaveBriefParams {
  mode: SaveMode
  draftState: BriefFormData
  userId: string
}

export interface SaveBriefResult {
  storyId: string
  success: boolean
  error?: string
  mediaWarnings?: string[]
}

export interface SaveVerticalVideoParams {
  mode: SaveMode
  draftState: VerticalVideoFormData
  userId: string
}

export interface SaveVerticalVideoResult {
  videoFeedId: string
  videoUrl?: string
  posterUrl?: string
  success: boolean
  error?: string
}

// ============================================
// Edit/Update Types
// ============================================

export interface EditBriefMetadata {
  storyId: string
  existingCoverUrl: string | null
  existingSlideIds: string[]
  existingQuizId: string | null
  existingPollId: string | null
}
