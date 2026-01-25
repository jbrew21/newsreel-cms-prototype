'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { saveBriefPost } from '@/lib/supabase/brief'
import { saveVerticalVideoPost } from '@/lib/supabase/video-feed'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Check, FileText, Loader2, CheckCircle2, Video, HelpCircle, BarChart3 } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { cn } from '@/lib/utils'
import type { BriefFormData, VerticalVideoFormData, SaveMode } from '@/lib/supabase/types'

interface Author {
  id: string
  author_first_name: string | null
  author_last_name: string | null
  author_email: string | null
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error'

export default function ResponsePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const format = searchParams.get('format')
  const isVerticalVideo = format === 'vertical-video'

  const [user, setUser] = useState<any>(null)
  const [author, setAuthor] = useState<Author | null>(null)
  const [loading, setLoading] = useState(true)
  const [draftState, setDraftState] = useState<BriefFormData | null>(null)
  const [videoDraftState, setVideoDraftState] = useState<VerticalVideoFormData | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [savedStoryId, setSavedStoryId] = useState<string | null>(null)
  const [savedVideoUrl, setSavedVideoUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    checkUser()
    loadDraftState()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)

      if (user.email) {
        const { data: authorData, error } = await supabase
          .from('authors')
          .select('id, author_first_name, author_last_name, author_email')
          .eq('author_email', user.email)
          .maybeSingle()

        if (!error && authorData) {
          setAuthor(authorData)
        }
      }
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const loadDraftState = () => {
    try {
      if (isVerticalVideo) {
        const stored = sessionStorage.getItem('verticalVideoDraftState')
        if (stored) {
          const parsed = JSON.parse(stored)
          setVideoDraftState(parsed)
        }
      } else {
        const stored = sessionStorage.getItem('briefDraftState')
        if (stored) {
          const parsed = JSON.parse(stored)
          setDraftState(parsed)
        }
      }
    } catch (error) {
      console.error('Error loading draft state:', error)
    }
  }

  const getAuthorName = () => {
    if (author?.author_first_name || author?.author_last_name) {
      return `${author.author_first_name || ''} ${author.author_last_name || ''}`.trim()
    }
    return user?.email?.split('@')[0] || 'Author'
  }

  const handleSave = async (mode: SaveMode) => {
    if (!user) {
      setErrorMessage('User not authenticated.')
      return
    }

    setSaveStatus('saving')
    setErrorMessage(null)

    if (isVerticalVideo) {
      // Handle Vertical Video save
      if (!videoDraftState) {
        setErrorMessage('No draft data found. Please go back and fill in the content.')
        setSaveStatus('idle')
        return
      }

      const storedFiles = (window as any).__verticalVideoMediaFiles as {
        videoFile: File | null
        posterFile: File | null
      } | undefined

      if (!storedFiles?.videoFile) {
        setErrorMessage('Video file not found. Please go back and re-upload your video.')
        setSaveStatus('idle')
        return
      }

      const fullDraftState: VerticalVideoFormData = {
        ...videoDraftState,
        videoFile: storedFiles.videoFile,
        posterFile: storedFiles.posterFile,
      }

      const result = await saveVerticalVideoPost({
        mode,
        draftState: fullDraftState,
        userId: user.id,
      })

      if (result.success) {
        setSaveStatus('success')
        setSavedStoryId(result.videoFeedId)
        setSavedVideoUrl(result.videoUrl || null)
        sessionStorage.removeItem('verticalVideoDraftState')
        delete (window as any).__verticalVideoMediaFiles
      } else {
        setSaveStatus('error')
        setErrorMessage(result.error || 'Failed to save. Please try again.')
      }
    } else {
      // Handle Brief save
      if (!draftState) {
        setErrorMessage('No draft data found. Please go back and fill in the content.')
        setSaveStatus('idle')
        return
      }

      const storedFiles = (window as any).__briefMediaFiles as {
        headlinePhoto: File | null
        slideMedia: Map<string, File[]>
      } | undefined

      if (!storedFiles) {
        setErrorMessage('Media files not found. Please go back and re-upload your files.')
        setSaveStatus('idle')
        return
      }

      const fullDraftState: BriefFormData = {
        ...draftState,
        headlinePhoto: storedFiles.headlinePhoto,
        slides: draftState.slides.map(slide => ({
          ...slide,
          mediaFiles: storedFiles.slideMedia.get(slide.id) || [],
        })),
      }

      const result = await saveBriefPost({
        mode,
        draftState: fullDraftState,
        userId: user.id,
      })

      if (result.success) {
        setSaveStatus('success')
        setSavedStoryId(result.storyId)
        sessionStorage.removeItem('briefDraftState')
        delete (window as any).__briefMediaFiles
      } else {
        setSaveStatus('error')
        setErrorMessage(result.error || 'Failed to save. Please try again.')
      }
    }
  }

  const handleGoToDashboard = () => {
    router.push('/dashboard')
  }

  const handleCreateAnother = () => {
    router.push('/dashboard/create')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Success state
  if (saveStatus === 'success') {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground text-sm font-bold">N</span>
                </div>
                <h1 className="text-xl font-bold text-foreground">NewsReel CMS</h1>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-16 max-w-2xl">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-card-foreground mb-2">
              {isVerticalVideo ? 'Video Saved Successfully!' : 'Story Saved Successfully!'}
            </h2>
            <p className="text-muted-foreground mb-4">
              {isVerticalVideo
                ? 'Your video has been uploaded and saved.'
                : 'Your story has been saved and is ready for review.'}
            </p>
            {savedVideoUrl && (
              <div className="mb-6 p-4 bg-muted/50 rounded-lg text-left">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Video URL
                </div>
                <a
                  href={savedVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline break-all"
                >
                  {savedVideoUrl}
                </a>
              </div>
            )}
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={handleCreateAnother}>
                Create Another
              </Button>
              <Button onClick={handleGoToDashboard}>
                Go to Dashboard
              </Button>
            </div>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(`/dashboard/create/content?format=${format}`)}
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground text-sm font-bold">N</span>
                </div>
                <h1 className="text-xl font-bold text-foreground">New Post</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Publishing as: <span className="font-semibold text-foreground">{getAuthorName()}</span>
              </span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Step Indicator */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          <div className="flex items-center gap-3">
            {/* Format Step - Completed */}
            <div className="flex items-center gap-3">
              <div className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2",
                "bg-muted/50 text-foreground border border-border"
              )}>
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
                Format
              </div>
              <div className="h-px w-6 border-t border-dashed border-border" />
            </div>

            {/* Content Step - Completed */}
            <div className="flex items-center gap-3">
              <div className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2",
                "bg-muted/50 text-foreground border border-border"
              )}>
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
                Content
              </div>
              <div className="h-px w-6 border-t border-dashed border-border" />
            </div>

            {/* Response Step - Active */}
            <div className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-colors",
              "bg-primary text-primary-foreground"
            )}>
              Response
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl pb-32">
        <Card className="p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-card-foreground mb-2">
              Review & Save
            </h2>
            <p className="text-muted-foreground">
              Review your story summary below, then save as draft or publish immediately.
            </p>
          </div>

          {/* Content Summary */}
          {isVerticalVideo ? (
            // Vertical Video Summary
            videoDraftState ? (
              <div className="space-y-6">
                {/* Headline */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Headline
                  </div>
                  <div className="text-lg font-semibold text-card-foreground">
                    {videoDraftState.headline || '(No headline)'}
                  </div>
                </div>

                {/* Caption */}
                {videoDraftState.caption && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      Caption
                    </div>
                    <div className="text-card-foreground">
                      {videoDraftState.caption}
                    </div>
                  </div>
                )}

                {/* Author */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Author
                  </div>
                  <div className="text-card-foreground">
                    {videoDraftState.author_name || getAuthorName()}
                  </div>
                </div>

                {/* Video File Status */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Video File
                  </div>
                  <div className="text-card-foreground">
                    {(window as any).__verticalVideoMediaFiles?.videoFile ? (
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        Ready to upload
                      </span>
                    ) : (
                      <span className="text-destructive">
                        No video selected
                      </span>
                    )}
                  </div>
                </div>

                {/* Poster Status */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Poster/Thumbnail
                  </div>
                  <div className="text-card-foreground">
                    {(window as any).__verticalVideoMediaFiles?.posterFile ? (
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        Ready to upload
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        No poster selected (optional)
                      </span>
                    )}
                  </div>
                </div>

                {/* Error Message */}
                {errorMessage && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">{errorMessage}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No draft data found. Please go back to the content step.
                </p>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/create/content?format=${format}`)}
                >
                  Go Back
                </Button>
              </div>
            )
          ) : (
            // Brief Summary
            draftState ? (
              <div className="space-y-6">
                {/* Headline */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Headline
                  </div>
                  <div className="text-lg font-semibold text-card-foreground">
                    {draftState.story_headline || '(No headline)'}
                  </div>
                </div>

                {/* Author */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Author
                  </div>
                  <div className="text-card-foreground">
                    {draftState.author_name || getAuthorName()}
                  </div>
                </div>

                {/* Slides Count */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Content
                  </div>
                  <div className="flex items-center gap-2 text-card-foreground">
                    <FileText className="h-4 w-4" />
                    {draftState.slides.length} {draftState.slides.length === 1 ? 'slide' : 'slides'}
                  </div>
                </div>

                {/* Headline Photo Status */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Cover Photo
                  </div>
                  <div className="text-card-foreground">
                    {(window as any).__briefMediaFiles?.headlinePhoto ? (
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        Ready to upload
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">
                        No cover photo selected
                      </span>
                    )}
                  </div>
                </div>

                {/* Quiz Status */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Quiz Slide
                  </div>
                  <div className="text-card-foreground">
                    {draftState.quiz && draftState.quiz.quiz_content ? (
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-2">
                        <HelpCircle className="h-4 w-4" />
                        Quiz included
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        No quiz (optional)
                      </span>
                    )}
                  </div>
                </div>

                {/* Poll Status */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Poll Slide
                  </div>
                  <div className="text-card-foreground">
                    {draftState.poll && draftState.poll.question ? (
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Poll included
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        No poll (optional)
                      </span>
                    )}
                  </div>
                </div>

                {/* Error Message */}
                {errorMessage && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">{errorMessage}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No draft data found. Please go back to the content step.
                </p>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/create/content?format=${format}`)}
                >
                  Go Back
                </Button>
              </div>
            )
          )}
        </Card>
      </main>

      {/* Footer with Action Buttons */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Button
              variant="ghost"
              onClick={() => router.push(`/dashboard/create/content?format=${format}`)}
              disabled={saveStatus === 'saving'}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => handleSave('draft')}
                disabled={(!draftState && !videoDraftState) || saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Draft'
                )}
              </Button>
              <Button
                onClick={() => handleSave('publish')}
                disabled={(!draftState && !videoDraftState) || saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  'Publish'
                )}
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
