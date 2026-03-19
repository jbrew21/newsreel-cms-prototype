'use client'

import { useRef, useState, useCallback } from 'react'

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped'

interface UseMediaRecorderOptions {
  /** Max recording duration in seconds. Default: 60 */
  maxDuration?: number
  /** Video MIME type. Default: 'video/webm;codecs=vp9' */
  mimeType?: string
  /** Timeslice for ondataavailable in ms. Default: 100 */
  timeslice?: number
}

interface UseMediaRecorderReturn {
  state: RecordingState
  elapsedSeconds: number
  startRecording: (stream: MediaStream) => void
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  getBlob: () => Blob | null
  reset: () => void
}

export function useMediaRecorder(options: UseMediaRecorderOptions = {}): UseMediaRecorderReturn {
  const {
    maxDuration = 60,
    mimeType = getSupportedMimeType(),
    timeslice = 100,
  } = options

  const [state, setState] = useState<RecordingState>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const blobRef = useRef<Blob | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startRecording = useCallback((stream: MediaStream) => {
    chunksRef.current = []
    blobRef.current = null
    setElapsedSeconds(0)

    const recorder = new MediaRecorder(stream, { mimeType })
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data)
      }
    }

    recorder.onstop = () => {
      clearTimer()
      const blob = new Blob(chunksRef.current, { type: mimeType })
      blobRef.current = blob
      setState('stopped')
    }

    recorder.start(timeslice)
    setState('recording')
    startTimeRef.current = Date.now()

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setElapsedSeconds(elapsed)
      if (elapsed >= maxDuration) {
        recorder.stop()
      }
    }, 500)
  }, [mimeType, timeslice, maxDuration, clearTimer])

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    clearTimer()
  }, [clearTimer])

  const pauseRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause()
      clearTimer()
      setState('paused')
    }
  }, [clearTimer])

  const resumeRecording = useCallback(() => {
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume()
      setState('recording')
      // Adjust start time to account for pause
      const alreadyElapsed = elapsedSeconds * 1000
      startTimeRef.current = Date.now() - alreadyElapsed
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setElapsedSeconds(elapsed)
        if (elapsed >= maxDuration) {
          recorderRef.current?.stop()
        }
      }, 500)
    }
  }, [elapsedSeconds, maxDuration])

  const getBlob = useCallback(() => blobRef.current, [])

  const reset = useCallback(() => {
    stopRecording()
    chunksRef.current = []
    blobRef.current = null
    setElapsedSeconds(0)
    setState('idle')
  }, [stopRecording])

  return {
    state,
    elapsedSeconds,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    getBlob,
    reset,
  }
}

function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ]
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return 'video/webm'
}
