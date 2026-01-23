'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme/theme-provider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={cn(
        "h-8 w-8",
        "hover:bg-accent/50",
        "transition-colors",
        "text-muted-foreground hover:text-foreground"
      )}
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </Button>
  )
}
