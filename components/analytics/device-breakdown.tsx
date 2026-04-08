'use client'

import { Smartphone, Tablet, Monitor, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompact, formatPercent } from '@/lib/formatters'
import type { DeviceStat } from '@/lib/analytics/dashboard-types'

interface DeviceBreakdownProps {
  data: DeviceStat[]
  title?: string
  subtitle?: string
  className?: string
}

const DEVICE_META: Record<string, { icon: typeof Smartphone; label: string; color: string }> = {
  mobile: { icon: Smartphone, label: 'Mobile', color: 'hsl(9, 100%, 63%)' },
  tablet: { icon: Tablet, label: 'Tablet', color: 'hsl(45, 84%, 52%)' },
  desktop: { icon: Monitor, label: 'Desktop', color: 'hsl(210, 100%, 56%)' },
  unknown: { icon: Globe, label: 'Other', color: 'hsl(0, 0%, 55%)' },
}

export function DeviceBreakdown({
  data,
  title = 'Device mix',
  subtitle = 'How your readers are accessing stories',
  className,
}: DeviceBreakdownProps) {
  const total = data.reduce((a, b) => a + b.views, 0)

  if (total === 0) {
    return (
      <div className={cn('glass-card p-5 animate-chart-in', className)}>
        <div className="mb-4">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="py-8 text-center text-xs text-muted-foreground">No device data yet.</div>
      </div>
    )
  }

  // Build stacked horizontal bar
  let accLeft = 0
  const segments = data
    .filter((d) => d.views > 0)
    .map((d) => {
      const meta = DEVICE_META[d.deviceType.toLowerCase()] || DEVICE_META.unknown
      const width = (d.views / total) * 100
      const left = accLeft
      accLeft += width
      return { ...d, meta, width, left }
    })

  return (
    <div className={cn('glass-card p-5 animate-chart-in', className)}>
      <div className="mb-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      {/* Stacked bar */}
      <div className="relative h-3 rounded-full bg-muted/30 overflow-hidden mb-5">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 transition-all duration-700"
            style={{
              left: `${seg.left}%`,
              width: `${seg.width}%`,
              backgroundColor: seg.meta.color,
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-1 gap-2">
        {segments.map((seg, i) => {
          const Icon = seg.meta.icon
          return (
            <div
              key={i}
              className="flex items-center justify-between gap-3 py-1.5 border-b border-border/20 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${seg.meta.color}20` }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: seg.meta.color }} />
                </div>
                <span className="text-xs font-medium text-foreground capitalize">{seg.meta.label}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatCompact(seg.views)}
                </span>
                <span className="text-xs font-semibold text-foreground tabular-nums w-10 text-right">
                  {formatPercent(seg.pct * 100, 0)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
