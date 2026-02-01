import type { MediaItem } from '../types'

let accessToken: string | null = null
let tokenExpiry = 0

async function getToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken
  const clientId = process.env.NEXT_PUBLIC_SHUTTERSTOCK_CLIENT_ID || ''
  const clientSecret = process.env.NEXT_PUBLIC_SHUTTERSTOCK_CLIENT_SECRET || ''
  if (!clientId || !clientSecret) return ''
  const res = await fetch('https://api.shutterstock.com/v2/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
  })
  if (!res.ok) return ''
  const data = await res.json()
  accessToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000
  return accessToken!
}

export async function searchShutterstock(query: string, count = 15): Promise<MediaItem[]> {
  const token = await getToken()
  if (!token) return []
  const params = new URLSearchParams({
    query,
    per_page: Math.min(count * 3, 30).toString(),
    sort: 'relevance',
    orientation: 'horizontal',
    image_type: 'photo',
    safe: 'true',
    view: 'minimal',
    page: '1',
  })
  const res = await fetch(`https://api.shutterstock.com/v2/images/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  if (!data.data || !Array.isArray(data.data)) return []
  return data.data
    .filter((item: any) => item.assets?.preview?.url && item.assets?.small_thumb?.url && item.width >= 800 && item.height >= 600)
    .slice(0, count)
    .map((item: any): MediaItem => ({
      url: item.assets.preview.url,
      thumbnail: item.assets.small_thumb.url,
      source: 'shutterstock',
      description: item.description || '',
      keywords: item.keywords || [],
      mediaType: 'image',
      duration: null,
      attribution: null,
    }))
}
