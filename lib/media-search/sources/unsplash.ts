import type { MediaItem } from '../types'

export async function searchUnsplash(query: string, count = 15): Promise<MediaItem[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY || ''
  if (!key) return []
  const params = new URLSearchParams({
    query,
    per_page: '30',
    orientation: 'landscape',
    order_by: 'relevant',
    content_filter: 'low',
    page: '1',
  })
  const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${key}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  if (!data.results || !Array.isArray(data.results)) return []
  return data.results
    .filter((item: any) => item.urls?.regular && item.urls?.small && item.width >= 800 && item.height >= 600)
    .slice(0, count)
    .map((item: any): MediaItem => ({
      url: item.urls.regular,
      thumbnail: item.urls.small,
      source: 'unsplash',
      description: item.description || item.alt_description || '',
      keywords: [],
      mediaType: 'image',
      duration: null,
      attribution: item.user?.name ? `Photo by ${item.user.name} on Unsplash` : null,
    }))
}
