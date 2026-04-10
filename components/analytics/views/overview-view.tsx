'use client'

/**
 * Overview sub-view — the default landing inside the Analytics tab.
 *
 * Shows the complete author-level performance summary:
 *   - Hero metric cards (views, unique readers, completion rate, avg time, returning)
 *   - Engagement funnel
 *   - Time series (views + completions over time)
 *   - Retention curve (top 3 stories overlay)
 *   - Top stories quick list
 */

import { useMemo } from 'react'
import { Eye, Users, Target, Clock, Repeat, Share2 } from 'lucide-react'
import { HeroStat } from '../hero-stat'
import { EngagementFunnel } from '../engagement-funnel'
import { AnalyticsAreaChart } from '../area-chart'
import { PerformanceTable } from '../performance-table'
import { rangeLabel } from '../period-selector'
import type { AuthorAnalyticsBundle, PeriodRange } from '@/lib/analytics/dashboard-types'
import { OverviewSkeleton } from './skeletons'

interface OverviewViewProps {
  bundle: AuthorAnalyticsBundle | null
  range: PeriodRange
  loading: boolean
}

export function OverviewView({ bundle, range, loading }: OverviewViewProps) {
  const sparklineData = useMemo(() => {
    if (!bundle?.timeSeries.length) return null
    return {
      views: bundle.timeSeries.map((p) => p.views),
      completions: bundle.timeSeries.map((p) => p.completions),
      uniqueViewers: bundle.timeSeries.map((p) => p.uniqueViewers),
    }
  }, [bundle])

  if (loading && !bundle) {
    return <OverviewSkeleton />
  }

  if (!bundle || bundle.storyCount === 0) {
    return null
  }

  const { overview, overviewPrev, funnel, timeSeries, performance } = bundle
  const topStories = performance.slice(0, 8)

  return (
    <div className="space-y-6">
      {/* Hero stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <HeroStat
          label="Views"
          value={overview.views}
          previousValue={overviewPrev?.views ?? null}
          format="number"
          icon={<Eye className="h-4 w-4" />}
          color="primary"
          sparkline={sparklineData?.views}
          index={0}
        />
        <HeroStat
          label="Unique readers"
          value={overview.uniqueViewers}
          previousValue={overviewPrev?.uniqueViewers ?? null}
          format="number"
          icon={<Users className="h-4 w-4" />}
          color="accent"
          sparkline={sparklineData?.uniqueViewers}
          index={1}
        />
        <HeroStat
          label="Completion rate"
          value={overview.completionRate}
          previousValue={overviewPrev?.completionRate ?? null}
          format="ratio"
          icon={<Target className="h-4 w-4" />}
          color="success"
          index={2}
        />
        <HeroStat
          label="Avg time spent"
          value={overview.avgReadMs}
          previousValue={overviewPrev?.avgReadMs ?? null}
          format="duration-ms"
          icon={<Clock className="h-4 w-4" />}
          color="secondary"
          index={3}
        />
        <HeroStat
          label="Returning readers"
          value={overview.returningReaders}
          previousValue={overviewPrev?.returningReaders ?? null}
          format="number"
          icon={<Repeat className="h-4 w-4" />}
          color="purple"
          index={4}
        />
        <HeroStat
          label="Shares"
          value={overview.shareCount}
          previousValue={overviewPrev?.shareCount ?? null}
          format="number"
          icon={<Share2 className="h-4 w-4" />}
          color="blue"
          index={5}
        />
      </div>

      {/* Funnel + Time series */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <EngagementFunnel steps={funnel} />
        </div>
        <div className="lg:col-span-2">
          {timeSeries.length > 0 && (
            <AnalyticsAreaChart
              data={timeSeries}
              xKey="date"
              yKeys={[
                { key: 'views', label: 'Views', color: 'primary' },
                { key: 'completions', label: 'Completions', color: 'success' },
              ]}
              title="Reader activity"
              subtitle={`Daily views and completions — ${rangeLabel(range)}`}
              height={280}
            />
          )}
        </div>
      </div>

      {/* Top performing stories */}
      {topStories.length > 0 && (
        <PerformanceTable
          data={topStories}
          title="Top performing stories"
          subtitle="Click any row for the full deep dive"
          linkToDetail
        />
      )}
    </div>
  )
}
