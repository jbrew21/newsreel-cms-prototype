'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export interface SubNavItem<T extends string> {
  id: T
  label: string
  icon?: ReactNode
  badge?: string | number
}

interface SubNavProps<T extends string> {
  items: SubNavItem<T>[]
  value: T
  onChange: (id: T) => void
  className?: string
}

export function SubNav<T extends string>({ items, value, onChange, className }: SubNavProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/50 overflow-x-auto scrollbar-hide',
        className
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = value === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap',
              active
                ? 'bg-card text-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
            )}
            role="tab"
            aria-selected={active}
          >
            {item.icon && <span className={cn('flex-shrink-0', active ? 'text-primary' : '')}>{item.icon}</span>}
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={cn(
                  'ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md',
                  active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
