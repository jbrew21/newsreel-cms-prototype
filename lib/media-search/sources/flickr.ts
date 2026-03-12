import type { MediaItem } from '../types'

export async function searchFlickrImages(query: string, count = 15): Promise<MediaItem[]> {
  const key = process.env.FLICKR_API_KEY || ''
  if (!key) return []
  const params = new URLSearchParams({
    method: 'flickr.photos.search',
    api_key: key,
    text: query,
    per_page: Math.min(count * 2, 60).toString(),
    format: 'json',
    nojsoncallback: '1',
    extras: 'url_l,url_m,url_s,owner_name,tags',
    content_type: '1',
    safe_search: '1',
    sort: 'relevance',
    media: 'photos',
  })
  const res = await fetch(`https://api.flickr.com/services/rest/?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  if (!data.photos?.photo?.length) return []
  return data.photos.photo
    .filter((p: any) => p.url_l || p.url_m)
    .slice(0, count)
    .map((p: any): MediaItem => ({
      url: p.url_l || p.url_m,
      thumbnail: p.url_s || p.url_m || p.url_l,
      source: 'flickr',
      description: p.title || null,
      keywords: p.tags ? p.tags.split(' ').slice(0, 5) : [],
      mediaType: 'image',
      duration: null,
      attribution: p.ownername ? `Photo by ${p.ownername} on Flickr` : 'Photo from Flickr',
    }))
}
