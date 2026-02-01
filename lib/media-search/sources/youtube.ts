import type { MediaItem } from '../types'

function parseYouTubeDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0')
}

export async function searchYouTube(query: string, limit = 18): Promise<MediaItem[]> {
  const key = process.env.YOUTUBE_API_KEY || ''
  if (!key) return []
  const searchParams = new URLSearchParams({
    key,
    q: query,
    part: 'snippet',
    type: 'video',
    maxResults: Math.min(limit * 3, 50).toString(),
    videoDuration: 'short',
    publishedAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  })
  const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams}`)
  if (!searchRes.ok) return []
  const searchData = await searchRes.json()
  if (!searchData.items?.length) return []
  const videoIds = searchData.items.map((i: any) => i.id.videoId).filter(Boolean)
  if (!videoIds.length) return []
  const detailsParams = new URLSearchParams({
    key,
    id: videoIds.join(','),
    part: 'snippet,contentDetails',
  })
  const detailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailsParams}`)
  if (!detailsRes.ok) return []
  const detailsData = await detailsRes.json()
  if (!detailsData.items) return []
  return detailsData.items
    .filter((v: any) => {
      const d = parseYouTubeDuration(v.contentDetails?.duration || '')
      return d >= 5 && d <= 240
    })
    .slice(0, limit)
    .map((v: any): MediaItem => ({
      url: `https://www.youtube.com/watch?v=${v.id}`,
      thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || '',
      source: 'youtube',
      description: v.snippet.title || '',
      keywords: [],
      mediaType: 'video',
      duration: parseYouTubeDuration(v.contentDetails.duration),
      attribution: `Video by ${v.snippet.channelTitle} on YouTube`,
    }))
}
