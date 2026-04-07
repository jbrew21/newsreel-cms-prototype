'use client'

/**
 * EmbedAnalyticsTracker — React wrapper around the vanilla EmbedTracker
 * class. Mounts inside the iframe embed page and orchestrates the
 * tracker lifecycle:
 *
 *   1. On mount → fire `open` event
 *   2. On slide change → fire `slide_view` for the previous slide
 *      with its accumulated duration
 *   3. When user reaches the last slide → fire `complete` once
 *   4. On unmount → record final slide duration + flush the buffer
 *
 * Renders nothing visible. Silent failure on any error.
 */

import { useEffect, useRef } from 'react'
import { EmbedTracker } from '@/lib/analytics/embed-tracker'

interface EmbedAnalyticsTrackerProps {
  storyId: string
  authorId?: string | null
  currentSlideIndex: number
  totalSlides: number
}

const MAX_CLAMP_MS = 60 * 60 * 1000 // 1 hour

function clampDuration(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0
  return Math.min(Math.floor(ms), MAX_CLAMP_MS)
}

export function EmbedAnalyticsTracker({
  storyId,
  authorId,
  currentSlideIndex,
  totalSlides,
}: EmbedAnalyticsTrackerProps) {
  const trackerRef = useRef<EmbedTracker | null>(null)
  const slideStateRef = useRef<{ index: number; enteredAt: number }>({
    index: -1,
    enteredAt: 0,
  })
  const completedRef = useRef<boolean>(false)
  const openedAtRef = useRef<number>(0)

  // ── Initialize tracker on mount ──────────────────────────────────────
  useEffect(() => {
    if (!storyId) return
    if (typeof window === 'undefined') return

    let tracker: EmbedTracker | null = null
    try {
      tracker = new EmbedTracker({ storyId, authorId: authorId ?? null })
      trackerRef.current = tracker
      openedAtRef.current = Date.now()
      tracker.open()
    } catch {
      // Silent: analytics must never break the embed
      trackerRef.current = null
    }

    return () => {
      const t = trackerRef.current
      if (!t) return
      try {
        // Record time spent on the final slide the user was viewing
        const { index, enteredAt } = slideStateRef.current
        if (index >= 0 && enteredAt > 0) {
          t.slideView(index, clampDuration(Date.now() - enteredAt))
        }
        t.flush()
        t.destroy()
      } catch {
        /* silent */
      }
      trackerRef.current = null
    }
    // Re-init only if storyId or authorId change (rare — normally stable for the session)
  }, [storyId, authorId])

  // ── Track slide changes ──────────────────────────────────────────────
  useEffect(() => {
    const tracker = trackerRef.current
    if (!tracker) return
    if (currentSlideIndex < 0) return
    if (totalSlides <= 0) return

    const now = Date.now()
    const prev = slideStateRef.current

    if (prev.index !== currentSlideIndex) {
      // Record the time spent on the previous slide
      if (prev.index >= 0 && prev.enteredAt > 0) {
        try {
          tracker.slideView(prev.index, clampDuration(now - prev.enteredAt))
        } catch {
          /* silent */
        }
      }
      slideStateRef.current = { index: currentSlideIndex, enteredAt: now }
    }

    // Fire `complete` once when the user reaches the final slide
    if (!completedRef.current && currentSlideIndex === totalSlides - 1) {
      completedRef.current = true
      try {
        const totalDuration = openedAtRef.current
          ? clampDuration(now - openedAtRef.current)
          : 0
        tracker.complete(totalDuration)
      } catch {
        /* silent */
      }
    }
  }, [currentSlideIndex, totalSlides])

  return null
}
