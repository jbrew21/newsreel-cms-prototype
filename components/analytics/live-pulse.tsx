'use client'

import { useEffect, useRef, useState } from 'react'
import { Activity, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompact, formatRelativeTime, countryFlag } from '@/lib/formatters'
import type { LiveBundle, LiveEvent } from '@/lib/analytics/dashboard-types'

interface LivePulseProps {
  authorId?: string
  storyId?: string
  /** Poll interval in milliseconds. Default 30s. */
  intervalMs?: number
}

// ── Fetcher ────────────────────────────────────────────────────────────────

async function fetchLive(authorId?: string, storyId?: string): Promise<LiveBundle | null> {
  const params = new URLSearchParams()
  if (authorId) params.set('authorId', authorId)
  if (storyId) params.set('storyId', storyId)
  if (!params.toString()) return null
  try {
    const res = await fetch(`/api/analytics/live?${params.toString()}`)
    if (!res.ok) return null
    return (await res.json()) as LiveBundle
  } catch {
    return null
  }
}

// ── Tiny sparkline for per-minute events ──────────────────────────────────

function MiniSpark({ data }: { data: number[] }) {
  if (!data?.length) return null
  const width = 100
  const height = 22
  const max = Math.max(...data, 1)
  const step = data.length > 1 ? width / (data.length - 1) : 0
  const points = data
    .map((v, i) => `${i * step},${height - (v / max) * height}`)
    .join(' ')
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <defs>
        <linearGradient id="pulse-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(119, 75%, 38%)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(119, 75%, 38%)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke="hsl(119, 75%, 38%)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <polygon
        points={`${points} ${width},${height} 0,${height}`}
        fill="url(#pulse-spark)"
      />
    </svg>
  )
}

// ── Recent event formatter ────────────────────────────────────────────────

function formatEventLine(e: LiveEvent): string {
  const where = e.domain ? ` on ${e.domain}` : ''
  const story = e.story_headline ? `"${e.story_headline}"` : 'a story'
  if (e.event_type === 'open') return `opened ${story}${where}`
  if (e.event_type === 'complete') return `finished ${story}${where}`
  if (e.event_type === 'share') return `shared ${story}${where}`
  return `${e.event_type} on ${story}${where}`
}

// ── Component ─────────────────────────────────────────────────────────────

export function LivePulse({ authorId, storyId, intervalMs = 30_000 }: LivePulseProps) {
  const [data, setData] = useState<LiveBundle | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const bundle = await fetchLive(authorId, storyId)
      if (mounted) {
        setData(bundle)
        setLoading(false)
      }
    }
    load()

    timerRef.current = setInterval(load, intervalMs)

    return () => {
      mounted = false
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [authorId, storyId, intervalMs])

  const hasActivity = (data?.pulse.activeNow ?? 0) > 0
  const pulseColorClass = hasActivity ? 'bg-success' : 'bg-muted-foreground/30'
  const pulseRingClass = hasActivity ? 'bg-success/30 animate-ping' : ''

  const perMinute = data?.pulse.perMinute.map((p) => p.events) ?? []

  return (
    <div className="glass-card overflow-hidden">
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
        aria-expanded={expanded}
      >
        {/* Live dot */}
        <div className="relative w-2.5 h-2.5 flex-shrink-0">
          <span className={cn('absolute inset-0 rounded-full', pulseColorClass)} />
          {hasActivity && (
            <span className={cn('absolute inset-0 rounded-full', pulseRingClass)} />
          )}
        </div>

        {/* Status text */}
        <div className="flex-1 min-w-0 flex items-center gap-4 flex-wrap">
          <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-success" />
            {loading ? 'Loading…' : (
              <>
                <span className="tabular-nums">{data?.pulse.activeNow ?? 0}</span>
                <span className="text-muted-foreground">
                  {data?.pulse.activeNow === 1 ? 'reader' : 'readers'} right now
                </span>
              </>
            )}
          </span>

          {!loading && data && (
            <>
              <span className="text-[11px] text-muted-foreground hidden md:inline-flex items-center gap-1">
                <span className="tabular-nums text-foreground font-medium">
                  {formatCompact(data.pulse.lastHour)}
                </span>
                events / hr
              </span>
              <span className="text-[11px] text-muted-foreground hidden lg:inline-flex items-center gap-1">
                <span className="tabular-nums text-foreground font-medium">
                  {formatCompact(data.pulse.last24h)}
                </span>
                events / 24h
              </span>
            </>
          )}
        </div>

        {/* Sparkline — only when expanded is collapsed */}
        {!expanded && perMinute.length > 0 && (
          <div className="hidden md:block">
            <MiniSpark data={perMinute} />
          </div>
        )}

        <div className="flex-shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {/* Expanded panel — event feed */}
      {expanded && (
        <div className="border-t border-border/40 bg-muted/10">
          {/* Expanded sparkline */}
          {perMinute.length > 0 && (
            <div className="px-4 py-3 border-b border-border/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Activity, last 60 minutes
                </span>
              </div>
              <svg viewBox="0 0 400 40" className="w-full h-10" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="pulse-spark-lg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(119, 75%, 38%)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="hsl(119, 75%, 38%)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {(() => {
                  const max = Math.max(...perMinute, 1)
                  const step = perMinute.length > 1 ? 400 / (perMinute.length - 1) : 0
                  const points = perMinute
                    .map((v, i) => `${i * step},${40 - (v / max) * 40}`)
                    .join(' ')
                  return (
                    <>
                      <polyline
                        points={points}
                        fill="none"
                        stroke="hsl(119, 75%, 38%)"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <polygon
                        points={`${points} 400,40 0,40`}
                        fill="url(#pulse-spark-lg)"
                      />
                    </>
                  )
                })()}
              </svg>
            </div>
          )}

          {/* Recent events list */}
          <div className="divide-y divide-border/30 max-h-72 overflow-y-auto">
            {(data?.recent ?? []).length === 0 && !loading && (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                No recent activity yet.
              </div>
            )}
            {(data?.recent ?? []).map((e, i) => (
              <div
                key={i}
                className="px-4 py-2.5 flex items-start gap-3 hover:bg-muted/20 transition-colors"
              >
                <span className="text-sm flex-shrink-0 mt-0.5" aria-hidden>
                  {e.country ? countryFlag(e.country) : '🌐'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-foreground truncate">
                    <span className="text-muted-foreground">Someone</span>{' '}
                    {formatEventLine(e)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatRelativeTime(e.created_at)}
                    {e.device_type && (
                      <span className="ml-2 capitalize">{e.device_type}</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
