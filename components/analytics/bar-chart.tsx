'use client'

import { useMemo } from 'react'
import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface BarChartProps {
  data: Array<{ name: string; value: number; label?: string }>
  title: string
  subtitle?: string
  color?: string
  height?: number
  layout?: 'vertical' | 'horizontal'
  showGradient?: boolean
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="glass-card px-3 py-2 !border-border/30 shadow-lg">
      <p className="text-xs font-medium text-foreground mb-0.5">{d.payload.name}</p>
      <p className="text-xs text-muted-foreground">
        {d.payload.label || d.name}: <span className="font-medium text-foreground">{d.value}</span>
      </p>
    </div>
  )
}

export function AnalyticsBarChart({
  data,
  title,
  subtitle,
  color = 'primary',
  height = 280,
  layout = 'horizontal',
  showGradient = true,
}: BarChartProps) {
  const resolvedColor = useMemo(() => {
    const map: Record<string, string> = {
      primary: 'hsl(9, 100%, 63%)',
      success: 'hsl(119, 75%, 38%)',
      secondary: 'hsl(45, 84%, 52%)',
      blue: 'hsl(210, 100%, 56%)',
      purple: 'hsl(270, 70%, 60%)',
    }
    return map[color] || color
  }, [color])

  const maxVal = Math.max(...data.map(d => d.value), 1)

  return (
    <div className="glass-card p-5 animate-chart-in">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <RechartsBar
          data={data}
          layout={layout === 'vertical' ? 'vertical' : 'horizontal'}
          margin={layout === 'vertical' ? { top: 4, right: 4, left: 0, bottom: 0 } : { top: 4, right: 4, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`bar-gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={resolvedColor} stopOpacity={0.9} />
              <stop offset="100%" stopColor={resolvedColor} stopOpacity={0.4} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(0, 0%, 50%)"
            strokeOpacity={0.1}
            vertical={layout !== 'vertical'}
            horizontal={layout === 'vertical' || true}
          />

          {layout === 'vertical' ? (
            <>
              <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(0, 0%, 55%)' }} tickLine={false} axisLine={false} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 10, fill: 'hsl(0, 0%, 55%)' }}
                tickLine={false}
                axisLine={false}
                width={120}
                tickFormatter={(v) => v.length > 18 ? v.slice(0, 18) + '...' : v}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'hsl(0, 0%, 55%)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + '...' : v}
              />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(0, 0%, 55%)' }} tickLine={false} axisLine={false} allowDecimals={false} />
            </>
          )}

          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(0, 0%, 50%)', fillOpacity: 0.06 }} />

          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={showGradient ? `url(#bar-gradient-${color})` : resolvedColor}
                fillOpacity={showGradient ? 1 : 0.3 + (entry.value / maxVal) * 0.7}
              />
            ))}
          </Bar>
        </RechartsBar>
      </ResponsiveContainer>
    </div>
  )
}
