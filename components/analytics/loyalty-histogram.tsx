'use client'

import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompact, formatPercent } from '@/lib/formatters'
import type { LoyaltyBucket } from '@/lib/analytics/dashboard-types'

interface LoyaltyHistogramProps {
  data: LoyaltyBucket[]
  title?: string
  subtitle?: string
  className?: string
}

const BUCKET_COLORS = [
  'hsl(0, 0%, 55%)', // one-off reader
  'hsl(45, 84%, 52%)', // engaged
  'hsl(9, 100%, 63%)', // superfan
]

export function LoyaltyHistogram({
  data,
  title = 'Reader loyalty',
  subtitle = 'How often unique readers return to your content',
  className,
}: LoyaltyHistogramProps) {
  const total = data.reduce((a, b) => a + b.count, 0)
  const max = Math.max(...data.map((b) => b.count), 1)

  const superfans = data.find((b) => b.label.startsWith('6'))?.count ?? 0
  const engaged = data.find((b) => b.label.startsWith('2'))?.count ?? 0
  const loyaltyScore = total > 0 ? ((engaged + superfans) / total) * 100 : 0

  return (
    <div className={cn('glass-card p-5 animate-chart-in', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Heart className="h-3.5 w-3.5 text-muted-foreground" />
            {title}
          </h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {total > 0 && (
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Loyalty</p>
            <p className="text-sm font-semibold text-foreground">
              {formatPercent(loyaltyScore, 0)}
            </p>
          </div>
        )}
      </div>

      {total === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No reader data yet for this period.
        </div>
      ) : (
        <>
          <div className="flex items-end gap-3 h-36 mb-4">
            {data.map((bucket, i) => {
              const color = BUCKET_COLORS[i] || BUCKET_COLORS[0]
              const heightPct = (bucket.count / max) * 100
              return (
                <div key={bucket.label} className="flex-1 flex flex-col items-center justify-end">
                  <span className="text-[10px] font-medium text-foreground mb-1 tabular-nums">
                    {formatCompact(bucket.count)}
                  </span>
                  <div
                    className="w-full rounded-t-md transition-all duration-700"
                    style={{
                      height: `${Math.max(4, heightPct)}%`,
                      background: `linear-gradient(to top, ${color}50, ${color})`,
                    }}
                  />
                </div>
              )
            })}
          </div>

          <div className="flex gap-3">
            {data.map((bucket, i) => (
              <div key={bucket.label} className="flex-1 text-center">
                <p className="text-[10px] text-muted-foreground">{bucket.label}</p>
                <p className="text-[11px] font-medium text-foreground">
                  {formatPercent(bucket.pct * 100, 0)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
