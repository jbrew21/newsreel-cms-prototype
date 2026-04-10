'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDurationShort } from '@/lib/formatters'
import type { SlideTimePoint } from '@/lib/analytics/dashboard-types'

interface TimePerSlideProps {
  data: SlideTimePoint[]
  title?: string
  subtitle?: string
  height?: number
  className?: string
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="glass-card px-3 py-2 !border-border/30 shadow-lg">
      <p className="text-xs font-medium text-foreground mb-0.5">Slide {d.slideIndex + 1}</p>
      <p className="text-xs text-muted-foreground">
        Avg time:{' '}
        <span className="text-foreground font-medium">{formatDurationShort(d.avgMs)}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Views:{' '}
        <span className="text-foreground font-medium tabular-nums">{d.views.toLocaleString()}</span>
      </p>
    </div>
  )
}

export function TimePerSlide({
  data,
  title = 'Time spent per slide',
  subtitle = 'Average reading time on each slide',
  height = 220,
  className,
}: TimePerSlideProps) {
  const shaped = useMemo(
    () =>
      data.map((d) => ({
        slideIndex: d.slideIndex,
        label: `S${d.slideIndex + 1}`,
        avgSec: d.avgMs / 1000,
        avgMs: d.avgMs,
        views: d.views,
      })),
    [data]
  )

  const avgOverall = useMemo(() => {
    if (!shaped.length) return 0
    const total = shaped.reduce((sum, s) => sum + s.avgMs, 0)
    return total / shaped.length
  }, [shaped])

  if (!shaped.length) {
    return (
      <div className={cn('glass-card p-5 animate-chart-in', className)}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {title}
            </h3>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="py-8 text-center text-xs text-muted-foreground">
          No reading time data yet.
        </div>
      </div>
    )
  }

  return (
    <div className={cn('glass-card p-5 animate-chart-in', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {title}
          </h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg slide</p>
          <p className="text-xs font-semibold text-foreground tabular-nums">
            {formatDurationShort(avgOverall)}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={shaped} margin={{ top: 6, right: 12, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="tps-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(45, 84%, 52%)" stopOpacity={0.95} />
              <stop offset="100%" stopColor="hsl(45, 84%, 52%)" stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 50%)" strokeOpacity={0.1} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'hsl(0, 0%, 55%)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'hsl(0, 0%, 55%)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${Math.round(v)}s`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(0, 0%, 50%)', fillOpacity: 0.06 }} />
          <Bar dataKey="avgSec" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {shaped.map((entry, i) => (
              <Cell key={i} fill="url(#tps-grad)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
