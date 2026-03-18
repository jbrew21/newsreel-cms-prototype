'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'

interface DonutChartProps {
  data: Array<{ name: string; value: number; color: string }>
  title: string
  subtitle?: string
  centerValue?: string
  centerLabel?: string
  height?: number
}

const COLOR_MAP: Record<string, string> = {
  primary: 'hsl(9, 100%, 63%)',
  success: 'hsl(119, 75%, 38%)',
  secondary: 'hsl(45, 84%, 52%)',
  blue: 'hsl(210, 100%, 56%)',
  purple: 'hsl(270, 70%, 60%)',
  cyan: 'hsl(185, 80%, 50%)',
  pink: 'hsl(330, 80%, 60%)',
  orange: 'hsl(30, 90%, 55%)',
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="glass-card px-3 py-2 !border-border/30 shadow-lg">
      <div className="flex items-center gap-2 text-xs">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.payload.resolvedColor }} />
        <span className="text-muted-foreground">{d.name}:</span>
        <span className="font-medium text-foreground">{d.value}</span>
      </div>
    </div>
  )
}

export function AnalyticsDonutChart({
  data,
  title,
  subtitle,
  centerValue,
  centerLabel,
  height = 220,
}: DonutChartProps) {
  const resolvedData = useMemo(() =>
    data.map(d => ({
      ...d,
      resolvedColor: COLOR_MAP[d.color] || d.color,
    })), [data])

  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="glass-card p-5 animate-chart-in">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-6">
        <div className="relative" style={{ width: height, height }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={resolvedData}
                cx="50%"
                cy="50%"
                innerRadius="65%"
                outerRadius="90%"
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {resolvedData.map((entry, i) => (
                  <Cell key={i} fill={entry.resolvedColor} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {(centerValue || centerLabel) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {centerValue && (
                <span className="text-xl font-semibold text-foreground">{centerValue}</span>
              )}
              {centerLabel && (
                <span className="text-[10px] text-muted-foreground">{centerLabel}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2">
          {resolvedData.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.resolvedColor }} />
                <span className="text-muted-foreground truncate max-w-[120px]">{item.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{item.value.toLocaleString()}</span>
                <span className="text-muted-foreground/60 w-10 text-right">
                  {total > 0 ? Math.round((item.value / total) * 100) : 0}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
