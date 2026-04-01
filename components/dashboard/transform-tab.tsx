'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Link2, ArrowRight, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MobileSlidePreviewRenderer } from '@/components/preview/mobile-slide-preview'
import type { CmsStory } from '@/components/preview/mobile-slide-preview'
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
            <div className="w-42 h-42">
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
          {transformedUrl && (
            <p
              className="text-xs text-muted-foreground/50 max-w-[300px] truncate"
              style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
            >
              {transformedUrl}
            </p>
          )}
        </div>

        {/* Mobile preview */}
        <MobileSlidePreviewRenderer story={previewStory} />
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
