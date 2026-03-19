'use client'

import { useState, useRef } from 'react'
import { Play, Pause, Trash2, Video } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuthorVideoPreviewProps {
  /** Object URL or blob URL for the recorded video */
  videoUrl: string
  /** Called when user wants to delete the recording */
  onDelete: () => void
  className?: string
}

export function AuthorVideoPreview({ videoUrl, onDelete, className }: AuthorVideoPreviewProps) {
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const togglePlay = () => {
    if (!videoRef.current) return
    if (playing) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setPlaying(!playing)
  }

  return (
    <div className={cn('relative w-full max-w-xs', className)}>
      {/* Label */}
      <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-primary/90 rounded text-[10px] font-medium text-primary-foreground flex items-center gap-1">
        <Video className="h-3 w-3" />
        Author Recording
      </div>

      {/* Video */}
      <div className="relative rounded-lg overflow-hidden border border-border">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-40 object-cover"
          muted
          playsInline
          loop
          onEnded={() => setPlaying(false)}
        />

        {/* Play/Pause overlay */}
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <Pause className="h-8 w-8 text-white" />
          ) : (
            <Play className="h-8 w-8 text-white" />
          )}
        </button>
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={onDelete}
        className="absolute top-2 right-2 z-10 p-1 bg-background/80 rounded-full hover:bg-destructive/20 transition-colors"
        aria-label="Delete recording"
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
      </button>
    </div>
  )
}
