'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { getInitialTheme, applyTheme, saveTheme, type Theme } from '@/lib/theme'

type ThemeContextType = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const initialTheme = getInitialTheme()
    setTheme(initialTheme)
    applyTheme(initialTheme)
  }, [])

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme)
    saveTheme(newTheme)
    applyTheme(newTheme)
  }

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    handleSetTheme(newTheme)
  }

  // Always provide context, even before mount to prevent errors
  // Use default 'light' theme during SSR
  const contextValue = {
    theme: mounted ? theme : 'light',
    setTheme: handleSetTheme,
    toggleTheme,
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
