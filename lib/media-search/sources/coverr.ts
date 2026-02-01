import type { MediaItem } from '../types'

export async function searchCoverrImages(query: string, count = 15): Promise<MediaItem[]> {
  const key = process.env.COVERR_API_KEY || ''
  if (!key) return []
  const params = new URLSearchParams({ query, page_size: '25' })
  const res = await fetch(`https://api.coverr.co/videos?${params}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  })
  if (!res.ok) return []
  const data = await res.json()
  const hits = data.hits || data.videos || []
  return hits
    .filter((v: any) => v.thumbnail)
    .slice(0, count)
    .map((v: any): MediaItem => ({
      url: v.thumbnail,
      thumbnail: v.thumbnail,
      source: 'coverr',
      description: '',
      keywords: [],
      mediaType: 'image',
      duration: null,
      attribution: 'Image from Coverr',
    }))
}

export async function searchCoverrVideos(query: string, limit = 6): Promise<MediaItem[]> {
  const key = process.env.COVERR_API_KEY || ''
  if (!key) return []
  const params = new URLSearchParams({ query, page_size: Math.min(limit, 25).toString() })
  const res = await fetch(`https://api.coverr.co/videos?${params}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  })
  if (!res.ok) return []
  const data = await res.json()
  const hits = data.hits || data.videos || []
  return hits.slice(0, limit).map((v: any): MediaItem => ({
    url: v.urls?.mp4 || v.url || '',
    thumbnail: v.thumbnail || '',
    source: 'coverr',
    description: null,
    keywords: [],
    mediaType: 'video',
    duration: null,
    attribution: 'Video from Coverr',
  }))
}
