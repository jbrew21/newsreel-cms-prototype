import { NextRequest, NextResponse } from 'next/server'
import { searchAllImages, searchAllVideos } from '@/lib/media-search/search'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const query = searchParams.get('q')?.trim()
  const type = searchParams.get('type') || 'image'

  if (!query) {
    return NextResponse.json({ results: [], error: 'Missing query' }, { status: 400 })
  }

  try {
    const results = type === 'video'
      ? await searchAllVideos(query)
      : await searchAllImages(query)

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [], error: 'Search failed' }, { status: 500 })
  }
}
