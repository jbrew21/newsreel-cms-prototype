'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  BookOpen,
  Clock,
  Eye,
  Share2,
  Target,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatCompact,
  formatDurationShort,
  formatPercent,
  formatRelativeTime,
} from '@/lib/formatters'
import type { StoryPerformance } from '@/lib/analytics/dashboard-types'

interface PerformanceTableProps {
  data: StoryPerformance[]
  title?: string
  subtitle?: string
  className?: string
  /** When true, rows become clickable and navigate to per-story analytics. */
  linkToDetail?: boolean
  /** Optional search/filter input shown above the table. */
  showSearch?: boolean
}

type SortKey = 'views' | 'completionRate' | 'avgReadMs' | 'shares' | 'headline'

const COLUMNS: {
  key: SortKey
  label: string
  icon: typeof Eye
  align: 'left' | 'right'
}[] = [
  { key: 'headline', label: 'Story', icon: BookOpen, align: 'left' },
  { key: 'views', label: 'Views', icon: Eye, align: 'right' },
  { key: 'completionRate', label: 'Completion', icon: Target, align: 'right' },
  { key: 'avgReadMs', label: 'Avg time', icon: Clock, align: 'right' },
  { key: 'shares', label: 'Shares', icon: Share2, align: 'right' },
]

function completionTone(rate: number): string {
  if (rate >= 0.7) return 'text-success'
  if (rate >= 0.4) return 'text-secondary'
  return 'text-muted-foreground'
}

export function PerformanceTable({
  data,
  title = 'Story performance',
  subtitle = 'Click any story to open its detailed analytics',
  className,
  linkToDetail = true,
  showSearch = false,
}: PerformanceTableProps) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<SortKey>('views')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')

  const sorted = useMemo(() => {
    const filtered = search.trim()
      ? data.filter((s) =>
          (s.headline ?? '').toLowerCase().includes(search.toLowerCase().trim())
        )
      : data
    const rows = [...filtered]
    rows.sort((a, b) => {
      let va: any = a[sortKey]
      let vb: any = b[sortKey]
      if (sortKey === 'headline') {
        va = (a.headline ?? '').toLowerCase()
        vb = (b.headline ?? '').toLowerCase()
      }
      if (va == null) va = sortKey === 'headline' ? '' : 0
      if (vb == null) vb = sortKey === 'headline' ? '' : 0
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return rows
  }, [data, sortKey, sortDir, search])

  const maxViews = Math.max(...data.map((d) => d.views), 1)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'headline' ? 'asc' : 'desc')
    }
  }

  const handleRowClick = (storyId: string) => {
    if (linkToDetail) {
      router.push(`/dashboard/story/${storyId}/analytics`)
    }
  }

  if (!data.length) {
    return (
      <div className={cn('glass-card p-12 text-center animate-chart-in', className)}>
        <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-medium text-foreground mb-1">No story data yet</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Publish your first story to see per-story metrics here.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('glass-card p-5 animate-chart-in', className)}>
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {showSearch && (
          <input
            type="text"
            placeholder="Search stories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-muted/30 border border-border/40 rounded-md px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 w-48"
          />
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50">
              {COLUMNS.map((col) => {
                const Icon = col.icon
                const isActive = sortKey === col.key
                return (
                  <th
                    key={col.key}
                    className={cn(
                      'py-2 font-medium text-muted-foreground',
                      col.align === 'right' ? 'text-right pl-3' : 'text-left pr-4'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className={cn(
                        'flex items-center gap-1 hover:text-foreground transition-colors',
                        col.align === 'right' ? 'justify-end ml-auto' : '',
                        isActive ? 'text-foreground' : ''
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{col.label}</span>
                      {isActive ? (
                        sortDir === 'desc' ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUp className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </button>
                  </th>
                )
              })}
              {linkToDetail && <th className="w-6" />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((story) => {
              const barWidth = maxViews > 0 ? (story.views / maxViews) * 100 : 0
              return (
                <tr
                  key={story.storyId}
                  className={cn(
                    'border-b border-border/20 last:border-0 group transition-colors',
                    linkToDetail && 'cursor-pointer hover:bg-muted/10'
                  )}
                  onClick={() => handleRowClick(story.storyId)}
                >
                  <td className="py-3 pr-4">
                    <div className="max-w-[320px]">
                      <p className="text-foreground font-medium truncate group-hover:text-primary transition-colors">
                        {story.headline || 'Untitled'}
                      </p>
                      <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-700"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      {story.lastSeenAt && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          Last read {formatRelativeTime(story.lastSeenAt)}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <span className="text-foreground font-medium tabular-nums">
                      {formatCompact(story.views)}
                    </span>
                    {story.uniqueViewers > 0 && (
                      <p className="text-[9px] text-muted-foreground">
                        {formatCompact(story.uniqueViewers)} unique
                      </p>
                    )}
                  </td>
                  <td className="py-3 pl-3 text-right">
                    {story.views > 0 ? (
                      <span className={cn('font-medium tabular-nums', completionTone(story.completionRate))}>
                        {formatPercent(story.completionRate * 100, 0)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="py-3 pl-3 text-right">
                    {story.avgReadMs > 0 ? (
                      <span className="text-foreground font-medium tabular-nums">
                        {formatDurationShort(story.avgReadMs)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="py-3 pl-3 text-right">
                    {story.shares > 0 ? (
                      <span className="text-foreground font-medium tabular-nums">
                        {formatCompact(story.shares)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  {linkToDetail && (
                    <td className="py-3 text-muted-foreground/50 group-hover:text-primary transition-colors">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </td>
                  )}
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + (linkToDetail ? 1 : 0)} className="py-8 text-center text-muted-foreground">
                  No stories match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
