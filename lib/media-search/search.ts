import type { MediaItem } from './types'
import { searchShutterstock } from './sources/shutterstock'
import { searchUnsplash } from './sources/unsplash'
import { searchPexelsImages, searchPexelsVideos } from './sources/pexels'
import { searchPixabayImages, searchPixabayVideos } from './sources/pixabay'
import { searchCoverrImages, searchCoverrVideos } from './sources/coverr'
import { searchYouTube } from './sources/youtube'

export async function searchAllImages(query: string, perSource = 15): Promise<MediaItem[]> {
  const [s1, s2, s3, s4, s5] = await Promise.allSettled([
    searchShutterstock(query, perSource),
    searchUnsplash(query, perSource),
    searchPexelsImages(query, perSource),
    searchPixabayImages(query, perSource),
    searchCoverrImages(query, perSource),
  ])
  const all: MediaItem[] = []
  for (const r of [s1, s2, s3, s4, s5]) {
    if (r.status === 'fulfilled' && r.value.length) all.push(...r.value)
  }
  return all
}

export async function searchAllVideos(query: string, limit = 24): Promise<MediaItem[]> {
  const [yt, px, pb, cv] = await Promise.allSettled([
    searchYouTube(query, 18),
    searchPexelsVideos(query, 6),
    searchPixabayVideos(query, 6),
    searchCoverrVideos(query, 6),
  ])
  const all: MediaItem[] = []
  for (const r of [yt, px, pb, cv]) {
    if (r.status === 'fulfilled' && r.value.length) all.push(...r.value)
  }
  return all.slice(0, Math.max(limit, 24))
}
