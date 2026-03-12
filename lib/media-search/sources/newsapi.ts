import type { MediaItem } from '../types'

export async function searchNewsApiImages(query: string, count = 15): Promise<MediaItem[]> {
  const key = process.env.NEWSAPI_KEY || ''
  if (!key) return []
  const params = new URLSearchParams({
    q: query,
    apiKey: key,
    pageSize: Math.min(count * 2, 60).toString(),
    sortBy: 'relevancy',
    language: 'en',
  })
  const res = await fetch(`https://newsapi.org/v2/everything?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  if (!data.articles?.length) return []
  return data.articles
    .filter((a: any) => a.urlToImage)
    .slice(0, count)
    .map((a: any): MediaItem => ({
      url: a.urlToImage,
      thumbnail: a.urlToImage,
      source: 'newsapi',
      description: a.title || null,
      keywords: [],
      mediaType: 'image',
      duration: null,
      attribution: a.source?.name ? `Image from ${a.source.name}` : 'Image from News',
    }))
}
