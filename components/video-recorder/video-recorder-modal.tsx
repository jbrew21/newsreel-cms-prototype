'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { RotateCcw, Check, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useMediaRecorder } from '@/hooks/use-media-recorder'
import { useVideoCompositor, type BackgroundConfig } from '@/hooks/use-video-compositor'
import { cn } from '@/lib/utils'

interface VideoRecorderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  background: BackgroundConfig
  onRecordingComplete: (file: File) => void
  maxDuration?: number
}

export function VideoRecorderModal({
  open,
  onOpenChange,
  background,
  onRecordingComplete,
  maxDuration = 60,
}: VideoRecorderModalProps) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'recording' | 'preview'>('loading')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const webcamStreamRef = useRef<MediaStream | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const initRef = useRef(false)

  const isDirectMode = background.type === 'none'

  const { canvasRef, videoElementRef, start, stop, getOutputStream } = useVideoCompositor({
    width: 720,
    height: 1280,
  })

  const {
    state: recorderState,
    elapsedSeconds,
    startRecording,
    stopRecording,
    getBlob,
    reset: resetRecorder,
  } = useMediaRecorder({ maxDuration })

  useEffect(() => {
    if (!open) {
      initRef.current = false
      return
    }
    if (initRef.current) return
    initRef.current = true

    let cancelled = false

    const init = async () => {
      setPhase('loading')
      setCameraError(null)

      // Wait a tick so DOM renders the canvas/video elements before we use refs
      await new Promise(r => requestAnimationFrame(r))

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 720 },
            height: { ideal: 1280 },
          },
          audio: true,
        })

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        webcamStreamRef.current = stream
        await start(stream, background)
        setPhase('ready')
      } catch (err: any) {
        if (!cancelled) {
          setCameraError(
            err.name === 'NotAllowedError'
              ? 'Camera permission denied. Please allow camera access in your browser settings.'
              : `Could not access camera: ${err.message || 'Unknown error'}`
          )
        }
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const cleanup = useCallback(() => {
    stop()
    resetRecorder()
    webcamStreamRef.current?.getTracks().forEach(t => t.stop())
    webcamStreamRef.current = null
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPhase('loading')
    initRef.current = false
  }, [stop, resetRecorder, previewUrl])

  const handleClose = useCallback(() => {
    cleanup()
    onOpenChange(false)
  }, [cleanup, onOpenChange])

  const handleStartRecording = useCallback(() => {
    let recordStream: MediaStream | null = null

    if (isDirectMode) {
      recordStream = webcamStreamRef.current
    } else {
      const canvasStream = getOutputStream(30)
      if (!canvasStream || !webcamStreamRef.current) return

      const audioTracks = webcamStreamRef.current.getAudioTracks()
      recordStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracks,
      ])
    }

    if (!recordStream) return
    startRecording(recordStream)
    setPhase('recording')
  }, [isDirectMode, getOutputStream, startRecording])

  const handleStopRecording = useCallback(() => {
    stopRecording()
  }, [stopRecording])

  useEffect(() => {
    if (recorderState === 'stopped' && phase === 'recording') {
      const timer = setTimeout(() => {
        const blob = getBlob()
        if (blob) {
          const url = URL.createObjectURL(blob)
          setPreviewUrl(url)
          setPhase('preview')
        }
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [recorderState, phase, getBlob])

  const handleRetake = useCallback(async () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    resetRecorder()
    setPhase('loading')
    initRef.current = false

    await new Promise(r => requestAnimationFrame(r))

    try {
      webcamStreamRef.current?.getTracks().forEach(t => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      })
      webcamStreamRef.current = stream
      await start(stream, background)
      setPhase('ready')
    } catch {
      setCameraError('Could not restart camera.')
    }
  }, [previewUrl, resetRecorder, start, background])

  const handleConfirm = useCallback(() => {
    const blob = getBlob()
    if (!blob) return

    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
    const file = new File([blob], `author-video-${Date.now()}.${ext}`, { type: blob.type })

    onRecordingComplete(file)
    cleanup()
    onOpenChange(false)
  }, [getBlob, onRecordingComplete, cleanup, onOpenChange])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const showPreview = phase === 'ready' || phase === 'recording'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden bg-black border-border">
        <DialogHeader className="sr-only">
          <DialogTitle>Record Video</DialogTitle>
          <DialogDescription>Record a video from your camera</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center">
          {/* Camera Error */}
          {cameraError && (
            <div className="p-6 text-center">
              <p className="text-white/90 text-sm mb-4">{cameraError}</p>
              <Button variant="outline" size="sm" onClick={handleClose}>
                Close
              </Button>
            </div>
          )}

          {/* Loading overlay */}
          {phase === 'loading' && !cameraError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
              <p className="text-white/60 text-xs">
                {!isDirectMode ? 'Loading camera & background model...' : 'Starting camera...'}
              </p>
            </div>
          )}

          {/* Timer bar */}
          {showPreview && (
            <div className="w-full px-3 pt-3 pb-1 flex items-center justify-center">
              <div className={cn(
                'px-3 py-1 rounded-full text-xs font-mono text-white',
                phase === 'recording' ? 'bg-red-600' : 'bg-white/10'
              )}>
                {formatTime(elapsedSeconds)} / {formatTime(maxDuration)}
              </div>
            </div>
          )}

          {/*
            CRITICAL: Canvas and Video must ALWAYS be in the DOM so refs
            are attached before start() is called. We hide them with CSS
            when not needed (loading/preview phases).
          */}
          <div className={cn(
            'w-full px-3',
            phase === 'preview' && 'hidden',
            phase === 'loading' && 'invisible h-0 overflow-hidden',
          )}>
            <div
              className="w-full rounded-xl overflow-hidden bg-neutral-900 relative"
              style={{ aspectRatio: '9/16' }}
            >
              {/* Direct mode: <video> with raw camera feed (flipped for selfie) */}
              <video
                ref={videoElementRef as any}
                className={cn(
                  'w-full h-full object-cover',
                  !isDirectMode && 'hidden'
                )}
                style={{ transform: 'scaleX(-1)' }}
                autoPlay
                muted
                playsInline
              />

              {/* Canvas mode: composited background + person */}
              <canvas
                ref={canvasRef}
                className={cn(
                  'w-full h-full',
                  isDirectMode && 'hidden'
                )}
              />
            </div>
          </div>

          {/* Record / Stop button */}
          {showPreview && (
            <div className="py-4 flex items-center justify-center">
              {phase === 'ready' ? (
                <button
                  type="button"
                  onClick={handleStartRecording}
                  className="w-14 h-14 rounded-full border-[3px] border-white flex items-center justify-center hover:scale-105 transition-transform"
                  aria-label="Start recording"
                >
                  <div className="w-10 h-10 rounded-full bg-red-500" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="w-14 h-14 rounded-full border-[3px] border-white flex items-center justify-center hover:scale-105 transition-transform animate-pulse"
                  aria-label="Stop recording"
                >
                  <div className="w-5 h-5 rounded-sm bg-red-500" />
                </button>
              )}
            </div>
          )}

          {/* Preview Phase */}
          {phase === 'preview' && previewUrl && (
            <>
              <div className="w-full px-3 pt-3">
                <div
                  className="w-full rounded-xl overflow-hidden bg-neutral-900"
                  style={{ aspectRatio: '9/16' }}
                >
                  <video
                    ref={previewVideoRef}
                    src={previewUrl}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                </div>
              </div>

              <div className="py-4 flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetake}
                  className="bg-transparent border-white/30 text-white hover:bg-white/10"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Retake
                </Button>
                <Button size="sm" onClick={handleConfirm}>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Use Video
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
