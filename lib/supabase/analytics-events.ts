/**
 * Analytics queries built on top of the `story_events` table.
 *
 * These are READ-only and use the public anon client. RLS on `story_events`
 * blocks direct client access — the queries here should be called from
 * client components that live under an authenticated dashboard route, OR
 * from server components. For publisher-scoped reads we could later wrap
 * these in API routes, but for now the author-scoped dashboard uses them
 * directly.
 *
 * NOTE: Because RLS blocks anon SELECT on story_events by design, these
 * queries currently need to be invoked from a server context OR via an
 * API route that uses the service-role client. To keep this file simple
 * and reusable, all functions accept a Supabase client instance that the
 * caller provides — the admin client on the server, or the anon client
 * (with RLS allowance, if ever added) on the client.
 *
 * For the dashboard we'll call these from client components that go
 * through thin API wrapper routes (see /api/analytics/*).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────────────────────────────

export type PeriodRange = '7d' | '30d' | '90d' | 'all' | 'custom'

export interface DateRange {
  start: Date
  end: Date
}

export interface OverviewEngagement {
  views: number
  uniqueViewers: number
  completions: number
  completionRate: number // 0..1
  avgReadMs: number
  totalReadMs: number
  returningReaders: number
  shareCount: number
}

export interface FunnelStep {
  label: string
  value: number
  pct: number // 0..1, relative to step 1
}

export interface TimeSeriesPoint {
  date: string // YYYY-MM-DD
  views: number
  completions: number
  uniqueViewers: number
}

export interface RetentionPoint {
  slideIndex: number
  reached: number
  retentionPct: number // 0..1 vs slide 0
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
  country: string // ISO 2-letter
  views: number
  uniqueViewers: number
}

export interface LoyaltyBucket {
  label: string // "1 story", "2-5 stories", "6+ stories"
  count: number
  pct: number
}

export interface HoursHeatmapCell {
  dayOfWeek: number // 0=Sun..6=Sat
  hour: number // 0..23
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
  activeNow: number // unique anon/user IDs in last 5 minutes
  lastHour: number // events in last hour
  last24h: number // events in last 24h
  perMinute: { minute: string; events: number }[] // last 60 min
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function rangeToDates(range: PeriodRange): DateRange {
  const end = new Date()
  const start = new Date()
  switch (range) {
    case '7d':
      start.setDate(end.getDate() - 7)
      break
    case '30d':
      start.setDate(end.getDate() - 30)
      break
    case '90d':
      start.setDate(end.getDate() - 90)
      break
    case 'all':
      start.setFullYear(2020, 0, 1)
      break
    case 'custom':
      // caller should override
      start.setDate(end.getDate() - 30)
      break
  }
  return { start, end }
}

/** Previous period of the same length (for delta comparison). */
export function previousRange(range: DateRange): DateRange {
  const lengthMs = range.end.getTime() - range.start.getTime()
  return {
    start: new Date(range.start.getTime() - lengthMs),
    end: new Date(range.start.getTime()),
  }
}

function toIso(d: Date): string {
  return d.toISOString()
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Identity key used to dedupe viewers: prefer user_id, else anonymous_id. */
function viewerKey(row: { user_id: string | null; anonymous_id: string | null }): string | null {
  return row.user_id || row.anonymous_id || null
}

// ── Base fetcher ─────────────────────────────────────────────────────────────

interface BaseFetchOptions {
  storyIds: string[]
  range: DateRange
  eventTypes?: string[]
}

/**
 * Core row shape we read repeatedly. Keep narrow for bandwidth.
 */
interface EventRow {
  story_id: string
  user_id: string | null
  anonymous_id: string | null
  session_id: string | null
  event_type: string
  slide_index: number | null
  duration_ms: number | null
  domain: string | null
  device_type: string | null
  country: string | null
  source: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}

async function fetchEvents(
  client: SupabaseClient,
  opts: BaseFetchOptions,
  select = 'story_id,user_id,anonymous_id,session_id,event_type,slide_index,duration_ms,domain,device_type,country,source,created_at,metadata'
): Promise<EventRow[]> {
  if (!opts.storyIds.length) return []

  let query = client
    .from('story_events')
    .select(select)
    .in('story_id', opts.storyIds)
    .gte('created_at', toIso(opts.range.start))
    .lte('created_at', toIso(opts.range.end))
    .order('created_at', { ascending: true })
    .limit(100_000) // generous ceiling — split ranges if you exceed this

  if (opts.eventTypes?.length) {
    query = query.in('event_type', opts.eventTypes)
  }

  const { data, error } = await query
  if (error) {
    console.error('[analytics-events] fetchEvents error:', error.message)
    return []
  }
  return (data as unknown as EventRow[]) || []
}

// ── Overview ─────────────────────────────────────────────────────────────────

export async function getOverviewEngagement(
  client: SupabaseClient,
  storyIds: string[],
  range: DateRange
): Promise<OverviewEngagement> {
  const rows = await fetchEvents(client, { storyIds, range })

  let views = 0
  let completions = 0
  let shareCount = 0
  let totalCompleteMs = 0
  let completeCount = 0
  const uniqueViewers = new Set<string>()
  const sessionCountByViewer = new Map<string, Set<string>>()

  for (const r of rows) {
    if (r.event_type === 'open') {
      views++
      const k = viewerKey(r)
      if (k) {
        uniqueViewers.add(k)
        if (r.session_id) {
          if (!sessionCountByViewer.has(k)) sessionCountByViewer.set(k, new Set())
          sessionCountByViewer.get(k)!.add(r.session_id)
        }
      }
    } else if (r.event_type === 'complete') {
      completions++
      if (r.duration_ms != null && r.duration_ms > 0) {
        totalCompleteMs += r.duration_ms
        completeCount++
      }
    } else if (r.event_type === 'share') {
      shareCount++
    }
  }

  let returningReaders = 0
  for (const sessions of sessionCountByViewer.values()) {
    if (sessions.size >= 2) returningReaders++
  }

  return {
    views,
    uniqueViewers: uniqueViewers.size,
    completions,
    completionRate: views > 0 ? completions / views : 0,
    avgReadMs: completeCount > 0 ? totalCompleteMs / completeCount : 0,
    totalReadMs: totalCompleteMs,
    returningReaders,
    shareCount,
  }
}

// ── Funnel ───────────────────────────────────────────────────────────────────

export async function getEngagementFunnel(
  client: SupabaseClient,
  storyIds: string[],
  range: DateRange
): Promise<FunnelStep[]> {
  const rows = await fetchEvents(client, { storyIds, range })

  // Group by session to compute furthest slide reached per session
  const sessions = new Map<
    string,
    { opened: boolean; completed: boolean; maxSlide: number; shared: boolean }
  >()

  for (const r of rows) {
    const key = r.session_id || `${r.anonymous_id || r.user_id}-${r.story_id}`
    if (!sessions.has(key)) {
      sessions.set(key, { opened: false, completed: false, maxSlide: -1, shared: false })
    }
    const s = sessions.get(key)!
    if (r.event_type === 'open') s.opened = true
    if (r.event_type === 'complete') s.completed = true
    if (r.event_type === 'share') s.shared = true
    if (r.event_type === 'slide_view' && r.slide_index != null) {
      if (r.slide_index > s.maxSlide) s.maxSlide = r.slide_index
    }
  }

  let opens = 0
  let pastFirst = 0
  let halfway = 0
  let completes = 0
  let shares = 0

  for (const s of sessions.values()) {
    if (s.opened) opens++
    if (s.maxSlide >= 1) pastFirst++
    if (s.maxSlide >= 4) halfway++ // rough midpoint heuristic
    if (s.completed) completes++
    if (s.shared) shares++
  }

  const base = opens || 1
  return [
    { label: 'Opened', value: opens, pct: 1 },
    { label: 'Past slide 1', value: pastFirst, pct: pastFirst / base },
    { label: 'Halfway', value: halfway, pct: halfway / base },
    { label: 'Completed', value: completes, pct: completes / base },
    { label: 'Shared', value: shares, pct: shares / base },
  ]
}

// ── Time series ──────────────────────────────────────────────────────────────

export async function getTimeSeries(
  client: SupabaseClient,
  storyIds: string[],
  range: DateRange
): Promise<TimeSeriesPoint[]> {
  const rows = await fetchEvents(client, { storyIds, range }, 'story_id,user_id,anonymous_id,event_type,created_at')

  const buckets = new Map<string, { views: number; completions: number; viewers: Set<string> }>()

  // Seed dates so gaps render as zeros
  const msDay = 24 * 60 * 60 * 1000
  for (let t = range.start.getTime(); t <= range.end.getTime(); t += msDay) {
    const key = ymd(new Date(t))
    buckets.set(key, { views: 0, completions: 0, viewers: new Set() })
  }

  for (const r of rows as any as EventRow[]) {
    const key = ymd(new Date(r.created_at))
    if (!buckets.has(key)) {
      buckets.set(key, { views: 0, completions: 0, viewers: new Set() })
    }
    const b = buckets.get(key)!
    if (r.event_type === 'open') {
      b.views++
      const k = viewerKey(r)
      if (k) b.viewers.add(k)
    } else if (r.event_type === 'complete') {
      b.completions++
    }
  }

  return Array.from(buckets.entries())
    .map(([date, v]) => ({
      date,
      views: v.views,
      completions: v.completions,
      uniqueViewers: v.viewers.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ── Retention curve ──────────────────────────────────────────────────────────

export async function getRetentionCurve(
  client: SupabaseClient,
  storyId: string,
  range: DateRange
): Promise<RetentionPoint[]> {
  const rows = await fetchEvents(
    client,
    { storyIds: [storyId], range, eventTypes: ['slide_view'] },
    'story_id,session_id,anonymous_id,user_id,slide_index'
  )

  // For each slide index, count distinct sessions that viewed it
  const slideSessions = new Map<number, Set<string>>()
  for (const r of rows) {
    if (r.slide_index == null) continue
    const key = r.session_id || `${r.anonymous_id || r.user_id || 'x'}`
    if (!slideSessions.has(r.slide_index)) slideSessions.set(r.slide_index, new Set())
    slideSessions.get(r.slide_index)!.add(key)
  }

  if (slideSessions.size === 0) return []

  const maxSlide = Math.max(...slideSessions.keys())
  const slide0 = slideSessions.get(0)?.size ?? 0
  const denom = slide0 || 1

  const result: RetentionPoint[] = []
  for (let i = 0; i <= maxSlide; i++) {
    const reached = slideSessions.get(i)?.size ?? 0
    result.push({
      slideIndex: i,
      reached,
      retentionPct: reached / denom,
    })
  }
  return result
}

// ── Time per slide ───────────────────────────────────────────────────────────

export async function getTimePerSlide(
  client: SupabaseClient,
  storyId: string,
  range: DateRange
): Promise<SlideTimePoint[]> {
  const rows = await fetchEvents(
    client,
    { storyIds: [storyId], range, eventTypes: ['slide_view'] },
    'story_id,slide_index,duration_ms'
  )

  const acc = new Map<number, { total: number; count: number }>()
  for (const r of rows) {
    if (r.slide_index == null || r.duration_ms == null || r.duration_ms <= 0) continue
    if (!acc.has(r.slide_index)) acc.set(r.slide_index, { total: 0, count: 0 })
    const e = acc.get(r.slide_index)!
    e.total += r.duration_ms
    e.count++
  }

  return Array.from(acc.entries())
    .map(([slideIndex, v]) => ({
      slideIndex,
      avgMs: v.count > 0 ? v.total / v.count : 0,
      views: v.count,
    }))
    .sort((a, b) => a.slideIndex - b.slideIndex)
}

// ── Per-story performance (for the Content table) ────────────────────────────

export async function getStoryPerformance(
  client: SupabaseClient,
  storyIds: string[],
  range: DateRange
): Promise<StoryPerformance[]> {
  if (!storyIds.length) return []

  // Fetch events in the period
  const rows = await fetchEvents(client, { storyIds, range })

  // Fetch story headlines separately so we can render even stories with 0 events
  const { data: stories } = await client
    .from('stories')
    .select('id, story_headline, published_at, created_at')
    .in('id', storyIds)

  interface Agg {
    views: number
    completions: number
    totalMs: number
    completeCount: number
    shares: number
    viewers: Set<string>
    firstSeen: string | null
    lastSeen: string | null
  }

  const agg = new Map<string, Agg>()
  const ensure = (id: string) => {
    if (!agg.has(id)) {
      agg.set(id, {
        views: 0,
        completions: 0,
        totalMs: 0,
        completeCount: 0,
        shares: 0,
        viewers: new Set(),
        firstSeen: null,
        lastSeen: null,
      })
    }
    return agg.get(id)!
  }

  for (const r of rows) {
    const a = ensure(r.story_id)
    if (!a.firstSeen || r.created_at < a.firstSeen) a.firstSeen = r.created_at
    if (!a.lastSeen || r.created_at > a.lastSeen) a.lastSeen = r.created_at
    if (r.event_type === 'open') {
      a.views++
      const k = viewerKey(r)
      if (k) a.viewers.add(k)
    } else if (r.event_type === 'complete') {
      a.completions++
      if (r.duration_ms != null && r.duration_ms > 0) {
        a.totalMs += r.duration_ms
        a.completeCount++
      }
    } else if (r.event_type === 'share') {
      a.shares++
    }
  }

  return (stories || []).map((s: any) => {
    const a = agg.get(s.id) || ({
      views: 0,
      completions: 0,
      totalMs: 0,
      completeCount: 0,
      shares: 0,
      viewers: new Set<string>(),
      firstSeen: null,
      lastSeen: null,
    } as Agg)
    return {
      storyId: s.id,
      headline: s.story_headline,
      views: a.views,
      uniqueViewers: a.viewers.size,
      completions: a.completions,
      completionRate: a.views > 0 ? a.completions / a.views : 0,
      avgReadMs: a.completeCount > 0 ? a.totalMs / a.completeCount : 0,
      shares: a.shares,
      firstSeenAt: a.firstSeen,
      lastSeenAt: a.lastSeen,
    }
  })
}

// ── Demographics: domains, devices, countries, loyalty, heatmap ──────────────

export async function getDomainBreakdown(
  client: SupabaseClient,
  storyIds: string[],
  range: DateRange
): Promise<DomainStat[]> {
  const rows = await fetchEvents(client, { storyIds, range })

  interface Agg {
    views: number
    completions: number
    viewers: Set<string>
  }
  const map = new Map<string, Agg>()

  for (const r of rows) {
    const key = (r.domain || 'direct').trim()
    if (!map.has(key)) map.set(key, { views: 0, completions: 0, viewers: new Set() })
    const e = map.get(key)!
    if (r.event_type === 'open') {
      e.views++
      const k = viewerKey(r)
      if (k) e.viewers.add(k)
    } else if (r.event_type === 'complete') {
      e.completions++
    }
  }

  return Array.from(map.entries())
    .map(([domain, e]) => ({
      domain,
      views: e.views,
      uniqueViewers: e.viewers.size,
      completions: e.completions,
      completionRate: e.views > 0 ? e.completions / e.views : 0,
    }))
    .filter((e) => e.views > 0)
    .sort((a, b) => b.views - a.views)
}

export async function getDeviceBreakdown(
  client: SupabaseClient,
  storyIds: string[],
  range: DateRange
): Promise<DeviceStat[]> {
  const rows = await fetchEvents(
    client,
    { storyIds, range, eventTypes: ['open'] },
    'story_id,device_type,event_type'
  )

  const counts = new Map<string, number>()
  for (const r of rows) {
    const key = r.device_type || 'unknown'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1
  return Array.from(counts.entries())
    .map(([deviceType, views]) => ({
      deviceType,
      views,
      pct: views / total,
    }))
    .sort((a, b) => b.views - a.views)
}

export async function getCountryBreakdown(
  client: SupabaseClient,
  storyIds: string[],
  range: DateRange
): Promise<CountryStat[]> {
  const rows = await fetchEvents(
    client,
    { storyIds, range, eventTypes: ['open'] },
    'story_id,country,user_id,anonymous_id,event_type'
  )

  interface Agg {
    views: number
    viewers: Set<string>
  }
  const map = new Map<string, Agg>()
  for (const r of rows) {
    const key = (r.country || 'XX').toUpperCase()
    if (!map.has(key)) map.set(key, { views: 0, viewers: new Set() })
    const e = map.get(key)!
    e.views++
    const k = viewerKey(r)
    if (k) e.viewers.add(k)
  }

  return Array.from(map.entries())
    .map(([country, e]) => ({
      country,
      views: e.views,
      uniqueViewers: e.viewers.size,
    }))
    .sort((a, b) => b.views - a.views)
}

export async function getLoyaltyDistribution(
  client: SupabaseClient,
  storyIds: string[],
  range: DateRange
): Promise<LoyaltyBucket[]> {
  const rows = await fetchEvents(
    client,
    { storyIds, range, eventTypes: ['open'] },
    'story_id,user_id,anonymous_id,event_type'
  )

  // count distinct stories per viewer
  const viewerStories = new Map<string, Set<string>>()
  for (const r of rows) {
    const k = viewerKey(r)
    if (!k) continue
    if (!viewerStories.has(k)) viewerStories.set(k, new Set())
    viewerStories.get(k)!.add(r.story_id)
  }

  let one = 0
  let twoToFive = 0
  let sixPlus = 0
  for (const stories of viewerStories.values()) {
    const n = stories.size
    if (n === 1) one++
    else if (n <= 5) twoToFive++
    else sixPlus++
  }
  const total = one + twoToFive + sixPlus || 1
  return [
    { label: '1 story', count: one, pct: one / total },
    { label: '2–5 stories', count: twoToFive, pct: twoToFive / total },
    { label: '6+ stories', count: sixPlus, pct: sixPlus / total },
  ]
}

export async function getHoursHeatmap(
  client: SupabaseClient,
  storyIds: string[],
  range: DateRange
): Promise<HoursHeatmapCell[]> {
  const rows = await fetchEvents(
    client,
    { storyIds, range, eventTypes: ['open'] },
    'story_id,created_at,event_type'
  )

  const grid: HoursHeatmapCell[] = []
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      grid.push({ dayOfWeek: d, hour: h, views: 0 })
    }
  }

  for (const r of rows) {
    const date = new Date(r.created_at)
    const d = date.getDay() // 0..6 Sun..Sat
    const h = date.getHours() // 0..23
    const idx = d * 24 + h
    if (grid[idx]) grid[idx].views++
  }

  return grid
}

// ── Live pulse ──────────────────────────────────────────────────────────────

export async function getLivePulse(
  client: SupabaseClient,
  storyIds: string[]
): Promise<LivePulse> {
  if (!storyIds.length) {
    return { activeNow: 0, lastHour: 0, last24h: 0, perMinute: [] }
  }

  const now = new Date()
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const rows = await fetchEvents(
    client,
    { storyIds, range: { start, end: now } },
    'story_id,user_id,anonymous_id,event_type,created_at'
  )

  const fiveMinAgo = now.getTime() - 5 * 60 * 1000
  const oneHourAgo = now.getTime() - 60 * 60 * 1000
  const activeIds = new Set<string>()
  let lastHour = 0
  let last24h = rows.length

  const perMinuteMap = new Map<string, number>()
  // seed last 60 minutes
  for (let i = 59; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60 * 1000)
    const key = d.toISOString().slice(0, 16) // YYYY-MM-DDTHH:MM
    perMinuteMap.set(key, 0)
  }

  for (const r of rows) {
    const t = new Date(r.created_at).getTime()
    if (t >= fiveMinAgo) {
      const k = viewerKey(r)
      if (k) activeIds.add(k)
    }
    if (t >= oneHourAgo) {
      lastHour++
      const key = new Date(r.created_at).toISOString().slice(0, 16)
      if (perMinuteMap.has(key)) {
        perMinuteMap.set(key, (perMinuteMap.get(key) ?? 0) + 1)
      }
    }
  }

  return {
    activeNow: activeIds.size,
    lastHour,
    last24h,
    perMinute: Array.from(perMinuteMap.entries()).map(([minute, events]) => ({
      minute,
      events,
    })),
  }
}

export async function getRecentEvents(
  client: SupabaseClient,
  storyIds: string[],
  limit = 20
): Promise<LiveEvent[]> {
  if (!storyIds.length) return []

  const { data, error } = await client
    .from('story_events')
    .select('event_type,slide_index,story_id,country,domain,device_type,created_at')
    .in('story_id', storyIds)
    .in('event_type', ['open', 'complete', 'share'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  const ids = Array.from(new Set(data.map((r: any) => r.story_id)))
  const headlines = new Map<string, string | null>()
  if (ids.length) {
    const { data: stories } = await client
      .from('stories')
      .select('id, story_headline')
      .in('id', ids)
    for (const s of stories || []) {
      headlines.set(s.id, s.story_headline)
    }
  }

  return (data as any[]).map((r) => ({
    event_type: r.event_type,
    slide_index: r.slide_index,
    story_id: r.story_id,
    story_headline: headlines.get(r.story_id) || null,
    country: r.country,
    domain: r.domain,
    device_type: r.device_type,
    created_at: r.created_at,
  }))
}
