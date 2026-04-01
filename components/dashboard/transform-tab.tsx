'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Link2, ArrowRight, RotateCcw, Pencil, Image as ImageIcon, Type, BarChart3, Check, ChevronLeft, ChevronRight, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MobileSlidePreviewRenderer } from '@/components/preview/mobile-slide-preview'
import type { CmsStory, CmsSlide } from '@/components/preview/mobile-slide-preview'
import { MediaPickerModal } from '@/components/media-picker-modal'
import { MediaSearchModal } from '@/components/media-search-modal'
import { BackgroundSelectorModal } from '@/components/video-recorder/background-selector-modal'
import { VideoRecorderModal } from '@/components/video-recorder/video-recorder-modal'
import type { BackgroundConfig } from '@/hooks/use-video-compositor'
import type { MediaItem } from '@/lib/media-search/types'
import dynamic from 'next/dynamic'

const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

// ─── Types for Claude's transform response ──────────────────────────────────

interface TransformSlide {
  subheadline: string
  content: string
  image_query: string
  gif_query: string
}

interface TransformQuiz {
  question: string
  answers: { a: string; b: string; c: string; d: string }
  correct_answer: string
}

interface TransformPoll {
  question: string
  options: string[]
}

interface TransformStory {
  story_headline: string
  subhead: string
  source_name: string
  source_url: string
  slides: TransformSlide[]
  quiz?: TransformQuiz
  guess?: { question: string; options: string[] }
  poll?: TransformPoll
}

// ─── Media search helper ────────────────────────────────────────────────────

interface MediaResult {
  url: string
  thumbnail: string
  source: string
  mediaType: 'image' | 'video'
}

async function fetchSlideMedia(
  gifQuery: string,
  imageQuery: string,
  excludeUrls: Set<string>,
): Promise<MediaResult | null> {
  // Priority 1: Try GIF query first (GIFs are most engaging)
  try {
    const gifRes = await fetch(`/api/media-search?q=${encodeURIComponent(gifQuery)}&type=image`)
    if (gifRes.ok) {
      const data = await gifRes.json()
      const results: MediaResult[] = data.results || []
      // Prefer giphy source, then any result
      const gif = results.find((r) => r.source === 'giphy' && !excludeUrls.has(r.url))
        ?? results.find((r) => !excludeUrls.has(r.url))
      if (gif) return gif
    }
  } catch { /* fall through */ }

  // Priority 2: Try image query
  try {
    const imgRes = await fetch(`/api/media-search?q=${encodeURIComponent(imageQuery)}&type=image`)
    if (imgRes.ok) {
      const data = await imgRes.json()
      const results: MediaResult[] = data.results || []
      const img = results.find((r) => !excludeUrls.has(r.url))
      if (img) return img
    }
  } catch { /* fall through */ }

  return null
}

// ─── Convert transform response → CmsStory ─────────────────────────────────

function transformToCmsStory(
  story: TransformStory,
  slideMedia: Map<number, MediaResult>,
  coverMedia: MediaResult | null,
): CmsStory {
  return {
    id: 'transform-preview',
    story_headline: story.story_headline,
    subhead: story.subhead || null,
    story_media_source: story.source_name || null,
    partner_name: story.source_name || null,
    partner_article_link: story.source_url || null,
    cover: coverMedia
      ? { url: coverMedia.url, media_type: coverMedia.mediaType === 'video' ? 'video' : 'image' }
      : null,
    authors: [],
    slides: story.slides.map((slide, i) => ({
      id: `transform-slide-${i}`,
      slide_index: i,
      slide_headline_1: slide.subheadline,
      slide_content_1: slide.content,
      slide_headline_2: null,
      slide_content_2: null,
      slide_quote: null,
      slide_media_source: null,
      portrait_video: false,
      media: slideMedia.has(i)
        ? [{ url: slideMedia.get(i)!.url, media_type: slideMedia.get(i)!.mediaType, role: 'hero' }]
        : [],
      captions: null,
    })),
    quiz: story.quiz
      ? {
          id: 'transform-quiz',
          question: story.quiz.question,
          answer_a: story.quiz.answers.a,
          answer_b: story.quiz.answers.b || null,
          answer_c: story.quiz.answers.c || null,
          answer_d: story.quiz.answers.d || null,
        }
      : null,
    poll: story.poll
      ? {
          id: 'transform-poll',
          question: story.poll.question,
          econ_weight: null,
          social_weight: null,
          importance: null,
        }
      : null,
  }
}

// ─── Loading messages ───────────────────────────────────────────────────────

const LOADING_MESSAGES = [
  { text: 'Fetching your article...', sub: 'Reaching out to grab the content' },
  { text: 'Reading between the lines...', sub: 'Extracting the key details' },
  { text: 'Creating your Newsreel brief...', sub: 'Curating slides that tell the story right' },
  { text: 'Finding the perfect visuals...', sub: 'Picking media that brings each slide to life' },
  { text: 'Polishing it up...', sub: 'Almost ready for you to preview' },
]

// ─── Editable Preview Types ─────────────────────────────────────────────────

type EditableVirtualSlide =
  | { type: 'intro'; key: 'intro' }
  | { type: 'content'; slide: CmsSlide; slideIndex: number; key: string }
  | { type: 'quiz'; key: 'quiz' }
  | { type: 'poll'; key: 'poll' }

function buildVirtualSlides(story: CmsStory): EditableVirtualSlide[] {
  return [
    { type: 'intro', key: 'intro' },
    ...story.slides.map((s, i) => ({ type: 'content' as const, slide: s, slideIndex: i, key: s.id })),
    ...(story.quiz ? [{ type: 'quiz' as const, key: 'quiz' as const }] : []),
    ...(story.poll ? [{ type: 'poll' as const, key: 'poll' as const }] : []),
  ]
}

// ─── Editable Intro Slide ───────────────────────────────────────────────────

function EditableIntroSlide({
  story,
  onUpdateHeadline,
  onUpdateSubhead,
}: {
  story: CmsStory
  onUpdateHeadline: (val: string) => void
  onUpdateSubhead: (val: string) => void
}) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        background: '#000000',
        overflowY: 'auto', overflowX: 'hidden',
        paddingTop: 80, paddingBottom: 48, paddingLeft: 16, paddingRight: 16,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Cover media */}
      {story.cover?.url && (
        <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', marginBottom: 8, flexShrink: 0, position: 'relative' }}>
          {story.cover.media_type === 'video' ? (
            <video src={story.cover.url} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.cover.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
        </div>
      )}

      {/* Source credit */}
      <p style={{ fontSize: 12, color: '#F0F0F0', textAlign: 'center', fontFamily: '"DM Sans",sans-serif', fontWeight: 400, margin: 0, marginBottom: 24, minHeight: 16 }}>
        {story.story_media_source ?? ''}
      </p>

      {/* Editable headline */}
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onUpdateHeadline(e.currentTarget.textContent || '')}
        style={{
          fontSize: 32, lineHeight: '1.25', fontWeight: 700,
          color: '#FFFFFF', textAlign: 'center',
          fontFamily: 'var(--font-playfair),Georgia,"Times New Roman",serif',
          margin: 0, marginBottom: 30,
          border: '2px dashed rgba(255,255,255,0.4)',
          borderRadius: 8, padding: '8px 6px',
          outline: 'none', cursor: 'text',
          minHeight: 44,
        }}
      >
        {story.story_headline}
      </div>

      {/* Editable subhead */}
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onUpdateSubhead(e.currentTarget.textContent || '')}
        style={{
          fontSize: 15, lineHeight: '1.5', color: 'rgba(255,255,255,0.75)',
          textAlign: 'center', fontFamily: '"DM Sans",sans-serif', fontWeight: 400,
          margin: 0, marginBottom: 24,
          border: '2px dashed rgba(255,255,255,0.3)',
          borderRadius: 8, padding: '6px',
          outline: 'none', cursor: 'text',
          minHeight: 30,
        }}
      >
        {story.subhead ?? ''}
      </div>

      {/* Partner */}
      {story.partner_name && (
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#F0F0F0', fontFamily: '"DM Sans",sans-serif' }}>
            Read full story on{' '}
            <span style={{ color: '#FF6343', fontWeight: 700, textDecoration: 'underline' }}>
              {story.partner_name}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Editable Content Slide ─────────────────────────────────────────────────

function EditableContentSlide({
  slide,
  onUpdateHeadline,
  onUpdateBody,
}: {
  slide: CmsSlide
  onUpdateHeadline: (val: string) => void
  onUpdateBody: (val: string) => void
}) {
  const heroMedia = slide.media.find((m) => m.role === 'hero') ?? slide.media[0] ?? null
  const isVideo = heroMedia?.media_type === 'video'
  const hasContent1 = !!slide.slide_content_1
  const headline = hasContent1 ? slide.slide_headline_1 : slide.slide_headline_2
  const body = hasContent1 ? slide.slide_content_1 : slide.slide_content_2

  return (
    <>
      {heroMedia && (
        <>
          {isVideo ? (
            <video src={heroMedia.url} autoPlay loop muted playsInline style={{ position: 'absolute', top: 64, left: 0, width: '100%', height: 'calc(100% - 64px)', objectFit: 'cover', zIndex: 0 }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroMedia.url} alt="" style={{ position: 'absolute', top: 64, left: 0, width: '100%', height: 'calc(100% - 64px)', objectFit: 'cover', zIndex: 0 }} />
          )}
          <div style={{ position: 'absolute', top: 64, left: 0, right: 0, bottom: 0, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.6)', zIndex: 1, pointerEvents: 'none' }} />
        </>
      )}

      {/* Clear media display */}
      {heroMedia && (
        <div style={{ position: 'absolute', top: 130, left: 0, right: 0, zIndex: 5 }}>
          {isVideo ? (
            <video src={heroMedia.url} autoPlay loop muted playsInline style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroMedia.url} alt="" style={{ width: '100%', objectFit: 'contain', display: 'block' }} />
          )}
        </div>
      )}

      {/* Editable chat bubble */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-start', paddingBottom: 80, paddingLeft: 16, paddingRight: 16, zIndex: 10 }}>
        <div style={{ background: 'rgba(30,58,95,0.4)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', borderRadius: 16, padding: 16, maxWidth: '87%', boxShadow: '0 4px 8px rgba(0,0,0,0.4)', marginBottom: 16 }}>
          {headline !== null && headline !== undefined && (
            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => onUpdateHeadline(e.currentTarget.textContent || '')}
              style={{
                fontSize: 20.8, lineHeight: '27.2px', fontWeight: 700, color: '#FFF',
                marginBottom: body ? 16 : 0, fontFamily: '"DM Sans",sans-serif',
                border: '2px dashed rgba(255,255,255,0.4)',
                borderRadius: 6, padding: '4px 6px',
                outline: 'none', cursor: 'text',
                minHeight: 28,
              }}
            >
              {headline}
            </div>
          )}
          {body !== null && body !== undefined && (
            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => onUpdateBody(e.currentTarget.textContent || '')}
              style={{
                fontSize: 16, lineHeight: '21.6px', fontWeight: 400, color: '#FFF',
                fontFamily: '"DM Sans",sans-serif',
                border: '2px dashed rgba(255,255,255,0.3)',
                borderRadius: 6, padding: '4px 6px',
                outline: 'none', cursor: 'text',
                minHeight: 22,
              }}
            >
              {body}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TransformTab() {
  const [url, setUrl] = useState('')
  const [isTransforming, setIsTransforming] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [previewStory, setPreviewStory] = useState<CmsStory | null>(null)
  const [transformedUrl, setTransformedUrl] = useState<string | null>(null)
  const [lottieData, setLottieData] = useState<object | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ─── Edit mode state ────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false)
  const [editSlideIndex, setEditSlideIndex] = useState(0)

  // Media picker / search modal state
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
  const [mediaSearchOpen, setMediaSearchOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Video recording state
  const [bgSelectorOpen, setBgSelectorOpen] = useState(false)
  const [bgSearchOpen, setBgSearchOpen] = useState(false)
  const [recorderOpen, setRecorderOpen] = useState(false)
  const [recorderBackground, setRecorderBackground] = useState<BackgroundConfig>({ type: 'none' })

  useEffect(() => {
    fetch('/animations/Loading.json')
      .then((res) => res.json())
      .then(setLottieData)
      .catch(() => {})
  }, [])

  const handleTransform = useCallback(async () => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return

    // Reset state
    setError(null)
    setPreviewStory(null)
    setIsTransforming(true)
    setLoadingStep(0)

    // Abort any in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // Progress through loading messages
    const interval = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, LOADING_MESSAGES.length - 1))
    }, 4000)

    try {
      // Step 1: Call transform API
      setLoadingStep(0)
      const res = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Transform failed (${res.status})`)
      }

      const { story } = (await res.json()) as { story: TransformStory }
      if (!story?.slides?.length) throw new Error('No story content returned')

      // Step 2: Fetch media for each slide sequentially to avoid duplicates
      setLoadingStep(3)
      const slideMedia = new Map<number, MediaResult>()
      const usedUrls = new Set<string>()

      for (let i = 0; i < story.slides.length; i++) {
        const slide = story.slides[i]
        const result = await fetchSlideMedia(slide.gif_query, slide.image_query, usedUrls)
        if (result) {
          usedUrls.add(result.url)
          slideMedia.set(i, result)
        }
      }

      // Fetch a separate cover image using the headline (distinct from slide media)
      const coverMedia = await fetchSlideMedia(
        story.story_headline,
        story.slides[0]?.image_query || 'news',
        usedUrls,
      )

      // Step 3: Convert to CmsStory and render
      setLoadingStep(4)
      const cmsStory = transformToCmsStory(story, slideMedia, coverMedia)
      setPreviewStory(cmsStory)
      setTransformedUrl(trimmedUrl)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message || 'Something went wrong')
    } finally {
      clearInterval(interval)
      setIsTransforming(false)
    }
  }, [url])

  const handleReset = useCallback(() => {
    abortRef.current?.abort()
    setPreviewStory(null)
    setTransformedUrl(null)
    setError(null)
    setUrl('')
    setIsTransforming(false)
    setIsEditing(false)
    setEditSlideIndex(0)
  }, [])

  // ─── Edit mode helpers ──────────────────────────────────────────────────

  const editVirtualSlides = previewStory ? buildVirtualSlides(previewStory) : []
  const editTotal = editVirtualSlides.length
  const currentEditSlide = editVirtualSlides[editSlideIndex] ?? null

  const updateStory = useCallback((updater: (prev: CmsStory) => CmsStory) => {
    setPreviewStory((prev) => prev ? updater(prev) : prev)
  }, [])

  const handleUpdateHeadline = useCallback((val: string) => {
    updateStory((s) => ({ ...s, story_headline: val }))
  }, [updateStory])

  const handleUpdateSubhead = useCallback((val: string) => {
    updateStory((s) => ({ ...s, subhead: val || null }))
  }, [updateStory])

  const handleUpdateSlideHeadline = useCallback((slideIndex: number, val: string) => {
    updateStory((s) => {
      const slides = [...s.slides]
      const slide = { ...slides[slideIndex] }
      if (slide.slide_content_1) {
        slide.slide_headline_1 = val
      } else {
        slide.slide_headline_2 = val
      }
      slides[slideIndex] = slide
      return { ...s, slides }
    })
  }, [updateStory])

  const handleUpdateSlideBody = useCallback((slideIndex: number, val: string) => {
    updateStory((s) => {
      const slides = [...s.slides]
      const slide = { ...slides[slideIndex] }
      if (slide.slide_content_1) {
        slide.slide_content_1 = val
      } else {
        slide.slide_content_2 = val
      }
      slides[slideIndex] = slide
      return { ...s, slides }
    })
  }, [updateStory])

  const handleMediaSelected = useCallback((item: MediaItem) => {
    if (!currentEditSlide) return
    const mediaType = item.mediaType === 'video' ? 'video' : 'image'

    if (currentEditSlide.type === 'intro') {
      updateStory((s) => ({
        ...s,
        cover: { url: item.url, media_type: mediaType },
      }))
    } else if (currentEditSlide.type === 'content') {
      const idx = currentEditSlide.slideIndex
      updateStory((s) => {
        const slides = [...s.slides]
        slides[idx] = {
          ...slides[idx],
          media: [{ url: item.url, media_type: mediaType, role: 'hero' }],
          portrait_video: false,
        }
        return { ...s, slides }
      })
    }
    setMediaSearchOpen(false)
  }, [currentEditSlide, updateStory])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentEditSlide) return

    const objectUrl = URL.createObjectURL(file)
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image'

    if (currentEditSlide.type === 'intro') {
      updateStory((s) => ({
        ...s,
        cover: { url: objectUrl, media_type: mediaType },
      }))
    } else if (currentEditSlide.type === 'content') {
      const idx = currentEditSlide.slideIndex
      updateStory((s) => {
        const slides = [...s.slides]
        slides[idx] = {
          ...slides[idx],
          media: [{ url: objectUrl, media_type: mediaType, role: 'hero' }],
          portrait_video: false,
        }
        return { ...s, slides }
      })
    }

    // Reset input so the same file can be selected again
    e.target.value = ''
  }, [currentEditSlide, updateStory])

  const handleRecordingComplete = useCallback((file: File) => {
    if (!currentEditSlide) return
    const objectUrl = URL.createObjectURL(file)

    if (currentEditSlide.type === 'intro') {
      updateStory((s) => ({
        ...s,
        cover: { url: objectUrl, media_type: 'video' },
      }))
    } else if (currentEditSlide.type === 'content') {
      const idx = currentEditSlide.slideIndex
      updateStory((s) => {
        const slides = [...s.slides]
        slides[idx] = {
          ...slides[idx],
          media: [{ url: objectUrl, media_type: 'video', role: 'hero' }],
          portrait_video: true,
        }
        return { ...s, slides }
      })
    }
    setRecorderOpen(false)
  }, [currentEditSlide, updateStory])

  const handleBgSelected = useCallback((config: BackgroundConfig) => {
    setRecorderBackground(config)
    setBgSelectorOpen(false)
    setTimeout(() => setRecorderOpen(true), 150)
  }, [])

  const handleBgSearchMedia = useCallback(() => {
    setBgSelectorOpen(false)
    setTimeout(() => setBgSearchOpen(true), 150)
  }, [])

  const handleBgSearchSelect = useCallback((item: MediaItem) => {
    const config: BackgroundConfig = item.mediaType === 'video'
      ? { type: 'video', src: item.url }
      : { type: 'image', src: item.url }
    setRecorderBackground(config)
    setBgSearchOpen(false)
    setTimeout(() => setRecorderOpen(true), 150)
  }, [])

  const handleTryExample = (exampleUrl: string) => {
    setUrl(exampleUrl)
    setPreviewStory(null)
    setTransformedUrl(null)
    setError(null)
  }

  const examples = [
    { label: 'Try: Oberlin Review', url: 'https://oberlinreview.org' },
    { label: 'Try: BBC News', url: 'https://bbc.com/news' },
    { label: 'Try: Wikipedia', url: 'https://wikipedia.org' },
  ]

  const steps = [
    { num: '01', title: 'Paste any URL', desc: 'Any article from any site. News, opinion, features, research — it all works.' },
    { num: '02', title: 'Watch it become interactive', desc: 'Your article gets rebuilt as swipeable slides with photos, quizzes, and animated stats. Same story, totally new format.' },
    { num: '03', title: 'Share it or embed it', desc: 'Your interactive story gets a shareable link instantly. Embed it on your own site or publish it to the Newsreel platform to reach new readers.' },
  ]

  // ─── Loading screen (fullscreen, like the screenshot) ─────────────────────

  if (isTransforming) {
    const msg = LOADING_MESSAGES[loadingStep]
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 px-4">
        <img
          src="/newsreel-logo.svg"
          alt="Newsreel"
          className="h-10 opacity-80"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div className="flex flex-col items-center gap-3 text-center">
          {lottieData && (
            <div className="w-20 h-20">
              <Lottie animationData={lottieData} loop />
            </div>
          )}
          <h2 className="text-xl font-semibold text-foreground">{msg.text}</h2>
          <p className="text-sm text-muted-foreground max-w-md">{msg.sub}</p>
          <p
            className="mt-4 text-xs text-muted-foreground/50 max-w-[300px] truncate"
            style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
          >
            {url}
          </p>
        </div>
      </div>
    )
  }

  // ─── Preview screen (after transform) ─────────────────────────────────────

  if (previewStory) {
    // Non-editing: standard preview
    if (!isEditing) {
      return (
        <div className="flex flex-col items-center py-8 px-4 gap-6">
          {/* Top bar */}
          <div className="w-full max-w-3xl flex items-center justify-between">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Transform another
            </button>
            <div className="flex items-center gap-3">
              {transformedUrl && (
                <p
                  className="text-xs text-muted-foreground/50 max-w-[200px] truncate"
                  style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
                >
                  {transformedUrl}
                </p>
              )}
              <button
                onClick={() => { setIsEditing(true); setEditSlideIndex(0) }}
                className="flex items-center gap-1.5 text-sm font-medium text-foreground border border-border rounded-lg px-3.5 py-1.5 hover:bg-muted transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            </div>
          </div>

          {/* Mobile preview */}
          <MobileSlidePreviewRenderer story={previewStory} />
        </div>
      )
    }

    // ─── Editing mode ───────────────────────────────────────────────────
    const progress = editTotal > 0 ? (editSlideIndex + 1) / editTotal : 0

    return (
      <div className="flex flex-col items-center py-8 px-4 gap-6">
        {/* Top bar */}
        <div className="w-full max-w-3xl flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Transform another
          </button>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm font-medium text-orange-500 bg-orange-500/10 border border-orange-500/30 rounded-lg px-3.5 py-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Editing
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {editSlideIndex + 1} of {editTotal}
            </span>
          </div>
        </div>

        {/* Navigation controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setEditSlideIndex((i) => Math.max(0, i - 1))}
            disabled={editSlideIndex === 0}
            className={cn('flex h-8 w-8 items-center justify-center rounded-full border border-border transition-colors', 'hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30')}
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[80px] text-center text-sm tabular-nums text-muted-foreground">
            Slide {editSlideIndex + 1} of {editTotal}
          </span>
          <button
            onClick={() => setEditSlideIndex((i) => Math.min(editTotal - 1, i + 1))}
            disabled={editSlideIndex === editTotal - 1}
            className={cn('flex h-8 w-8 items-center justify-center rounded-full border border-border transition-colors', 'hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30')}
            aria-label="Next slide"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Phone frame with editable content */}
        <div
          style={{
            width: 375,
            height: 812,
            background: '#000000',
            borderRadius: 44,
            overflow: 'hidden',
            position: 'relative',
            flexShrink: 0,
            boxShadow: '0 0 0 1px rgba(255,255,255,0.08),0 24px 64px rgba(0,0,0,0.45),0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          {/* Progress bar */}
          <div
            style={{
              position: 'absolute', top: 64, left: 0, right: 0,
              height: 7, background: 'rgba(255,255,255,0.2)',
              zIndex: 50, pointerEvents: 'none',
            }}
          >
            <div style={{ height: '100%', width: `${progress * 100}%`, background: '#FFFFFF', transition: 'width 0.25s ease' }} />
          </div>

          {/* Slide content */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            {currentEditSlide?.type === 'intro' && (
              <EditableIntroSlide
                story={previewStory}
                onUpdateHeadline={handleUpdateHeadline}
                onUpdateSubhead={handleUpdateSubhead}
              />
            )}
            {currentEditSlide?.type === 'content' && (
              <EditableContentSlide
                slide={currentEditSlide.slide}
                onUpdateHeadline={(val) => handleUpdateSlideHeadline(currentEditSlide.slideIndex, val)}
                onUpdateBody={(val) => handleUpdateSlideBody(currentEditSlide.slideIndex, val)}
              />
            )}
            {currentEditSlide?.type === 'quiz' && previewStory.quiz && (
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: '#000000',
                  overflowY: 'auto', overflowX: 'hidden',
                  paddingTop: 80, paddingBottom: 80, paddingLeft: 20, paddingRight: 20,
                  display: 'flex', flexDirection: 'column',
                }}
              >
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontFamily: '"DM Sans",sans-serif', marginBottom: 16, marginTop: 0 }}>
                  Quiz
                </p>

                {/* Editable question */}
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const text = e.currentTarget?.textContent || ''
                    updateStory((s) => ({
                      ...s,
                      quiz: s.quiz ? { ...s.quiz, question: text } : s.quiz,
                    }))
                  }}
                  style={{
                    fontSize: 18, lineHeight: '1.55', color: '#F0F0F0', textAlign: 'center',
                    fontFamily: '"DM Sans",sans-serif', fontWeight: 400,
                    marginBottom: 24,
                    border: '2px dashed rgba(255,255,255,0.4)',
                    borderRadius: 8, padding: '8px 6px',
                    outline: 'none', cursor: 'text',
                    minHeight: 30,
                  }}
                >
                  {previewStory.quiz.question}
                </div>

                {/* Editable answers */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(['answer_a', 'answer_b', 'answer_c', 'answer_d'] as const).map((key, i) => {
                    const val = previewStory.quiz![key]
                    if (!val) return null
                    const label = String.fromCharCode(65 + i)
                    return (
                      <div
                        key={key}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          background: '#1F1F1F', border: '1px solid #898989',
                          borderRadius: 12, padding: '12px 14px',
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#FFF', fontFamily: '"DM Sans",sans-serif', flexShrink: 0 }}>
                          {label}.
                        </span>
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const text = e.currentTarget?.textContent || ''
                            updateStory((s) => ({
                              ...s,
                              quiz: s.quiz ? { ...s.quiz, [key]: text } : s.quiz,
                            }))
                          }}
                          style={{
                            flex: 1,
                            fontSize: 14, lineHeight: '1.4', color: '#FFF',
                            fontFamily: '"DM Sans",sans-serif',
                            border: '2px dashed rgba(255,255,255,0.3)',
                            borderRadius: 6, padding: '4px 6px',
                            outline: 'none', cursor: 'text',
                            minHeight: 20,
                          }}
                        >
                          {val}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {currentEditSlide?.type === 'poll' && previewStory.poll && (
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: '#000000',
                  overflowY: 'auto', overflowX: 'hidden',
                  paddingTop: 80, paddingBottom: 80, paddingLeft: 20, paddingRight: 20,
                  display: 'flex', flexDirection: 'column',
                }}
              >
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontFamily: '"DM Sans",sans-serif', marginBottom: 16, marginTop: 0 }}>
                  Poll
                </p>

                {/* "Where do you stand?" label */}
                <p style={{
                  fontSize: 28, lineHeight: '1.2', fontWeight: 700, color: '#FFFFFF', textAlign: 'center',
                  fontFamily: 'var(--font-playfair),Georgia,"Times New Roman",serif',
                  margin: 0, marginBottom: 16,
                }}>
                  Where do you stand?
                </p>

                {/* Editable poll question */}
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const text = e.currentTarget?.textContent || ''
                    updateStory((s) => ({
                      ...s,
                      poll: s.poll ? { ...s.poll, question: text } : s.poll,
                    }))
                  }}
                  style={{
                    fontSize: 16, lineHeight: '1.55', color: '#F0F0F0', textAlign: 'center',
                    fontFamily: '"DM Sans",sans-serif', fontWeight: 400,
                    marginBottom: 28,
                    border: '2px dashed rgba(255,255,255,0.4)',
                    borderRadius: 8, padding: '8px 6px',
                    outline: 'none', cursor: 'text',
                    minHeight: 30,
                  }}
                >
                  {previewStory.poll.question}
                </div>
              </div>
            )}
          </div>

          {/* Bottom toolbar */}
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: 64, zIndex: 60,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-around',
              paddingLeft: 12, paddingRight: 12,
            }}
          >
            {/* Photo */}
            <button
              onClick={() => setMediaPickerOpen(true)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
            >
              <ImageIcon style={{ width: 20, height: 20, color: '#AAA' }} />
              <span style={{ fontSize: 10, color: '#AAA', fontFamily: '"DM Sans",sans-serif' }}>Photo</span>
            </button>

            {/* Text — scroll to text fields */}
            <button
              onClick={() => {
                const el = document.querySelector('[contenteditable="true"]') as HTMLElement | null
                el?.focus()
              }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
            >
              <Type style={{ width: 20, height: 20, color: '#AAA' }} />
              <span style={{ fontSize: 10, color: '#AAA', fontFamily: '"DM Sans",sans-serif' }}>Text</span>
            </button>

            {/* Record */}
            <button
              onClick={() => setBgSelectorOpen(true)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
            >
              <Camera style={{ width: 20, height: 20, color: '#AAA' }} />
              <span style={{ fontSize: 10, color: '#AAA', fontFamily: '"DM Sans",sans-serif' }}>Record</span>
            </button>

            {/* Chart — coming soon */}
            <button
              onClick={() => {}}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'default', padding: '4px 8px', opacity: 0.3 }}
              title="Chart editing coming soon"
            >
              <BarChart3 style={{ width: 20, height: 20, color: '#AAA' }} />
              <span style={{ fontSize: 10, color: '#AAA', fontFamily: '"DM Sans",sans-serif' }}>Chart</span>
            </button>

            {/* Done */}
            <button
              onClick={() => setIsEditing(false)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
            >
              <Check style={{ width: 20, height: 20, color: '#4ADE80' }} />
              <span style={{ fontSize: 10, color: '#4ADE80', fontFamily: '"DM Sans",sans-serif', fontWeight: 600 }}>Done</span>
            </button>
          </div>
        </div>

        {/* Modals — reused from create brief */}
        <MediaPickerModal
          open={mediaPickerOpen}
          onOpenChange={setMediaPickerOpen}
          onSearchClick={() => setMediaSearchOpen(true)}
          onUploadClick={() => fileInputRef.current?.click()}
        />

        <MediaSearchModal
          open={mediaSearchOpen}
          onOpenChange={setMediaSearchOpen}
          onSelectMedia={handleMediaSelected}
        />

        {/* Background search for video recording */}
        <MediaSearchModal
          open={bgSearchOpen}
          onOpenChange={setBgSearchOpen}
          onSelectMedia={handleBgSearchSelect}
        />

        <BackgroundSelectorModal
          open={bgSelectorOpen}
          onOpenChange={setBgSelectorOpen}
          onSelect={handleBgSelected}
          onSearchMediaClick={handleBgSearchMedia}
        />

        <VideoRecorderModal
          open={recorderOpen}
          onOpenChange={setRecorderOpen}
          background={recorderBackground}
          onRecordingComplete={handleRecordingComplete}
        />

        {/* Hidden file input for upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>
    )
  }

  // ─── Landing screen (default) ─────────────────────────────────────────────

  return (
    <div className="w-full max-w-3xl mx-auto py-8 md:py-16 px-4">
      {/* Header */}
      <div className="text-center space-y-6">
        <p
          className="text-xs tracking-[0.25em] uppercase text-primary font-medium"
          style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
        >
          Paste a link. Get an interactive story.
        </p>

        <h1
          className="text-3xl md:text-5xl text-foreground leading-tight"
          style={{ fontFamily: 'var(--font-playfair), serif', fontStyle: 'italic' }}
        >
          Turn any article into something people actually swipe through
        </h1>

        <p className="text-sm md:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
          Drop in a URL. We turn it into interactive slides with photos, quizzes,
          polls, and animated stats. Free. Takes 30 seconds.
        </p>
      </div>

      {/* URL Input */}
      <div className="mt-10 flex flex-col sm:flex-row items-stretch gap-3">
        <div className="flex-1 relative">
          <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTransform()}
            placeholder="https://example.com/article..."
            className="w-full h-14 pl-11 pr-4 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all duration-200"
          />
        </div>
        <button
          onClick={handleTransform}
          disabled={!url.trim() || isTransforming}
          className={cn(
            'h-14 px-8 rounded-xl text-sm font-medium transition-all duration-200',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'hover:scale-[1.02] active:scale-[0.98]',
            'disabled:opacity-50 disabled:pointer-events-none',
            'flex items-center justify-center gap-2',
          )}
        >
          Transform
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Example links */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {examples.map((ex) => (
          <button
            key={ex.label}
            onClick={() => handleTryExample(ex.url)}
            className="px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
            style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
          >
            {ex.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-400 text-center">
          {error}
        </div>
      )}

      {/* Tagline */}
      <p className="mt-8 text-center text-xs md:text-sm text-muted-foreground/70 max-w-md mx-auto leading-relaxed">
        Your words. Your reporting. Just a format readers actually finish.
        No paywall, no account needed, no cost.
      </p>

      {/* Divider */}
      <div className="mt-16 mb-12 border-t border-border" />

      {/* How it works */}
      <div className="text-center mb-10">
        <h2
          className="text-xl md:text-2xl text-foreground font-semibold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          How it works
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step) => (
          <div
            key={step.num}
            className="p-6 rounded-xl border border-border bg-card space-y-3 transition-all duration-200 hover:border-primary/30"
          >
            <span
              className="text-primary text-sm font-medium"
              style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
            >
              {step.num}
            </span>
            <h3 className="text-foreground font-semibold text-base">
              {step.title}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {step.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
