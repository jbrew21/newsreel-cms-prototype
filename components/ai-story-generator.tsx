'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Send, Minus, Plus } from 'lucide-react'
import Image from 'next/image'
import dynamic from 'next/dynamic'

const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

interface GeneratedSlide {
  slide_headline_1: string
  slide_content_1: string
}

interface GeneratedQuiz {
  quiz_content: string
  quiz_answer_a: string
  quiz_answer_b: string
  quiz_answer_c: string
  quiz_answer_d: string
  correct_answer: string
}

interface GeneratedStory {
  story_headline: string
  subhead: string
  story_type: string
  slides: GeneratedSlide[]
  quiz?: GeneratedQuiz
}

interface AIStoryGeneratorProps {
  authorId: string | null
  authorName: string
}

export function AIStoryGenerator({ authorId, authorName }: AIStoryGeneratorProps) {
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [slideCount, setSlideCount] = useState(4)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lottieData, setLottieData] = useState<object | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/animations/Loading.json')
      .then(res => res.json())
      .then(setLottieData)
      .catch(() => {})
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [prompt])

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), slideCount }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate story')
      }

      const story: GeneratedStory = data.story

      // Build the brief draft state for the content page
      const slides = story.slides.map((slide, index) => ({
        id: crypto.randomUUID(),
        slideIndex: index + 1,
        slide_headline_1: slide.slide_headline_1 || '',
        slide_content_1: slide.slide_content_1 || '',
        slide_headline_2: '',
        slide_content_2: '',
        slide_quote: '',
        slide_media_source: '',
        portrait_video: false,
        mediaFiles: [],
        mediaFileNames: [],
        savedMediaUrls: [],
      }))

      const draftState = {
        story_headline: story.story_headline || '',
        subhead: story.subhead || null,
        headlinePhoto: null,
        headlinePhotoUrl: null,
        author_id: authorId,
        author_name: authorName,
        story_type: story.story_type || 'Brief',
        story_date: null,
        is_k12: false,
        is_premium: false,
        story_media_source: null,
        slides,
        quiz: story.quiz
          ? {
              quiz_content: story.quiz.quiz_content || '',
              quiz_answer_a: story.quiz.quiz_answer_a || '',
              quiz_answer_b: story.quiz.quiz_answer_b || '',
              quiz_answer_c: story.quiz.quiz_answer_c || '',
              quiz_answer_d: story.quiz.quiz_answer_d || '',
            }
          : null,
        poll: null,
      }

      // Store in sessionStorage for content page to pick up
      sessionStorage.setItem('briefDraftState', JSON.stringify(draftState))
      sessionStorage.setItem('aiGenerated', 'true')

      // Clear any previous file references
      if (typeof window !== 'undefined') {
        window.__briefMediaFiles = {
          headlinePhoto: null,
          slideMedia: new Map(),
        }
      }

      // Navigate to content page with brief format selected
      router.push('/dashboard/create/content?format=brief')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleGenerate()
    }
  }

  const decrementSlides = () => setSlideCount(prev => Math.max(2, prev - 1))
  const incrementSlides = () => setSlideCount(prev => Math.min(8, prev + 1))

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300",
      isGenerating && "ring-2 ring-primary/30"
    )}>
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
          <Image src="/logo/newsreel-icon.png" alt="Newsreel" width={32} height={32} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">AI Story Generator</h3>
          <p className="text-xs text-muted-foreground">Describe your story and let AI create the canvas</p>
        </div>
      </div>

      {/* Loading State */}
      {isGenerating && (
        <div className="flex flex-col items-center justify-center py-8 px-5">
          {lottieData && (
            <div className="w-28 h-28">
              <Lottie animationData={lottieData} loop />
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-3 animate-pulse">
            Crafting your story...
          </p>
        </div>
      )}

      {/* Input Area */}
      {!isGenerating && (
        <div className="px-5 pb-5">
          {/* Prompt Input */}
          <div className="relative border border-border rounded-xl bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background transition-shadow">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the story you want to create... e.g. 'Write a story about the latest AI regulations in the EU'"
              className={cn(
                "w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm text-foreground",
                "placeholder:text-muted-foreground",
                "focus:outline-none",
                "min-h-[44px] max-h-[120px]"
              )}
              rows={1}
              disabled={isGenerating}
            />

            {/* Bottom Bar */}
            <div className="flex items-center justify-between px-3 pb-3 pt-1">
              {/* Slide Counter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium mr-1">Slides</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-md"
                  onClick={decrementSlides}
                  disabled={slideCount <= 2}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-sm font-semibold text-foreground w-5 text-center tabular-nums">
                  {slideCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-md"
                  onClick={incrementSlides}
                  disabled={slideCount >= 8}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              {/* Send Button */}
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                size="icon"
                className="h-8 w-8 rounded-lg"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-xs text-destructive mt-2 px-1">{error}</p>
          )}

          {/* Helper Text */}
          <p className="text-xs text-muted-foreground mt-2.5 px-1">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border border-border">Enter</kbd> to generate
            {' '}&middot;{' '}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border border-border">Shift + Enter</kbd> for new line
          </p>
        </div>
      )}
    </Card>
  )
}
