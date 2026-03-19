'use client'

import { useRef, useCallback, useEffect } from 'react'

export type BackgroundConfig =
  | { type: 'image'; src: string }
  | { type: 'color'; color: string }
  | { type: 'video'; src: string }
  | { type: 'none' }

interface UseVideoCompositorOptions {
  width?: number
  height?: number
}

interface UseVideoCompositorReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>
  videoElementRef: React.RefObject<HTMLVideoElement>
  start: (webcamStream: MediaStream, background: BackgroundConfig) => Promise<void>
  stop: () => void
  getOutputStream: (fps?: number) => MediaStream | null
  isDirectMode: boolean
}

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation'

let cdnLoadPromise: Promise<void> | null = null
function loadMediaPipeCDN(): Promise<void> {
  if ((window as any).SelfieSegmentation) return Promise.resolve()
  if (cdnLoadPromise) return cdnLoadPromise

  cdnLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${CDN_BASE}/selfie_segmentation.js`
    script.crossOrigin = 'anonymous'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load MediaPipe from CDN'))
    document.head.appendChild(script)
  })
  return cdnLoadPromise
}

export function useVideoCompositor(options: UseVideoCompositorOptions = {}): UseVideoCompositorReturn {
  const { width = 720, height = 1280 } = options

  const canvasRef = useRef<HTMLCanvasElement>(null!)
  const videoElementRef = useRef<HTMLVideoElement>(null!)
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  const bgVideoRef = useRef<HTMLVideoElement | null>(null)
  const bgConfigRef = useRef<BackgroundConfig>({ type: 'none' })
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null)
  const rafRef = useRef<number>(0)
  const activeRef = useRef(false)
  const directModeRef = useRef(false)

  useEffect(() => {
    return () => {
      activeRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      bgVideoRef.current?.pause()
    }
  }, [])

  const loadBackground = useCallback(async (bg: BackgroundConfig) => {
    bgConfigRef.current = bg
    bgImageRef.current = null
    bgVideoRef.current?.pause()
    bgVideoRef.current = null

    if (bg.type === 'image') {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
        img.src = bg.src
      })
      bgImageRef.current = img
    } else if (bg.type === 'video') {
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.loop = true
      video.muted = true
      video.playsInline = true
      video.src = bg.src
      await video.play()
      bgVideoRef.current = video
    }
  }, [])

  const drawBackground = useCallback((ctx: CanvasRenderingContext2D) => {
    const bg = bgConfigRef.current
    if (bg.type === 'color') {
      ctx.fillStyle = bg.color
      ctx.fillRect(0, 0, width, height)
    } else if (bg.type === 'image' && bgImageRef.current) {
      drawCoverFit(ctx, bgImageRef.current, width, height)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.fillRect(0, 0, width, height)
    } else if (bg.type === 'video' && bgVideoRef.current) {
      drawCoverFit(ctx, bgVideoRef.current, width, height)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.fillRect(0, 0, width, height)
    } else {
      ctx.fillStyle = '#18181b'
      ctx.fillRect(0, 0, width, height)
    }
  }, [width, height])

  const start = useCallback(async (webcamStream: MediaStream, background: BackgroundConfig) => {
    activeRef.current = true

    if (background.type === 'none') {
      directModeRef.current = true
      const videoEl = videoElementRef.current
      if (videoEl) {
        videoEl.srcObject = webcamStream
        videoEl.muted = true
        videoEl.playsInline = true
        await videoEl.play()
      }
      return
    }

    directModeRef.current = false
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    const video = document.createElement('video')
    video.srcObject = webcamStream
    video.playsInline = true
    video.muted = true
    await video.play()
    hiddenVideoRef.current = video

    await loadBackground(background)

    try {
      await loadMediaPipeCDN()
    } catch (err) {
      console.warn('MediaPipe failed to load, falling back to background-only:', err)
      const fallbackLoop = () => {
        if (!activeRef.current) return
        ctx.clearRect(0, 0, width, height)
        drawBackground(ctx)
        rafRef.current = requestAnimationFrame(fallbackLoop)
      }
      rafRef.current = requestAnimationFrame(fallbackLoop)
      return
    }

    const SelfieSegmentationClass = (window as any).SelfieSegmentation
    if (!SelfieSegmentationClass) {
      console.warn('SelfieSegmentation not found on window, falling back')
      const fallbackLoop = () => {
        if (!activeRef.current) return
        ctx.clearRect(0, 0, width, height)
        drawBackground(ctx)
        rafRef.current = requestAnimationFrame(fallbackLoop)
      }
      rafRef.current = requestAnimationFrame(fallbackLoop)
      return
    }

    const segmenter = new SelfieSegmentationClass({
      locateFile: (file: string) => `${CDN_BASE}/${file}`,
    })
    segmenter.setOptions({ modelSelection: 1, selfieMode: true })

    segmenter.onResults((results: any) => {
      if (!activeRef.current) return

      ctx.clearRect(0, 0, width, height)

      // Draw background first
      drawBackground(ctx)

      // Use MediaPipe's processed image with alpha masking
      const mask = results.segmentationMask
      if (mask) {
        // Create temp canvas for the person image
        const tmp = document.createElement('canvas')
        tmp.width = width
        tmp.height = height
        const tmpCtx = tmp.getContext('2d')!

        // Draw MediaPipe's processed image to temp canvas
        tmpCtx.drawImage(results.image, 0, 0, width, height)
        const tmpData = tmpCtx.getImageData(0, 0, width, height)

        // Create mask canvas to extract mask pixel data
        const maskCanvas = document.createElement('canvas')
        maskCanvas.width = width
        maskCanvas.height = height
        const maskCtx = maskCanvas.getContext('2d')!
        maskCtx.drawImage(mask, 0, 0, width, height)
        const maskData = maskCtx.getImageData(0, 0, width, height)

        // Apply mask as alpha channel with threshold (binary mask removes soft edges)
        for (let i = 0; i < tmpData.data.length; i += 4) {
          const maskValue = maskData.data[i] // R channel of mask
          // Binary threshold: only fully opaque (255) or fully transparent (0), no semi-transparent edges
          tmpData.data[i + 3] = maskValue > 127 ? 255 : 0
        }
        tmpCtx.putImageData(tmpData, 0, 0)

        // Draw masked person on top of background
        ctx.drawImage(tmp, 0, 0)
      }
    })

    await segmenter.initialize()

    const renderLoop = async () => {
      if (!activeRef.current) return
      try {
        await segmenter.send({ image: video })
      } catch {
        // Skip failed frames
      }
      if (activeRef.current) {
        rafRef.current = requestAnimationFrame(renderLoop)
      }
    }
    rafRef.current = requestAnimationFrame(renderLoop)
  }, [width, height, loadBackground, drawBackground])

  const stop = useCallback(() => {
    activeRef.current = false
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    hiddenVideoRef.current?.pause()
    if (hiddenVideoRef.current) hiddenVideoRef.current.srcObject = null
    hiddenVideoRef.current = null
    if (videoElementRef.current) {
      videoElementRef.current.pause()
      videoElementRef.current.srcObject = null
    }
    bgVideoRef.current?.pause()
    bgVideoRef.current = null
    directModeRef.current = false
  }, [])

  const getOutputStream = useCallback((fps?: number): MediaStream | null => {
    if (directModeRef.current) {
      return videoElementRef.current?.srcObject as MediaStream | null
    }
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.captureStream(fps ?? 30)
  }, [])

  return {
    canvasRef,
    videoElementRef,
    start,
    stop,
    getOutputStream,
    isDirectMode: directModeRef.current,
  }
}

function drawCoverFit(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  canvasW: number,
  canvasH: number
) {
  const srcW = (source as HTMLVideoElement).videoWidth || (source as HTMLImageElement).naturalWidth || canvasW
  const srcH = (source as HTMLVideoElement).videoHeight || (source as HTMLImageElement).naturalHeight || canvasH
  const scale = Math.max(canvasW / srcW, canvasH / srcH)
  const drawW = srcW * scale
  const drawH = srcH * scale
  const offsetX = (canvasW - drawW) / 2
  const offsetY = (canvasH - drawH) / 2
  ctx.drawImage(source, offsetX, offsetY, drawW, drawH)
}
