'use client'

import { useMemo } from 'react'
import {
  AreaChart as RechartsArea,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'

interface AreaChartProps {
  data: Array<Record<string, any>>
  xKey: string
  yKeys: { key: string; label: string; color: string }[]
  title: string
  subtitle?: string
  height?: number
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2 !border-border/30 shadow-lg">
      <p className="text-xs font-medium text-foreground mb-1">
        {new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function AnalyticsAreaChart({ data, xKey, yKeys, title, subtitle, height = 280 }: AreaChartProps) {
  const chartColors = useMemo(() => {
    const map: Record<string, string> = {
      primary: 'hsl(9, 100%, 63%)',
      success: 'hsl(119, 75%, 38%)',
      secondary: 'hsl(45, 84%, 52%)',
      blue: 'hsl(210, 100%, 56%)',
      purple: 'hsl(270, 70%, 60%)',
    }
    return yKeys.map(k => ({
      ...k,
      resolved: map[k.color] || k.color,
    }))
  }, [yKeys])

  return (
    <div className="glass-card p-5 animate-chart-in">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <RechartsArea
          data={data}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
        >
          <defs>
            {chartColors.map((c, i) => (
              <linearGradient key={i} id={`gradient-${c.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.resolved} stopOpacity={0.3} />
                <stop offset="95%" stopColor={c.resolved} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(0, 0%, 50%)"
            strokeOpacity={0.1}
            vertical={false}
          />

          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 10, fill: 'hsl(0, 0%, 55%)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            interval="preserveStartEnd"
            minTickGap={40}
          />

          <YAxis
            tick={{ fontSize: 10, fill: 'hsl(0, 0%, 55%)' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />

          <Tooltip content={<CustomTooltip />} />

          {chartColors.map((c) => (
            <Area
              key={c.key}
              type="monotone"
              dataKey={c.key}
              name={c.label}
              stroke={c.resolved}
              strokeWidth={2}
              fill={`url(#gradient-${c.key})`}
              dot={false}
              activeDot={{ r: 4, fill: c.resolved, stroke: 'hsl(var(--card))', strokeWidth: 2 }}
            />
          ))}
        </RechartsArea>
      </ResponsiveContainer>
    </div>
  )
}
