'use client'

/**
 * StoryAnalyticsView — the full per-story deep dive.
 * Rendered at /dashboard/story/[id]/analytics.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Clock,
  ExternalLink,
  Eye,
  Layers,
  Share2,
  Target,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompact, formatDate, formatDurationShort } from '@/lib/formatters'
import { HeroStat } from '../hero-stat'
import { EngagementFunnel } from '../engagement-funnel'
import { RetentionCurve } from '../retention-curve'
import { TimePerSlide } from '../time-per-slide'
import { AnalyticsAreaChart } from '../area-chart'
import { DomainBreakdown } from '../domain-breakdown'
import { DeviceBreakdown } from '../device-breakdown'
import { WorldMap } from '../world-map'
import { LivePulse } from '../live-pulse'
import { PeriodSelector, rangeLabel } from '../period-selector'
import { StoryAnalyticsSkeleton } from './skeletons'
import type { PeriodRange, StoryAnalyticsBundle } from '@/lib/analytics/dashboard-types'

interface StoryAnalyticsViewProps {
  storyId: string
}

async function fetchStoryAnalytics(
  storyId: string,
  range: PeriodRange,
  compare: boolean
): Promise<StoryAnalyticsBundle | null> {
  try {
    const params = new URLSearchParams({ range, compare: compare ? 'true' : 'false' })
    const res = await fetch(`/api/analytics/story/${storyId}?${params.toString()}`)
    if (!res.ok) return null
    return (await res.json()) as StoryAnalyticsBundle
  } catch (err) {
    console.error('[StoryAnalyticsView] fetch error', err)
    return null
  }
}

export function StoryAnalyticsView({ storyId }: StoryAnalyticsViewProps) {
  const router = useRouter()
  const [range, setRange] = useState<PeriodRange>('30d')
  const [bundle, setBundle] = useState<StoryAnalyticsBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const b = await fetchStoryAnalytics(storyId, range, true)
    if (!b) {
      setNotFound(true)
    } else {
      setBundle(b)
      setNotFound(false)
    }
    setLoading(false)
  }, [storyId, range])

  useEffect(() => {
    load()
  }, [load])

  const summary = useMemo(() => {
    if (!bundle) return null
    const avgPerSlide =
      bundle.timePerSlide.length > 0
        ? bundle.timePerSlide.reduce((s, p) => s + p.avgMs, 0) / bundle.timePerSlide.length
        : 0
    const hookStrength =
      bundle.retention.length >= 2
        ? bundle.retention[1].retentionPct
        : 1
    return { avgPerSlide, hookStrength }
  }, [bundle])

  if (notFound) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16">
        <button
          type="button"
          onClick={() => router.push('/dashboard?tab=analytics')}
          className="text-xs text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="glass-card p-12 text-center">
          <h3 className="text-lg font-medium text-foreground mb-2">Story not found</h3>
          <p className="text-sm text-muted-foreground">
            This story may have been deleted or is no longer accessible.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
      {/* Back button + period */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => router.push('/dashboard?tab=analytics')}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to analytics
        </button>
        <PeriodSelector value={range} onChange={setRange} />
      </div>

      {loading && !bundle ? (
        <StoryAnalyticsSkeleton />
      ) : bundle ? (
        <>
          {/* Story header card */}
          <div className="glass-card p-5 animate-chart-in">
            <div className="flex flex-col md:flex-row gap-5">
              {bundle.story.cover_url && (
                <div className="w-full md:w-40 aspect-square rounded-lg overflow-hidden flex-shrink-0 bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {bundle.story.cover_media_type === 'video' ? (
                    <video
                      src={bundle.story.cover_url}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      autoPlay
                      playsInline
                    />
                  ) : (
                    <img
                      src={bundle.story.cover_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              )}

              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <h1 className="text-xl md:text-2xl font-semibold text-foreground leading-tight">
                    {bundle.story.headline || 'Untitled'}
                  </h1>
                  {bundle.story.subhead && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {bundle.story.subhead}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 flex-wrap text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    {bundle.story.published_at
                      ? `Published ${formatDate(bundle.story.published_at)}`
                      : 'Draft'}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3 w-3" />
                    {bundle.story.slide_count} {bundle.story.slide_count === 1 ? 'slide' : 'slides'}
                  </div>
                  {bundle.story.authors.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3" />
                      by {bundle.story.authors.map((a) => a.name).join(', ')}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <a
                    href={`/embed/story/${bundle.story.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View story
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Live pulse */}
          <LivePulse storyId={storyId} />

          {/* Hero metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <HeroStat
              label="Views"
              value={bundle.overview.views}
              previousValue={bundle.overviewPrev?.views ?? null}
              format="number"
              icon={<Eye className="h-4 w-4" />}
              color="primary"
              index={0}
            />
            <HeroStat
              label="Unique readers"
              value={bundle.overview.uniqueViewers}
              previousValue={bundle.overviewPrev?.uniqueViewers ?? null}
              format="number"
              icon={<Users className="h-4 w-4" />}
              color="accent"
              index={1}
            />
            <HeroStat
              label="Completion rate"
              value={bundle.overview.completionRate}
              previousValue={bundle.overviewPrev?.completionRate ?? null}
              format="ratio"
              icon={<Target className="h-4 w-4" />}
              color="success"
              index={2}
            />
            <HeroStat
              label="Avg read time"
              value={bundle.overview.avgReadMs}
              previousValue={bundle.overviewPrev?.avgReadMs ?? null}
              format="duration-ms"
              icon={<Clock className="h-4 w-4" />}
              color="secondary"
              index={3}
            />
            <HeroStat
              label="Hook strength"
              value={(summary?.hookStrength ?? 0) * 100}
              format="percent"
              hint="% who passed slide 1"
              icon={<Target className="h-4 w-4" />}
              color="purple"
              index={4}
            />
          </div>

          {/* Views over time */}
          {bundle.timeSeries.length > 0 && (
            <AnalyticsAreaChart
              data={bundle.timeSeries}
              xKey="date"
              yKeys={[
                { key: 'views', label: 'Views', color: 'primary' },
                { key: 'completions', label: 'Completions', color: 'success' },
              ]}
              title="Views over time"
              subtitle={`This story's trend — ${rangeLabel(range)}`}
              height={260}
            />
          )}

          {/* Retention + Time per slide */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RetentionCurve data={bundle.retention} />
            <TimePerSlide data={bundle.timePerSlide} />
          </div>

          {/* Funnel */}
          <EngagementFunnel steps={bundle.funnel} />

          {/* Audience breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DomainBreakdown data={bundle.domains} title="Traffic sources" subtitle="Where this story is being read" />
            <DeviceBreakdown data={bundle.devices} />
          </div>

          <WorldMap data={bundle.countries} />

          {/* Share / export footer */}
          <div className="glass-card p-4 animate-chart-in">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-medium text-foreground">Share this story's stats</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Use the shareable URL above to send this report to your team.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard?.writeText(window.location.href)
                  }
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md',
                  'bg-muted/40 hover:bg-muted/60 border border-border/40',
                  'text-xs font-medium text-foreground transition-colors'
                )}
              >
                <Share2 className="h-3 w-3" />
                Copy link
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
