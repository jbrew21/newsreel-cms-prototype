'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'

const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

interface GeneratedQuiz {
  id: string
  question: string
  options: string[]
  correctAnswer: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
}

interface GeneratedPoll {
  id: string
  question: string
  tags: string[]
}

interface AIQuizPollRecommenderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  headline: string
  subhead?: string | null
  slides: any[]
  onQuizSelected?: (quiz: GeneratedQuiz) => void
  onPollSelected?: (poll: GeneratedPoll) => void
  type: 'quiz' | 'poll'
}

const DIFFICULTY_COLORS = {
  easy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  hard: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export function AIQuizPollRecommender({
  open,
  onOpenChange,
  headline,
  subhead,
  slides,
  onQuizSelected,
  onPollSelected,
  type,
}: AIQuizPollRecommenderProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quizzes, setQuizzes] = useState<GeneratedQuiz[]>([])
  const [polls, setPolls] = useState<GeneratedPoll[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [lottieData, setLottieData] = useState<object | null>(null)

  useEffect(() => {
    fetch('/animations/Loading.json')
      .then(res => res.json())
      .then(setLottieData)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (open && (quizzes.length === 0 && polls.length === 0) && !loading) {
      generateRecommendations()
    }
  }, [open])

  const generateRecommendations = async () => {
    setLoading(true)
    setError(null)
    setSelectedId(null)

    try {
      const response = await fetch('/api/generate-quiz-polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline,
          subhead,
          slides,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate recommendations')
      }

      setQuizzes(data.quizzes || [])
      setPolls(data.polls || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = () => {
    if (!selectedId) return

    if (type === 'quiz') {
      const selected = quizzes.find(q => q.id === selectedId)
      if (selected && onQuizSelected) {
        onQuizSelected(selected)
        onOpenChange(false)
      }
    } else {
      const selected = polls.find(p => p.id === selectedId)
      if (selected && onPollSelected) {
        onPollSelected(selected)
        onOpenChange(false)
      }
    }
  }

  const handleSeeMore = async () => {
    setLoading(true)
    setSelectedId(null)
    await generateRecommendations()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header - Fixed */}
        <div className="px-6 py-4 border-b border-border flex-shrink-0">
          <DialogTitle>
            AI-Suggested {type === 'quiz' ? 'Quizzes' : 'Polls'}
          </DialogTitle>
          <DialogDescription>
            Click to select and add to your story
          </DialogDescription>
        </div>

        {/* Content Container - Takes remaining height */}
        <div className="flex-1 min-h-0">
          {/* Loading State */}
          {loading && (
            <div className="w-full h-full flex flex-col items-center justify-center py-12">
              {lottieData && (
                <div className="w-24 h-24">
                  <Lottie animationData={lottieData} loop />
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-3 animate-pulse">
                Generating recommendations...
              </p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="w-full h-full flex flex-col items-center justify-center p-6">
              <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10 w-full max-w-sm">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">{error}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={generateRecommendations}
                    className="mt-2"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Items List - Scrollable */}
          {!loading && (quizzes.length > 0 || polls.length > 0) && (
            <div className="w-full h-full overflow-y-auto">
              <div className="px-6 py-3 space-y-2.5">
                {(type === 'quiz' ? quizzes : polls).map((item) => (
                  <Card
                    key={item.id}
                    className={cn(
                      'p-3 cursor-pointer transition-all border',
                      selectedId === item.id
                        ? 'ring-2 ring-primary bg-primary/5 border-primary'
                        : 'hover:border-primary/50 hover:bg-muted/30'
                    )}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <div className="flex gap-2">
                      <Checkbox
                        checked={selectedId === item.id}
                        onCheckedChange={() => setSelectedId(item.id)}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-tight mb-1.5">
                          {item.question}
                        </p>

                        {/* Quiz-specific: Show options and difficulty */}
                        {type === 'quiz' && 'options' in item && (
                          <>
                            <div className="space-y-1 mb-2 text-xs">
                              {(item as GeneratedQuiz).options.map((opt, i) => {
                                const answerKey = String.fromCharCode(97 + i) // a, b, c, d
                                const isCorrect = (item as GeneratedQuiz).correctAnswer === answerKey
                                return (
                                  <div
                                    key={i}
                                    className={cn(
                                      'p-1.5 rounded border text-xs',
                                      isCorrect
                                        ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                                        : 'bg-muted/50 border-border'
                                    )}
                                  >
                                    <span className="font-mono text-muted-foreground text-[11px]">
                                      {answerKey}.{' '}
                                    </span>
                                    <span className={isCorrect ? 'font-semibold text-green-700 dark:text-green-300' : ''}>
                                      {opt}
                                    </span>
                                    {isCorrect && (
                                      <span className="ml-2 text-green-600 dark:text-green-400 text-[10px] font-semibold">
                                        ✓
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </>
                        )}

                        {/* Tags and Difficulty */}
                        <div className="flex flex-wrap gap-1">
                          {type === 'quiz' && 'difficulty' in item && (
                            <Badge
                              variant="secondary"
                              className={cn('text-[10px] px-2 py-0.5', DIFFICULTY_COLORS[(item as GeneratedQuiz).difficulty])}
                            >
                              {(item as GeneratedQuiz).difficulty}
                            </Badge>
                          )}
                          {item.tags?.slice(0, 2).map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] px-2 py-0.5">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}

                {/* See More Button */}
                <Button
                  onClick={handleSeeMore}
                  disabled={loading}
                  variant="outline"
                  className="w-full mt-2 mb-2"
                >
                  See More
                </Button>

                <div className="pb-2"></div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && quizzes.length === 0 && polls.length === 0 && !error && (
            <div className="w-full h-full flex flex-col items-center justify-center py-8 text-center px-6">
              <p className="text-sm text-muted-foreground mb-4">
                No recommendations generated
              </p>
              <Button onClick={generateRecommendations} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        <div className="px-6 py-4 border-t border-border flex gap-2 justify-end flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSelect}
            disabled={!selectedId || loading}
          >
            Select & Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
