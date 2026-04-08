'use client'

/**
 * AnalyticsDashboard — the entry point rendered inside the dashboard's
 * "Analytics" tab.
 *
 * Structure (YouTube Studio-style):
 *   - Header: title + period selector
 *   - Live pulse widget (persistent, collapsible)
 *   - Sub-nav: Overview | Content | Audience
 *   - Sub-view content
 *
 * Data: fetched once per (authorId, range) from /api/analytics/author/:id
 * and shared across all three sub-views.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, LayoutGrid, Users, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SubNav, type SubNavItem } from './sub-nav'
import { PeriodSelector, rangeLabel } from './period-selector'
import { LivePulse } from './live-pulse'
import { OverviewView } from './views/overview-view'
import { ContentView } from './views/content-view'
import { AudienceView } from './views/audience-view'
import type {
  AuthorAnalyticsBundle,
  PeriodRange,
} from '@/lib/analytics/dashboard-types'

// ── Types ──────────────────────────────────────────────────────────────────

type SubTabId = 'overview' | 'content' | 'audience'

interface AnalyticsDashboardProps {
  authorId: string
  authorName: string
}

// ── Fetcher ─────────────────────────────────────────────────────────────────

async function fetchAuthorAnalytics(
  authorId: string,
  range: PeriodRange,
  compare: boolean
): Promise<AuthorAnalyticsBundle | null> {
  try {
    const params = new URLSearchParams({ range, compare: compare ? 'true' : 'false' })
    const res = await fetch(`/api/analytics/author/${authorId}?${params.toString()}`)
    if (!res.ok) return null
    return (await res.json()) as AuthorAnalyticsBundle
  } catch (err) {
    console.error('[AnalyticsDashboard] fetch error', err)
    return null
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export function AnalyticsDashboard({ authorId, authorName }: AnalyticsDashboardProps) {
  const [range, setRange] = useState<PeriodRange>('30d')
  const [subTab, setSubTab] = useState<SubTabId>('overview')
  const [bundle, setBundle] = useState<AuthorAnalyticsBundle | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const b = await fetchAuthorAnalytics(authorId, range, true)
    setBundle(b)
    setLoading(false)
  }, [authorId, range])

  useEffect(() => {
    load()
  }, [load])

  const navItems: SubNavItem<SubTabId>[] = useMemo(
    () => [
      { id: 'overview', label: 'Overview', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
      {
        id: 'content',
        label: 'Content',
        icon: <BookOpen className="h-3.5 w-3.5" />,
        badge: bundle?.storyCount ?? undefined,
      },
      { id: 'audience', label: 'Audience', icon: <Users className="h-3.5 w-3.5" /> },
    ],
    [bundle?.storyCount]
  )

  // Empty state: author has no stories at all
  if (!loading && bundle && bundle.storyCount === 0) {
    return (
      <div className="space-y-6">
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-heading text-foreground mb-2">No analytics yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto text-sm">
            Publish your first story to start seeing reader engagement data here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-foreground text-base font-medium">Analytics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {bundle
              ? `Performance across ${bundle.storyCount} ${bundle.storyCount === 1 ? 'story' : 'stories'} — ${rangeLabel(range)}`
              : 'Loading performance data…'}
          </p>
        </div>

        <PeriodSelector value={range} onChange={setRange} />
      </div>

      {/* Live pulse */}
      <LivePulse authorId={authorId} />

      {/* Sub-nav */}
      <div className="flex justify-start">
        <SubNav items={navItems} value={subTab} onChange={setSubTab} />
      </div>

      {/* Sub-view content */}
      <div className={cn('transition-opacity duration-200')}>
        {subTab === 'overview' && (
          <OverviewView bundle={bundle} range={range} loading={loading} />
        )}
        {subTab === 'content' && <ContentView bundle={bundle} loading={loading} />}
        {subTab === 'audience' && <AudienceView bundle={bundle} loading={loading} />}
      </div>
    </div>
  )
}
