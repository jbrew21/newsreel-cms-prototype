'use client'

import { cn } from '@/lib/utils'
import type { PeriodRange } from '@/lib/analytics/dashboard-types'

interface PeriodSelectorProps {
  value: PeriodRange
  onChange: (range: PeriodRange) => void
  className?: string
}

const RANGES: { value: PeriodRange; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
]

export function PeriodSelector({ value, onChange, className }: PeriodSelectorProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border/50',
        className
      )}
      role="tablist"
      aria-label="Time range"
    >
      {RANGES.map((range) => (
        <button
          key={range.value}
          type="button"
          onClick={() => onChange(range.value)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
            value === range.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          role="tab"
          aria-selected={value === range.value}
        >
          {range.label}
        </button>
      ))}
    </div>
  )
}

export function rangeLabel(range: PeriodRange): string {
  switch (range) {
    case '7d':
      return 'last 7 days'
    case '30d':
      return 'last 30 days'
    case '90d':
      return 'last 90 days'
    case 'all':
      return 'all time'
  }
}
