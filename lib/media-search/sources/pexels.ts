import type { MediaItem } from '../types'

export async function searchPexelsImages(query: string, count = 15): Promise<MediaItem[]> {
  const key = process.env.PEXELS_API_KEY || ''
  if (!key) return []
  const params = new URLSearchParams({ query, per_page: Math.min(count, 50).toString(), orientation: 'landscape' })
  const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
    headers: { Authorization: key },
  })
  if (!res.ok) return []
  const data = await res.json()
  if (!data.photos) return []
  return data.photos.slice(0, count).map((p: any): MediaItem => ({
    url: p.src.large || p.src.medium,
    thumbnail: p.src.small || p.src.tiny,
    source: 'pexels',
    description: p.alt || '',
    keywords: [],
    mediaType: 'image',
    duration: null,
    attribution: p.photographer ? `Photo by ${p.photographer} on Pexels` : null,
  }))
}

export async function searchPexelsVideos(query: string, limit = 6): Promise<MediaItem[]> {
  const key = process.env.PEXELS_API_KEY || ''
  if (!key) return []
  const params = new URLSearchParams({
    query,
    per_page: Math.min(limit, 15).toString(),
    orientation: 'landscape',
  })
  const res = await fetch(`https://api.pexels.com/videos/search?${params}`, {
    headers: { Authorization: key },
  })
  if (!res.ok) return []
  const data = await res.json()
  if (!data.videos?.length) return []
  return data.videos.slice(0, limit).map((v: any): MediaItem => ({
    url: v.video_files?.find((f: any) => f.quality === 'hd')?.link || v.video_files?.[0]?.link || '',
    thumbnail: v.image || '',
    source: 'pexels',
    description: null,
    keywords: [],
    mediaType: 'video',
    duration: v.duration || null,
    attribution: `Video by ${v.user?.name} from Pexels`,
  }))
}
