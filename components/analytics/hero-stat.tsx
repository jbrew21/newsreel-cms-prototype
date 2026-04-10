'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompact, formatPercent, percentDelta } from '@/lib/formatters'

export type HeroColor = 'primary' | 'success' | 'secondary' | 'accent' | 'purple' | 'blue'

interface HeroStatProps {
  label: string
  /** The raw current value. `format` decides how to render it. */
  value: number
  /** Optional previous-period value for delta computation. */
  previousValue?: number | null
  /** Render format: 'number' | 'percent' | 'ratio' (0..1) | 'duration-ms' */
  format?: 'number' | 'percent' | 'ratio' | 'duration-ms'
  /** Optional prefix (e.g. '$') or suffix (e.g. ' readers') */
  suffix?: string
  /** Sub-label under the number */
  hint?: string
  icon?: ReactNode
  color?: HeroColor
  /** Optional tiny trend sparkline data. */
  sparkline?: number[]
  /** Stagger index for entrance animation. */
  index?: number
  /** When true, higher numbers are GOOD (green trend up). When false (like dropoff), inverted. */
  goodIsUp?: boolean
}

const COLOR_CLASSES: Record<HeroColor, { glow: string; icon: string; iconBg: string; spark: string }> = {
  primary: {
    glow: 'bg-primary/30',
    icon: 'text-primary',
    iconBg: 'bg-primary/10 dark:bg-primary/15',
    spark: 'hsl(9, 100%, 63%)',
  },
  success: {
    glow: 'bg-success/30',
    icon: 'text-success',
    iconBg: 'bg-success/10 dark:bg-success/15',
    spark: 'hsl(119, 75%, 38%)',
  },
  secondary: {
    glow: 'bg-secondary/30',
    icon: 'text-secondary',
    iconBg: 'bg-secondary/10 dark:bg-secondary/15',
    spark: 'hsl(45, 84%, 52%)',
  },
  accent: {
    glow: 'bg-blue-500/30',
    icon: 'text-blue-500',
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/15',
    spark: 'hsl(210, 100%, 56%)',
  },
  purple: {
    glow: 'bg-purple-500/30',
    icon: 'text-purple-500',
    iconBg: 'bg-purple-500/10 dark:bg-purple-500/15',
    spark: 'hsl(270, 70%, 60%)',
  },
  blue: {
    glow: 'bg-blue-500/30',
    icon: 'text-blue-500',
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/15',
    spark: 'hsl(210, 100%, 56%)',
  },
}

function formatValue(value: number, fmt: NonNullable<HeroStatProps['format']>): string {
  switch (fmt) {
    case 'percent':
      return formatPercent(value, value >= 10 ? 0 : 1)
    case 'ratio':
      return formatPercent(value * 100, value >= 0.1 ? 0 : 1)
    case 'duration-ms': {
      if (!Number.isFinite(value) || value <= 0) return '—'
      const totalSeconds = Math.round(value / 1000)
      if (totalSeconds < 60) return `${totalSeconds}s`
      const m = Math.floor(totalSeconds / 60)
      const s = totalSeconds % 60
      if (m < 60) return s === 0 ? `${m}m` : `${m}m ${s}s`
      const h = Math.floor(m / 60)
      const rem = m % 60
      return rem === 0 ? `${h}h` : `${h}h ${rem}m`
    }
    case 'number':
    default:
      return formatCompact(value)
  }
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data?.length) return null
  const width = 80
  const height = 24
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const step = data.length > 1 ? width / (data.length - 1) : 0
  const points = data
    .map((v, i) => {
      const x = i * step
      const y = height - ((v - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <defs>
        <linearGradient id={`spark-fill-${color.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`${points} ${width},${height} 0,${height}`}
        fill={`url(#spark-fill-${color.replace(/\W/g, '')})`}
      />
    </svg>
  )
}

export function HeroStat({
  label,
  value,
  previousValue,
  format = 'number',
  suffix = '',
  hint,
  icon,
  color = 'primary',
  sparkline,
  index = 0,
  goodIsUp = true,
}: HeroStatProps) {
  const [visible, setVisible] = useState(false)
  const [animated, setAnimated] = useState(0)
  const rafRef = useRef<number | null>(null)
  const colors = COLOR_CLASSES[color]

  useEffect(() => {
    const delay = index * 80
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [index])

  // Smooth count-up animation
  useEffect(() => {
    if (!visible) return
    const start = performance.now()
    const duration = 900
    const from = 0
    const to = Number.isFinite(value) ? value : 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setAnimated(from + (to - from) * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [visible, value])

  const delta = previousValue != null ? percentDelta(value, previousValue) : null

  const deltaColor =
    delta == null
      ? 'text-muted-foreground'
      : delta === 0
        ? 'text-muted-foreground'
        : (goodIsUp ? delta > 0 : delta < 0)
          ? 'text-success'
          : 'text-destructive'

  const DeltaIcon =
    delta == null ? Minus : delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown

  return (
    <div
      className={cn(
        'glass-card p-5 transition-all duration-500',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
    >
      <div className={cn('stat-glow -top-4 -right-4', colors.glow)} />

      <div className="flex items-start justify-between mb-3">
        {icon && (
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', colors.iconBg)}>
            <span className={colors.icon}>{icon}</span>
          </div>
        )}
        {sparkline && sparkline.length > 1 && (
          <Sparkline data={sparkline} color={colors.spark} />
        )}
      </div>

      <div className="animate-count-up">
        <div className="flex items-baseline gap-1.5">
          <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {formatValue(animated, format)}
          </p>
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
        <div className="flex items-center justify-between mt-1 gap-2">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {delta != null && (
            <div className={cn('flex items-center gap-0.5 text-[11px] font-medium', deltaColor)}>
              <DeltaIcon className="h-3 w-3" />
              <span>{delta === 0 ? '0%' : `${delta > 0 ? '+' : ''}${delta.toFixed(0)}%`}</span>
            </div>
          )}
        </div>
        {hint && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{hint}</p>}
      </div>
    </div>
  )
}
