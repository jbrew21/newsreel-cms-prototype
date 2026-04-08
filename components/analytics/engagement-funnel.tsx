'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { formatCompact, formatPercent } from '@/lib/formatters'
import type { FunnelStep } from '@/lib/analytics/dashboard-types'

interface EngagementFunnelProps {
  steps: FunnelStep[]
  title?: string
  subtitle?: string
  className?: string
}

/**
 * Horizontal funnel with animated bars showing step-by-step retention.
 * Each step bar width is relative to the FIRST step (opens = 100%).
 * Shows conversion rate between adjacent steps on hover.
 */
export function EngagementFunnel({
  steps,
  title = 'Engagement funnel',
  subtitle = 'Where readers drop off in their journey',
  className,
}: EngagementFunnelProps) {
  const data = useMemo(() => {
    if (!steps.length) return []
    const first = steps[0].value || 1
    return steps.map((step, i) => {
      const prev = i > 0 ? steps[i - 1].value : first
      const stepConversion = i > 0 && prev > 0 ? step.value / prev : 1
      const fromStart = step.value / first
      return {
        ...step,
        fromStart,
        stepConversion,
        isDropoff: i > 0 && stepConversion < 0.5,
      }
    })
  }, [steps])

  if (!data.length || data[0].value === 0) {
    return (
      <div className={cn('glass-card p-5 animate-chart-in', className)}>
        <div className="mb-4">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="py-8 text-center text-xs text-muted-foreground">
          Not enough data yet. Share your story to see the funnel.
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

      <div className="space-y-2.5">
        {data.map((step, i) => (
          <div key={step.label} className="group">
            <div className="flex items-center justify-between mb-1 text-[11px]">
              <span className="text-muted-foreground font-medium">{step.label}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-foreground font-medium">
                  {formatCompact(step.value)}
                </span>
                <span className="text-muted-foreground/70 tabular-nums w-10 text-right">
                  {formatPercent(step.fromStart * 100, 0)}
                </span>
              </div>
            </div>
            <div className="relative h-6 rounded-md bg-muted/30 overflow-hidden">
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded-md transition-all duration-700 ease-out flex items-center justify-end pr-2',
                  step.isDropoff
                    ? 'bg-gradient-to-r from-destructive/30 to-destructive/60'
                    : 'bg-gradient-to-r from-primary/40 to-primary/80'
                )}
                style={{
                  width: `${Math.max(2, step.fromStart * 100)}%`,
                  animationDelay: `${i * 80}ms`,
                }}
              >
                {i > 0 && step.fromStart > 0.15 && (
                  <span className="text-[10px] font-medium text-primary-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatPercent(step.stepConversion * 100, 0)} of prev
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary callout */}
      {data.length >= 2 && data[0].value > 0 && (
        <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Overall completion rate</span>
          <span className="font-semibold text-foreground">
            {formatPercent((data[data.length - 2]?.fromStart ?? 0) * 100, 0)}
          </span>
        </div>
      )}
    </div>
  )
}
