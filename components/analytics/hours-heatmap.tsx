'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatCompact } from '@/lib/formatters'
import type { HoursHeatmapCell } from '@/lib/analytics/dashboard-types'

interface HoursHeatmapProps {
  cells: HoursHeatmapCell[]
  title?: string
  subtitle?: string
  className?: string
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * 7-row x 24-column heatmap showing when readers are active.
 * Uses the primary color ramp from very-muted to full-primary.
 */
export function HoursHeatmap({
  cells,
  title = 'When your readers are active',
  subtitle = 'Local time, grouped by day-of-week and hour',
  className,
}: HoursHeatmapProps) {
  const [hovered, setHovered] = useState<HoursHeatmapCell | null>(null)

  const { max, grid, peak } = useMemo(() => {
    const max = Math.max(...cells.map((c) => c.views), 1)
    const grid: HoursHeatmapCell[][] = []
    for (let d = 0; d < 7; d++) {
      grid.push(cells.filter((c) => c.dayOfWeek === d).sort((a, b) => a.hour - b.hour))
    }
    // Find peak cell
    let peak: HoursHeatmapCell | null = null
    for (const c of cells) {
      if (!peak || c.views > peak.views) peak = c
    }
    return { max, grid, peak }
  }, [cells])

  const totalViews = cells.reduce((a, b) => a + b.views, 0)

  if (!totalViews) {
    return (
      <div className={cn('glass-card p-5 animate-chart-in', className)}>
        <div className="mb-4">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="py-8 text-center text-xs text-muted-foreground">
          No activity data for this period yet.
        </div>
      </div>
    )
  }

  return (
    <div className={cn('glass-card p-5 animate-chart-in', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {peak && peak.views > 0 && (
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Peak</p>
            <p className="text-xs font-medium text-foreground">
              {DAYS[peak.dayOfWeek]} {formatHour(peak.hour)}
            </p>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Hour labels */}
          <div className="flex gap-0.5 ml-10 mb-1">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="w-[14px] text-[8px] text-muted-foreground text-center"
                style={{ minWidth: 14 }}
              >
                {h % 3 === 0 ? h : ''}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="space-y-0.5">
            {grid.map((row, dayIdx) => (
              <div key={dayIdx} className="flex items-center gap-0.5">
                <div className="w-10 text-[10px] text-muted-foreground text-right pr-2 flex-shrink-0">
                  {DAYS[dayIdx]}
                </div>
                {row.map((cell, hourIdx) => {
                  const intensity = cell.views / max
                  const opacity = cell.views === 0 ? 0.04 : 0.15 + intensity * 0.85
                  return (
                    <div
                      key={hourIdx}
                      className="w-[14px] h-4 rounded-[2px] transition-all duration-150 cursor-pointer hover:ring-2 hover:ring-primary/50"
                      style={{
                        backgroundColor: `hsl(9, 100%, 63%, ${opacity.toFixed(3)})`,
                        minWidth: 14,
                      }}
                      onMouseEnter={() => setHovered(cell)}
                      onMouseLeave={() => setHovered(null)}
                      title={`${DAYS[cell.dayOfWeek]} ${formatHour(cell.hour)} — ${cell.views} views`}
                    />
                  )
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between mt-3 ml-10">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Less</span>
              {[0.08, 0.25, 0.45, 0.65, 0.95].map((opacity, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-[2px]"
                  style={{ backgroundColor: `hsl(9, 100%, 63%, ${opacity})` }}
                />
              ))}
              <span className="text-[10px] text-muted-foreground">More</span>
            </div>
            {hovered && (
              <span className="text-[10px] text-foreground tabular-nums">
                {DAYS[hovered.dayOfWeek]} {formatHour(hovered.hour)} —{' '}
                <span className="font-medium">{formatCompact(hovered.views)} views</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatHour(h: number): string {
  if (h === 0) return '12a'
  if (h === 12) return '12p'
  if (h < 12) return `${h}a`
  return `${h - 12}p`
}
