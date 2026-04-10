'use client'

import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompact, formatPercent } from '@/lib/formatters'
import type { DomainStat } from '@/lib/analytics/dashboard-types'

interface DomainBreakdownProps {
  data: DomainStat[]
  title?: string
  subtitle?: string
  className?: string
  /** Max rows to show. Default 10. */
  limit?: number
}

/**
 * Ranked domain list with views bar + completion rate badge.
 * Each row is a publisher embedding your story on their site.
 */
export function DomainBreakdown({
  data,
  title = 'Traffic sources',
  subtitle = 'Publisher sites embedding your stories',
  className,
  limit = 10,
}: DomainBreakdownProps) {
  const totalViews = data.reduce((sum, d) => sum + d.views, 0)
  const max = Math.max(...data.map((d) => d.views), 1)
  const rows = data.slice(0, limit)

  if (!data.length || totalViews === 0) {
    return (
      <div className={cn('glass-card p-5 animate-chart-in', className)}>
        <div className="mb-4">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="py-8 text-center text-xs text-muted-foreground">
          No traffic source data yet.
        </div>
      </div>
    )
  }

  return (
    <div className={cn('glass-card p-5 animate-chart-in', className)}>
      <div className="mb-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => {
          const sharePct = totalViews > 0 ? (row.views / totalViews) * 100 : 0
          const barPct = (row.views / max) * 100
          const completionColor =
            row.completionRate >= 0.6
              ? 'text-success'
              : row.completionRate >= 0.3
                ? 'text-secondary'
                : 'text-muted-foreground'
          const favicon =
            row.domain !== 'direct'
              ? `https://www.google.com/s2/favicons?domain=${row.domain}&sz=32`
              : null
          return (
            <div key={`${row.domain}-${i}`} className="group">
              <div className="flex items-center gap-3 mb-1.5">
                {favicon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={favicon}
                    alt=""
                    className="w-4 h-4 rounded-sm flex-shrink-0"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-xs font-medium text-foreground truncate flex-1 min-w-0">
                  {row.domain === 'direct' ? 'Direct / app' : row.domain}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
                  {formatPercent(sharePct, 0)}
                </span>
                <span className="text-xs font-semibold text-foreground tabular-nums flex-shrink-0 w-12 text-right">
                  {formatCompact(row.views)}
                </span>
              </div>
              <div className="relative h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/70 to-primary rounded-full transition-all duration-700"
                  style={{ width: `${barPct}%` }}
                />
              </div>
              {row.uniqueViewers > 0 && (
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[9px] text-muted-foreground">
                    {formatCompact(row.uniqueViewers)} unique
                  </span>
                  {row.completions > 0 && (
                    <span className={cn('text-[9px] font-medium', completionColor)}>
                      {formatPercent(row.completionRate * 100, 0)} completion
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {data.length > limit && (
        <p className="mt-4 pt-3 border-t border-border/30 text-[10px] text-muted-foreground text-center">
          +{data.length - limit} more{' '}
          {data.length - limit === 1 ? 'source' : 'sources'} not shown
        </p>
      )}
    </div>
  )
}
