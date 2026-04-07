/**
 * Analytics event types — shared between client tracker and the
 * /api/analytics/track endpoint.
 *
 * Mirrors the CHECK constraints on the `story_events` Supabase table.
 * If you change anything here, update the SQL CHECK constraints too.
 */

export type AnalyticsEventType =
  | 'open'
  | 'slide_view'
  | 'complete'
  | 'share'
  | 'save'
  | 'audio_play'
  | 'audio_complete'
  | 'link_click'

export type AnalyticsSource = 'app' | 'iframe' | 'web'

/**
 * A single event from the client. The server enriches each event
 * with `domain`, `referrer`, `device_type`, and `country` from request headers.
 */
export interface AnalyticsEventPayload {
  event_type: AnalyticsEventType
  slide_index?: number | null
  duration_ms?: number | null
  metadata?: Record<string, unknown>
}

/**
 * Full request body for POST /api/analytics/track.
 * Multiple events are batched into a single request.
 */
export interface TrackRequestBody {
  story_id: string
  author_id?: string | null
  user_id?: string | null
  anonymous_id?: string | null
  session_id?: string | null
  source?: AnalyticsSource
  events: AnalyticsEventPayload[]
}
