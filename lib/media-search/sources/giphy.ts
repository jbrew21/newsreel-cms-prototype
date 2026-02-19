import type { MediaItem } from '../types'

export async function searchGiphy(query: string, count = 15): Promise<MediaItem[]> {
  const key = process.env.GIPHY_API_KEY || ''
  if (!key) return []
  const params = new URLSearchParams({
    api_key: key,
    q: query,
    limit: Math.min(count, 50).toString(),
    rating: 'g',
    lang: 'en',
  })
  const res = await fetch(`https://api.giphy.com/v1/gifs/search?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  if (!data.data?.length) return []
  return data.data.slice(0, count).map((g: any): MediaItem => ({
    url: g.images?.original?.url || g.images?.downsized_large?.url || '',
    thumbnail: g.images?.fixed_height?.url || g.images?.fixed_height_small?.url || '',
    source: 'giphy',
    description: g.title || null,
    keywords: [],
    mediaType: 'image',
    duration: null,
    attribution: g.username ? `GIF by ${g.username} on Giphy` : 'GIF from Giphy',
  }))
}
