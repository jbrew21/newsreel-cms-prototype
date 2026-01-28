'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/theme/theme-provider'

interface LogoProps {
  width?: number
  height?: number
  className?: string
  priority?: boolean
}

export function Logo({ width = 80, height = 80, className, priority = false }: LogoProps) {
  const { theme } = useTheme()
  const logoSrc = theme === 'dark' ? '/logo/newsreel-dark.png' : '/logo/newsreel-light.png'

  return (
    <div className={cn("relative", className)}>
      <Image
        src={logoSrc}
        alt="NewsReel Logo"
        width={width}
        height={height}
        className="object-contain"
        priority={priority}
      />
    </div>
  )
}
