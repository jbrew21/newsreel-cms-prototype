import type { MediaItem } from '../types'

export async function searchPixabayImages(query: string, count = 15): Promise<MediaItem[]> {
  const key = process.env.PIXABAY_API_KEY || ''
  if (!key) return []
  const params = new URLSearchParams({
    key,
    q: query,
    per_page: '30',
    image_type: 'photo',
    orientation: 'horizontal',
    safesearch: 'true',
  })
  const res = await fetch(`https://pixabay.com/api/?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  if (!data.hits) return []
  return data.hits.slice(0, count).map((h: any): MediaItem => ({
    url: h.largeImageURL || h.webformatURL,
    thumbnail: h.previewURL,
    source: 'pixabay',
    description: h.tags || '',
    keywords: [],
    mediaType: 'image',
    duration: null,
    attribution: h.user ? `Image by ${h.user} from Pixabay` : null,
  }))
}

export async function searchPixabayVideos(query: string, limit = 6): Promise<MediaItem[]> {
  const key = process.env.PIXABAY_API_KEY || ''
  if (!key) return []
  const params = new URLSearchParams({
    key,
    q: query,
    per_page: Math.min(limit, 200).toString(),
    video_type: 'film',
  })
  const res = await fetch(`https://pixabay.com/api/videos/?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  if (!data.hits?.length) return []
  return data.hits.slice(0, limit).map((h: any): MediaItem => ({
    url: h.videos?.large?.url || h.videos?.medium?.url || '',
    thumbnail: h.picture || '',
    source: 'pixabay',
    description: null,
    keywords: [],
    mediaType: 'video',
    duration: h.duration || null,
    attribution: `Video by ${h.user} from Pixabay`,
  }))
}
