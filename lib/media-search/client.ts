import type { MediaItem, MediaType } from './types'

export async function searchMedia(query: string, type: MediaType): Promise<MediaItem[]> {
  const params = new URLSearchParams({ q: query, type })
  const res = await fetch(`/api/media-search?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.results || []
}
