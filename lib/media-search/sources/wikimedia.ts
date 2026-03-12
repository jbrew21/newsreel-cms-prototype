import type { MediaItem } from '../types'

export async function searchWikimediaCommons(query: string, count = 15): Promise<MediaItem[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '50',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '800',
    iiextmetadatafilter: 'LicenseShortName|Artist|ImageDescription',
    format: 'json',
    origin: '*',
  })

  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': 'NewsreelCMS/1.0 (media-search)' },
  })
  if (!res.ok) return []

  const data = await res.json()
  const pages = data.query?.pages
  if (!pages) return []

  return Object.values(pages)
    .filter((page: any) => {
      const info = page.imageinfo?.[0]
      if (!info) return false
      const mime: string = info.mime || ''
      return mime.startsWith('image/') && info.thumburl && info.url && info.width >= 800 && info.height >= 600
    })
    .slice(0, count)
    .map((page: any): MediaItem => {
      const info = page.imageinfo[0]
      const meta = info.extmetadata || {}
      const artist = meta.Artist?.value?.replace(/<[^>]*>/g, '').trim() || null
      const description = meta.ImageDescription?.value?.replace(/<[^>]*>/g, '').trim() || null
      const license = meta.LicenseShortName?.value || ''

      return {
        url: info.url,
        thumbnail: info.thumburl,
        source: 'wikimedia',
        description,
        keywords: [],
        mediaType: 'image',
        duration: null,
        attribution: artist
          ? `${artist} via Wikimedia Commons (${license})`
          : `Wikimedia Commons (${license})`,
      }
    })
}
