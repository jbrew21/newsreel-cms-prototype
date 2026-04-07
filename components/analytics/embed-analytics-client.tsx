'use client'

/**
 * EmbedAnalyticsClient — the single drop-in the embed page mounts.
 *
 * Responsibilities:
 *   - Render the existing MobileSlidePreview (unchanged behavior)
 *   - Wire its optional analytics callbacks to local state
 *   - Mount EmbedAnalyticsTracker alongside it
 *
 * This keeps the analytics layer fully isolated: neither MobileSlidePreview
 * nor any existing CMS component depends on the tracker. If the tracker
 * throws for any reason, the preview keeps working.
 */

import { useCallback, useState } from 'react'
import { MobileSlidePreview } from '@/components/preview/mobile-slide-preview'
import { EmbedAnalyticsTracker } from './embed-tracker'

interface EmbedAnalyticsClientProps {
  storyId: string
}

export function EmbedAnalyticsClient({ storyId }: EmbedAnalyticsClientProps) {
  const [authorId, setAuthorId] = useState<string | null>(null)
  const [totalSlides, setTotalSlides] = useState<number>(0)
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0)

  const handleAuthorLoaded = useCallback((id: string | null) => {
    setAuthorId(id)
  }, [])

  const handleTotalSlides = useCallback((total: number) => {
    setTotalSlides(total)
  }, [])

  const handleSlideChange = useCallback((index: number) => {
    setCurrentSlideIndex(index)
  }, [])

  return (
    <>
      <MobileSlidePreview
        storyId={storyId}
        onAuthorLoaded={handleAuthorLoaded}
        onTotalSlidesReady={handleTotalSlides}
        onSlideChange={handleSlideChange}
      />
      {totalSlides > 0 && (
        <EmbedAnalyticsTracker
          storyId={storyId}
          authorId={authorId}
          currentSlideIndex={currentSlideIndex}
          totalSlides={totalSlides}
        />
      )}
    </>
  )
}
