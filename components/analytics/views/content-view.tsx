'use client'

/**
 * Content sub-view — sortable, searchable story list with per-story metrics.
 */

import { useMemo } from 'react'
import { BookOpen, Eye, Target, Clock } from 'lucide-react'
import { HeroStat } from '../hero-stat'
import { PerformanceTable } from '../performance-table'
import type { AuthorAnalyticsBundle } from '@/lib/analytics/dashboard-types'
import { ContentSkeleton } from './skeletons'

interface ContentViewProps {
  bundle: AuthorAnalyticsBundle | null
  loading: boolean
}

export function ContentView({ bundle, loading }: ContentViewProps) {
  const summary = useMemo(() => {
    if (!bundle) return null
    const perf = bundle.performance
    const totalViews = perf.reduce((a, b) => a + b.views, 0)
    const totalCompletions = perf.reduce((a, b) => a + b.completions, 0)
    const totalMs = perf.reduce((a, b) => a + b.avgReadMs * b.completions, 0)
    const avgMs = totalCompletions > 0 ? totalMs / totalCompletions : 0
    const best = perf.reduce<typeof perf[number] | null>((best, cur) => {
      if (cur.views === 0) return best
      if (!best || cur.completionRate > best.completionRate) return cur
      return best
    }, null)
    return {
      totalStories: perf.length,
      totalViews,
      totalCompletions,
      overallCompletionRate: totalViews > 0 ? totalCompletions / totalViews : 0,
      avgReadMs: avgMs,
      bestStory: best,
    }
  }, [bundle])

  if (loading && !bundle) {
    return <ContentSkeleton />
  }

  if (!bundle || !summary) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroStat
          label="Total stories"
          value={summary.totalStories}
          format="number"
          icon={<BookOpen className="h-4 w-4" />}
          color="primary"
          index={0}
        />
        <HeroStat
          label="Total views"
          value={summary.totalViews}
          format="number"
          icon={<Eye className="h-4 w-4" />}
          color="accent"
          index={1}
        />
        <HeroStat
          label="Avg completion"
          value={summary.overallCompletionRate}
          format="ratio"
          icon={<Target className="h-4 w-4" />}
          color="success"
          index={2}
        />
        <HeroStat
          label="Avg time spent"
          value={summary.avgReadMs}
          format="duration-ms"
          icon={<Clock className="h-4 w-4" />}
          color="secondary"
          index={3}
        />
      </div>

      {summary.bestStory && summary.bestStory.views > 0 && (
        <div className="glass-card p-4 animate-chart-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/15 flex items-center justify-center flex-shrink-0">
              <Target className="h-5 w-5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Your star performer
              </p>
              <p className="text-sm font-medium text-foreground truncate">
                {summary.bestStory.headline || 'Untitled'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {Math.round(summary.bestStory.completionRate * 100)}% completion rate ·{' '}
                {summary.bestStory.views.toLocaleString()} views
              </p>
            </div>
          </div>
        </div>
      )}

      <PerformanceTable
        data={bundle.performance}
        title="All stories"
        subtitle="Sort by any column. Click a row for the full analytics deep dive."
        linkToDetail
        showSearch
      />
    </div>
  )
}
