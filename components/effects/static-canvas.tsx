'use client'

import { useEffect, useRef } from 'react'

export function StaticCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let imageData: ImageData | null = null

    const resize = () => {
      canvas.width = Math.ceil(window.innerWidth / 3)
      canvas.height = Math.ceil(window.innerHeight / 3)
      imageData = ctx.createImageData(canvas.width, canvas.height)
    }

    let resizeTimeout: ReturnType<typeof setTimeout>
    const debouncedResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(resize, 150)
    }

    resize()
    window.addEventListener('resize', debouncedResize)

    const draw = () => {
      if (!ctx || !imageData) {
        animationId = requestAnimationFrame(draw)
        return
      }

      const w = canvas.width
      const h = canvas.height
      const data = imageData.data

      const elapsed = Date.now() / 1000

      // Center clear zone — fixed, no expanding, always stays clear
      const cx = w * 0.5
      const cy = h * 0.5
      const clearRadiusX = 0.35 // horizontal clear radius (normalized)
      const clearRadiusY = 0.45 // vertical clear radius (normalized)
      const edgeSoftness = 0.25

      // VHS tracking glitch — 3% chance per frame
      const hasGlitch = Math.random() > 0.97
      const glitchY = hasGlitch ? Math.floor(Math.random() * h) : -1
      const glitchHeight = hasGlitch ? Math.floor(Math.random() * 8) + 2 : 0
      const glitchOffset = hasGlitch ? Math.floor(Math.random() * 20) - 10 : 0

      for (let y = 0; y < h; y++) {
        // Flickering scanline bands
        const scanline = (Math.sin(y * 0.5 + elapsed * 4) + 1) * 0.5
        const bandIntensity = scanline * 0.3 + 0.7

        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4

          // Elliptical distance from center (covers headline + login area)
          const dx = (x - cx) / (w * clearRadiusX)
          const dy = (y - cy) / (h * clearRadiusY)
          const dist = Math.sqrt(dx * dx + dy * dy)

          // Static only at edges — center is always clear
          let staticIntensity = 0
          if (dist > 1.0) {
            staticIntensity = Math.min((dist - 1.0) / edgeSoftness, 1)
          }

          if (staticIntensity === 0) {
            data[i] = 0
            data[i + 1] = 0
            data[i + 2] = 0
            data[i + 3] = 0
            continue
          }

          // Random noise — warm red/amber tint
          const noise = Math.random() * 255
          let r = noise * 1.1
          let g = noise * 0.95
          let b = noise * 0.85

          // Scanline band modulation
          r *= bandIntensity
          g *= bandIntensity
          b *= bandIntensity

          // VHS tracking glitch — shift pixels horizontally
          if (hasGlitch && y >= glitchY && y < glitchY + glitchHeight) {
            const glitchNoise = Math.random() * 255
            r = glitchNoise * 1.3
            g = glitchNoise * 0.8
            b = glitchNoise * 0.7
          }

          const alpha = staticIntensity * 255

          data[i] = Math.min(255, r)
          data[i + 1] = Math.min(255, g)
          data[i + 2] = Math.min(255, b)
          data[i + 3] = alpha
        }
      }

      ctx.putImageData(imageData, 0, 0)
      animationId = requestAnimationFrame(draw)
    }

    animationId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', debouncedResize)
      clearTimeout(resizeTimeout)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{
        width: '100vw',
        height: '100vh',
        zIndex: 1,
        opacity: 0.15,
      }}
    />
  )
}
