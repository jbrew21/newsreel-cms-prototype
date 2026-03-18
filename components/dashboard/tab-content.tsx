'use client'

import { useEffect, useState } from 'react'

interface TabContentProps {
  id: string
  active: boolean
  children: React.ReactNode
}

/**
 * Wraps tab content with a smooth fade+slide transition.
 * Only the active tab renders in the DOM.
 */
export function TabContent({ id, active, children }: TabContentProps) {
  const [shouldRender, setShouldRender] = useState(active)
  const [isVisible, setIsVisible] = useState(active)

  useEffect(() => {
    if (active) {
      setShouldRender(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true))
      })
    } else {
      setIsVisible(false)
      const timer = setTimeout(() => setShouldRender(false), 200)
      return () => clearTimeout(timer)
    }
  }, [active])

  if (!shouldRender) return null

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${id}`}
      className="transition-all duration-200 ease-out"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
      }}
    >
      {children}
    </div>
  )
}
