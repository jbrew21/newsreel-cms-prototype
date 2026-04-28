'use client'

const MEMORY_CACHE = new Map<string, string>()
const IN_FLIGHT = new Map<string, Promise<string | null>>()
const STORAGE_PREFIX = 'vt:'
const SEEK_SECONDS = 1
const MAX_WIDTH = 480
const JPEG_QUALITY = 0.72

function readSessionCache(url: string): string | null {
  try {
    if (typeof window === 'undefined') return null
    return window.sessionStorage.getItem(STORAGE_PREFIX + url)
  } catch {
    return null
  }
}

function writeSessionCache(url: string, dataUrl: string): void {
  try {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(STORAGE_PREFIX + url, dataUrl)
  } catch {
    // Quota exceeded or storage disabled — silently ignore, memory cache still works.
  }
}

function extract(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null)
      return
    }

    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    video.src = url

    let settled = false
    const cleanup = () => {
      video.removeAttribute('src')
      try { video.load() } catch {}
    }
    const finish = (result: string | null) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }

    const timeout = window.setTimeout(() => finish(null), 8000)

    video.addEventListener('loadedmetadata', () => {
      const target = Math.min(SEEK_SECONDS, Math.max(0, (video.duration || 0) - 0.1))
      try {
        video.currentTime = isFinite(target) && target > 0 ? target : 0
      } catch {
        finish(null)
      }
    })

    video.addEventListener('seeked', () => {
      try {
        const w = video.videoWidth
        const h = video.videoHeight
        if (!w || !h) {
          finish(null)
          return
        }
        const scale = Math.min(1, MAX_WIDTH / w)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(w * scale)
        canvas.height = Math.round(h * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          finish(null)
          return
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
        window.clearTimeout(timeout)
        finish(dataUrl.startsWith('data:image/jpeg') ? dataUrl : null)
      } catch {
        window.clearTimeout(timeout)
        finish(null)
      }
    })

    video.addEventListener('error', () => {
      window.clearTimeout(timeout)
      finish(null)
    })
  })
}

export async function getVideoThumbnail(url: string | undefined | null): Promise<string | null> {
  if (!url) return null
  const cached = MEMORY_CACHE.get(url)
  if (cached) return cached
  const stored = readSessionCache(url)
  if (stored) {
    MEMORY_CACHE.set(url, stored)
    return stored
  }
  const inFlight = IN_FLIGHT.get(url)
  if (inFlight) return inFlight

  const promise = extract(url).then((result) => {
    if (result) {
      MEMORY_CACHE.set(url, result)
      writeSessionCache(url, result)
    }
    IN_FLIGHT.delete(url)
    return result
  })
  IN_FLIGHT.set(url, promise)
  return promise
}
