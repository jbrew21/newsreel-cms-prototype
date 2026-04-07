/**
 * EmbedTracker — lightweight, framework-agnostic event tracker for
 * story embeds. Buffers events in memory and batch-flushes them
 * to POST /api/analytics/track.
 *
 * Design principles:
 *  - Never throw. Analytics failures must not break the embed.
 *  - Batch writes (one request per flush, up to MAX_BATCH_SIZE events).
 *  - Reliable exit delivery via navigator.sendBeacon().
 *  - Anonymous ID persisted in localStorage (falls back to memory).
 *  - Session ID regenerated per story open (for session-scoped analytics).
 */

import type {
  AnalyticsEventPayload,
  AnalyticsEventType,
  TrackRequestBody,
} from './types'

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_API_URL = '/api/analytics/track'
const ANON_ID_STORAGE_KEY = 'newsreel_anon_id'
const FLUSH_THRESHOLD = 20 // flush when buffer reaches this size
const MAX_BATCH_SIZE = 50 // must match server-side limit

// ── Types ──────────────────────────────────────────────────────────────────

export interface EmbedTrackerOptions {
  storyId: string
  authorId?: string | null
  /** Override the ingest URL (useful for tests). */
  apiUrl?: string
}

// ── Utilities ──────────────────────────────────────────────────────────────

function safeUUID(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // fall through
  }
  // RFC-4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function getOrCreateAnonId(): string {
  if (typeof window === 'undefined') return safeUUID()
  try {
    const existing = window.localStorage.getItem(ANON_ID_STORAGE_KEY)
    if (existing && typeof existing === 'string' && existing.length > 0 && existing.length <= 128) {
      return existing
    }
    const fresh = safeUUID()
    window.localStorage.setItem(ANON_ID_STORAGE_KEY, fresh)
    return fresh
  } catch {
    // localStorage blocked (strict privacy, incognito) — ephemeral id
    return safeUUID()
  }
}

// ── Tracker ────────────────────────────────────────────────────────────────

export class EmbedTracker {
  private readonly storyId: string
  private readonly authorId: string | null
  private readonly apiUrl: string
  private readonly anonymousId: string
  private readonly sessionId: string
  private buffer: AnalyticsEventPayload[] = []
  private flushing = false
  private destroyed = false
  private readonly boundFlush: () => void
  private readonly boundVisibilityChange: () => void

  constructor(opts: EmbedTrackerOptions) {
    this.storyId = opts.storyId
    this.authorId = opts.authorId ?? null
    this.apiUrl = opts.apiUrl ?? DEFAULT_API_URL
    this.anonymousId = getOrCreateAnonId()
    this.sessionId = safeUUID()

    this.boundFlush = () => {
      try {
        this.flush()
      } catch {
        /* silent */
      }
    }
    this.boundVisibilityChange = () => {
      try {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          this.flush()
        }
      } catch {
        /* silent */
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.boundFlush)
      window.addEventListener('beforeunload', this.boundFlush)
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', this.boundVisibilityChange)
      }
    }
  }

  // ── Public event methods ─────────────────────────────────────────────────

  open(): void {
    this.track({ event_type: 'open' })
  }

  slideView(slideIndex: number, durationMs?: number | null): void {
    this.track({
      event_type: 'slide_view',
      slide_index: slideIndex,
      duration_ms: durationMs ?? null,
    })
  }

  complete(totalDurationMs?: number | null): void {
    this.track({
      event_type: 'complete',
      duration_ms: totalDurationMs ?? null,
    })
    // Flush immediately — the user may close right after completing.
    this.flush()
  }

  share(method?: string): void {
    this.track({
      event_type: 'share',
      metadata: method ? { method } : undefined,
    })
  }

  linkClick(url: string): void {
    this.track({
      event_type: 'link_click',
      metadata: { url },
    })
  }

  /** Escape hatch — log any custom event type supported by the server. */
  custom(eventType: AnalyticsEventType, extra?: Partial<AnalyticsEventPayload>): void {
    this.track({
      event_type: eventType,
      ...(extra ?? {}),
    })
  }

  // ── Buffer + flush ───────────────────────────────────────────────────────

  private track(event: AnalyticsEventPayload): void {
    if (this.destroyed) return
    this.buffer.push(event)
    if (this.buffer.length >= FLUSH_THRESHOLD) {
      this.flush()
    }
  }

  flush(): void {
    if (this.destroyed) return
    if (this.flushing) return
    if (this.buffer.length === 0) return

    const events = this.buffer.splice(0, MAX_BATCH_SIZE)
    this.flushing = true

    const body: TrackRequestBody = {
      story_id: this.storyId,
      author_id: this.authorId,
      anonymous_id: this.anonymousId,
      session_id: this.sessionId,
      source: 'iframe',
      events,
    }

    const payload = JSON.stringify(body)

    try {
      // Preferred: sendBeacon — survives page unload.
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.sendBeacon === 'function' &&
        typeof Blob !== 'undefined'
      ) {
        const blob = new Blob([payload], { type: 'application/json' })
        const queued = navigator.sendBeacon(this.apiUrl, blob)
        if (queued) {
          this.flushing = false
          return
        }
      }

      // Fallback: fetch with keepalive.
      if (typeof fetch !== 'undefined') {
        fetch(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
          // Never throw from analytics
        })
          .catch(() => {
            /* swallow — analytics must never break the embed */
          })
          .finally(() => {
            this.flushing = false
          })
        return
      }

      // No transport available
      this.flushing = false
    } catch {
      this.flushing = false
    }
  }

  destroy(): void {
    if (this.destroyed) return
    try {
      this.flush()
    } catch {
      /* silent */
    }
    this.destroyed = true
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.boundFlush)
      window.removeEventListener('beforeunload', this.boundFlush)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this.boundVisibilityChange)
      }
    }
  }
}
