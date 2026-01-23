import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  width?: number
  height?: number
  className?: string
  priority?: boolean
}

export function Logo({ width = 80, height = 80, className, priority = false }: LogoProps) {
  return (
    <div className={cn("relative", className)}>
      <Image
        src="/logo/newsreel-main.png"
        alt="NewsReel Logo"
        width={width}
        height={height}
        className="object-contain"
        priority={priority}
      />
    </div>
  )
}
