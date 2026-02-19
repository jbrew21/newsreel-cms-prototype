import type { MediaItem } from '../types'

export async function searchGNewsImages(query: string, count = 15): Promise<MediaItem[]> {
  const key = process.env.GNEWS_API_KEY || ''
  if (!key) return []
  const params = new URLSearchParams({
    q: query,
    token: key,
    max: Math.min(count, 10).toString(),
    lang: 'en',
  })
  const res = await fetch(`https://gnews.io/api/v4/search?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  if (!data.articles?.length) return []
  return data.articles
    .filter((a: any) => a.image)
    .slice(0, count)
    .map((a: any): MediaItem => ({
      url: a.image,
      thumbnail: a.image,
      source: 'gnews',
      description: a.title || null,
      keywords: [],
      mediaType: 'image',
      duration: null,
      attribution: a.source?.name ? `Image from ${a.source.name}` : 'Image from GNews',
    }))
}
