export type MediaSource =
  | 'shutterstock'
  | 'unsplash'
  | 'pexels'
  | 'pixabay'
  | 'coverr'
  | 'youtube'

export type MediaType = 'image' | 'video'

export interface MediaItem {
  url: string
  thumbnail: string
  source: MediaSource
  description: string | null
  keywords: string[]
  mediaType: MediaType
  duration: number | null
  attribution: string | null
}

export const SOURCE_LABELS: Record<MediaSource, string> = {
  shutterstock: 'Shutterstock',
  unsplash: 'Unsplash',
  pexels: 'Pexels',
  pixabay: 'Pixabay',
  coverr: 'Coverr',
  youtube: 'YouTube',
}

export const IMAGE_SOURCES: MediaSource[] = ['shutterstock', 'unsplash', 'pexels', 'pixabay', 'coverr']
export const VIDEO_SOURCES: MediaSource[] = ['youtube', 'pexels', 'pixabay', 'coverr']
