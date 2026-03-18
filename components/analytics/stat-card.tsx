'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: number
  suffix?: string
  prefix?: string
  icon: React.ReactNode
  color: 'primary' | 'success' | 'secondary' | 'accent'
  delay?: number
}

const colorMap = {
  primary: {
    glow: 'bg-primary/30',
    icon: 'text-primary',
    iconBg: 'bg-primary/10 dark:bg-primary/15',
    value: 'text-foreground',
  },
  success: {
    glow: 'bg-success/30',
    icon: 'text-success',
    iconBg: 'bg-success/10 dark:bg-success/15',
    value: 'text-foreground',
  },
  secondary: {
    glow: 'bg-secondary/30',
    icon: 'text-secondary dark:text-secondary',
    iconBg: 'bg-secondary/10 dark:bg-secondary/15',
    value: 'text-foreground',
  },
  accent: {
    glow: 'bg-blue-500/30',
    icon: 'text-blue-500',
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/15',
    value: 'text-foreground',
  },
}

export function StatCard({ label, value, suffix = '', prefix = '', icon, color, delay = 0 }: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const colors = colorMap[color]

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  useEffect(() => {
    if (!visible || value === 0) return

    const duration = 800
    const steps = 30
    const increment = value / steps
    let current = 0
    let step = 0

    const interval = setInterval(() => {
      step++
      current = Math.min(value, Math.round(increment * step * 10) / 10)
      setDisplayValue(current)
      if (step >= steps) {
        setDisplayValue(value)
        clearInterval(interval)
      }
    }, duration / steps)

    return () => clearInterval(interval)
  }, [visible, value])

  const formattedValue = suffix === '%'
    ? displayValue.toFixed(1)
    : displayValue >= 1000
      ? `${(displayValue / 1000).toFixed(1)}k`
      : Math.round(displayValue).toLocaleString()

  return (
    <div
      ref={ref}
      className={cn(
        'glass-card p-5 transition-all duration-500',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
    >
      <div className={cn('stat-glow -top-4 -right-4', colors.glow)} />

      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', colors.iconBg)}>
          <span className={colors.icon}>{icon}</span>
        </div>
      </div>

      <div className="animate-count-up">
        <p className={cn('text-2xl font-semibold tracking-tight', colors.value)}>
          {prefix}{formattedValue}{suffix}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  )
}
