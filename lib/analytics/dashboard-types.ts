/**
 * Client-side types mirroring the shape returned by
 * /api/analytics/author/[id] and /api/analytics/story/[id].
 *
 * Kept separate from the server-side query types in
 * lib/supabase/analytics-events.ts so the client never imports anything
 * that touches the admin Supabase client.
 */

export type PeriodRange = '7d' | '30d' | '90d' | 'all'

export interface OverviewEngagement {
  views: number
  uniqueViewers: number
  completions: number
  completionRate: number
  avgReadMs: number
  totalReadMs: number
  returningReaders: number
  shareCount: number
}

export interface FunnelStep {
  label: string
  value: number
  pct: number
}

export interface TimeSeriesPoint {
  date: string
  views: number
  completions: number
  uniqueViewers: number
}

export interface RetentionPoint {
  slideIndex: number
  reached: number
  retentionPct: number
}

export interface SlideTimePoint {
  slideIndex: number
  avgMs: number
  views: number
}

export interface StoryPerformance {
  storyId: string
  headline: string | null
  views: number
  uniqueViewers: number
  completions: number
  completionRate: number
  avgReadMs: number
  shares: number
  firstSeenAt: string | null
  lastSeenAt: string | null
}

export interface DomainStat {
  domain: string
  views: number
  uniqueViewers: number
  completions: number
  completionRate: number
}

export interface DeviceStat {
  deviceType: string
  views: number
  pct: number
}

export interface CountryStat {
  country: string
  views: number
  uniqueViewers: number
}

export interface LoyaltyBucket {
  label: string
  count: number
  pct: number
}

export interface HoursHeatmapCell {
  dayOfWeek: number
  hour: number
  views: number
}

export interface LiveEvent {
  event_type: string
  slide_index: number | null
  story_id: string
  story_headline: string | null
  country: string | null
  domain: string | null
  device_type: string | null
  created_at: string
}

export interface LivePulse {
  activeNow: number
  lastHour: number
  last24h: number
  perMinute: { minute: string; events: number }[]
}

export interface AuthorAnalyticsBundle {
  range: PeriodRange
  storyCount: number
  overview: OverviewEngagement
  overviewPrev: OverviewEngagement | null
  funnel: FunnelStep[]
  timeSeries: TimeSeriesPoint[]
  performance: StoryPerformance[]
  domains: DomainStat[]
  devices: DeviceStat[]
  countries: CountryStat[]
  loyalty: LoyaltyBucket[]
  heatmap: HoursHeatmapCell[]
}

export interface StoryAnalyticsBundle {
  story: {
    id: string
    headline: string | null
    subhead: string | null
    story_type: string | null
    published_at: string | null
    created_at: string | null
    slide_count: number
    cover_url: string | null
    cover_media_type: string | null
    authors: { id: string; name: string; avatar_url: string | null }[]
  }
  range: PeriodRange
  overview: OverviewEngagement
  overviewPrev: OverviewEngagement | null
  funnel: FunnelStep[]
  timeSeries: TimeSeriesPoint[]
  retention: RetentionPoint[]
  timePerSlide: SlideTimePoint[]
  domains: DomainStat[]
  devices: DeviceStat[]
  countries: CountryStat[]
}

export interface LiveBundle {
  pulse: LivePulse
  recent: LiveEvent[]
  storyCount: number
}
