'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatPercent } from '@/lib/formatters'
import type { RetentionPoint } from '@/lib/analytics/dashboard-types'

interface RetentionCurveProps {
  data: RetentionPoint[]
  title?: string
  subtitle?: string
  height?: number
  className?: string
  /** When true, shows a thinner version without the card wrapper (for nesting inside other cards). */
  unwrapped?: boolean
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="glass-card px-3 py-2 !border-border/30 shadow-lg">
      <p className="text-xs font-medium text-foreground mb-0.5">Slide {d.slideIndex + 1}</p>
      <div className="text-xs text-muted-foreground">
        <span className="text-foreground font-medium tabular-nums">{d.reached.toLocaleString()}</span>{' '}
        sessions reached
      </div>
      <div className="text-xs text-muted-foreground">
        <span className="text-foreground font-medium tabular-nums">
          {formatPercent(d.retentionPct * 100, 0)}
        </span>{' '}
        retention
      </div>
    </div>
  )
}

export function RetentionCurve({
  data,
  title = 'Retention curve',
  subtitle = 'Percent of readers who reached each slide',
  height = 260,
  className,
  unwrapped = false,
}: RetentionCurveProps) {
  const shaped = useMemo(
    () =>
      data.map((d) => ({
        slideIndex: d.slideIndex,
        label: `S${d.slideIndex + 1}`,
        reached: d.reached,
        retentionPct: d.retentionPct,
        pct: Math.round(d.retentionPct * 100),
      })),
    [data]
  )

  if (!shaped.length) {
    const empty = (
      <div className="py-12 text-center text-xs text-muted-foreground">
        No slide-level data yet.
      </div>
    )
    if (unwrapped) return empty
    return (
      <div className={cn('glass-card p-5 animate-chart-in', className)}>
        <div className="mb-4">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {empty}
      </div>
    )
  }

  // Dropoff point — largest gap between adjacent slides
  let dropoffIdx = -1
  let maxDrop = 0
  for (let i = 1; i < shaped.length; i++) {
    const drop = shaped[i - 1].retentionPct - shaped[i].retentionPct
    if (drop > maxDrop) {
      maxDrop = drop
      dropoffIdx = shaped[i].slideIndex
    }
  }

  const chart = (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={shaped} margin={{ top: 6, right: 12, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="retention-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(9, 100%, 63%)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(9, 100%, 63%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 50%)" strokeOpacity={0.1} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'hsl(0, 0%, 55%)' }}
          tickLine={false}
          axisLine={false}
          interval={shaped.length > 12 ? 'preserveStartEnd' : 0}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'hsl(0, 0%, 55%)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${Math.round(v * 100)}%`}
          domain={[0, 1]}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(0, 0%, 50%)', strokeOpacity: 0.2 }} />
        <Area
          type="monotone"
          dataKey="retentionPct"
          stroke="hsl(9, 100%, 63%)"
          strokeWidth={2.5}
          fill="url(#retention-grad)"
          activeDot={{ r: 4, fill: 'hsl(9, 100%, 63%)', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
        />
        {dropoffIdx >= 0 && (
          <ReferenceLine
            x={`S${dropoffIdx + 1}`}
            stroke="hsl(0, 79%, 48%)"
            strokeDasharray="3 3"
            strokeOpacity={0.5}
            label={{
              value: 'biggest drop',
              position: 'insideTop',
              fontSize: 9,
              fill: 'hsl(0, 79%, 48%)',
            }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )

  if (unwrapped) return chart

  return (
    <div className={cn('glass-card p-5 animate-chart-in', className)}>
      <div className="mb-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {chart}
    </div>
  )
}
