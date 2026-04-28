'use client'

import { useEffect, useState } from 'react'
import { Video } from 'lucide-react'
import { getVideoThumbnail } from '@/lib/video-thumbnail'

interface VideoCoverThumbnailProps {
  videoUrl: string
  alt?: string
  iconSize?: 'sm' | 'lg'
}

export function VideoCoverThumbnail({ videoUrl, alt, iconSize = 'sm' }: VideoCoverThumbnailProps) {
  const [thumbnail, setThumbnail] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setThumbnail(null)
    getVideoThumbnail(videoUrl).then((result) => {
      if (!cancelled) setThumbnail(result)
    })
    return () => { cancelled = true }
  }, [videoUrl])

  if (thumbnail) {
    return (
      <div className="relative w-full h-full">
        <img
          src={thumbnail}
          alt={alt || 'Video thumbnail'}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 rounded-full p-2 backdrop-blur-sm">
            <Video className={iconSize === 'lg' ? 'h-6 w-6 text-white' : 'h-5 w-5 text-white'} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full bg-black">
      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
        <Video className={iconSize === 'lg' ? 'h-12 w-12 text-white' : 'h-8 w-8 text-white'} />
      </div>
    </div>
  )
}
