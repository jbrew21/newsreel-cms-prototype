/**
 * Theme utilities for consistent theme handling across the application
 */

export type Theme = 'light' | 'dark'

/**
 * Get the current theme from localStorage or system preference
 */
export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const savedTheme = localStorage.getItem('theme') as Theme | null
  if (savedTheme) {
    return savedTheme
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

/**
 * Apply theme to the document
 */
export function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') {
    return
  }

  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

/**
 * Save theme preference to localStorage
 */
export function saveTheme(theme: Theme) {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem('theme', theme)
}
