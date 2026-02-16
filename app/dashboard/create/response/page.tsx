'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { saveBriefPost, updateBriefPost } from '@/lib/supabase/brief'
import { saveVerticalVideoPost } from '@/lib/supabase/video-feed'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Check, FileText, Loader2, CheckCircle2, Video, HelpCircle, BarChart3, Image as ImageIcon, Play, User } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { cn } from '@/lib/utils'
import type { BriefFormData, VerticalVideoFormData, SaveMode, EditBriefMetadata } from '@/lib/supabase/types'

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
  const storyId = searchParams.get('storyId')
  const isVerticalVideo = format === 'vertical-video'
  const isEditMode = !!storyId

  const [user, setUser] = useState<any>(null)
  const [author, setAuthor] = useState<Author | null>(null)
  const [loading, setLoading] = useState(true)
  const [draftState, setDraftState] = useState<BriefFormData | null>(null)
  const [videoDraftState, setVideoDraftState] = useState<VerticalVideoFormData | null>(null)
  const [editMetadata, setEditMetadata] = useState<EditBriefMetadata | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [savedStoryId, setSavedStoryId] = useState<string | null>(null)
  const [savedVideoUrl, setSavedVideoUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [mediaWarnings, setMediaWarnings] = useState<string[]>([])
  const [previewUrls, setPreviewUrls] = useState<{
    coverUrl: string | null
    slideMediaUrls: Map<string, string[]>
    videoUrl: string | null
    posterUrl: string | null
  }>({
    coverUrl: null,
    slideMediaUrls: new Map(),
    videoUrl: null,
    posterUrl: null,
  })
  const objectUrlsRef = useRef<string[]>([])

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

  // Build preview URLs from File objects and existing URLs
  useEffect(() => {
    const urls: string[] = []

    if (isVerticalVideo) {
      const storedFiles = (window as any).__verticalVideoMediaFiles as {
        videoFile: File | null
        posterFile: File | null
      } | undefined

      let vUrl: string | null = null
      let pUrl: string | null = null

      if (storedFiles?.videoFile) {
        vUrl = URL.createObjectURL(storedFiles.videoFile)
        urls.push(vUrl)
      } else if (videoDraftState?.videoUrl) {
        vUrl = videoDraftState.videoUrl
      }

      if (storedFiles?.posterFile) {
        pUrl = URL.createObjectURL(storedFiles.posterFile)
        urls.push(pUrl)
      } else if (videoDraftState?.posterUrl) {
        pUrl = videoDraftState.posterUrl
      }

      setPreviewUrls(prev => ({ ...prev, videoUrl: vUrl, posterUrl: pUrl }))
    } else if (draftState) {
      const storedFiles = (window as any).__briefMediaFiles as {
        headlinePhoto: File | null
        slideMedia: Map<string, File[]>
      } | undefined

      let coverUrl: string | null = null
      if (storedFiles?.headlinePhoto) {
        coverUrl = URL.createObjectURL(storedFiles.headlinePhoto)
        urls.push(coverUrl)
      } else if ((draftState as any).headlinePhotoUrl) {
        coverUrl = (draftState as any).headlinePhotoUrl
      }

      const slideMediaUrls = new Map<string, string[]>()
      for (const slide of draftState.slides) {
        const fileMedia = storedFiles?.slideMedia?.get(slide.id)
        if (fileMedia && fileMedia.length > 0) {
          const slideUrls = fileMedia.map(file => {
            const u = URL.createObjectURL(file)
            urls.push(u)
            return u
          })
          slideMediaUrls.set(slide.id, slideUrls)
        } else if (slide.savedMediaUrls && slide.savedMediaUrls.length > 0) {
          slideMediaUrls.set(slide.id, slide.savedMediaUrls)
        } else if (slide.existingMediaUrls && slide.existingMediaUrls.length > 0) {
          slideMediaUrls.set(slide.id, slide.existingMediaUrls)
        }
      }

      setPreviewUrls(prev => ({ ...prev, coverUrl, slideMediaUrls }))
    }

    objectUrlsRef.current = urls

    return () => {
      objectUrlsRef.current.forEach(u => URL.revokeObjectURL(u))
      objectUrlsRef.current = []
    }
  }, [draftState, videoDraftState])

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
        // Load edit metadata if in edit mode
        const storedMeta = sessionStorage.getItem('briefEditMetadata')
        if (storedMeta) {
          setEditMetadata(JSON.parse(storedMeta))
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

  const isVideoUrl = (url: string): boolean => {
    return url.includes('/video/') || /\.(mp4|mov|webm|avi)(\?|$)/i.test(url)
  }

  const isVideoFile = (slideId: string): boolean => {
    const storedFiles = (window as any).__briefMediaFiles as {
      headlinePhoto: File | null
      slideMedia: Map<string, File[]>
    } | undefined
    const files = storedFiles?.slideMedia?.get(slideId)
    return files?.[0]?.type?.startsWith('video/') || false
  }

  const isCoverVideo = (): boolean => {
    const storedFiles = (window as any).__briefMediaFiles as {
      headlinePhoto: File | null
      slideMedia: Map<string, File[]>
    } | undefined
    if (storedFiles?.headlinePhoto?.type?.startsWith('video/')) return true
    if (!storedFiles?.headlinePhoto && (draftState as any)?.headlinePhotoUrl) {
      return isVideoUrl((draftState as any).headlinePhotoUrl)
    }
    return false
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

      // For edit mode, storedFiles might not exist if no new files were added
      const fullDraftState: BriefFormData = {
        ...draftState,
        headlinePhoto: storedFiles?.headlinePhoto || null,
        slides: draftState.slides.map(slide => ({
          ...slide,
          mediaFiles: storedFiles?.slideMedia?.get(slide.id) || [],
        })),
      }

      let result

      if (isEditMode && editMetadata) {
        // Update existing story
        result = await updateBriefPost({
          mode,
          draftState: fullDraftState,
          userId: user.id,
          editMetadata,
        })
      } else {
        // Create new story
        if (!storedFiles) {
          setErrorMessage('Media files not found. Please go back and re-upload your files.')
          setSaveStatus('idle')
          return
        }
        result = await saveBriefPost({
          mode,
          draftState: fullDraftState,
          userId: user.id,
        })
      }

      if (result.success) {
        setSaveStatus('success')
        setSavedStoryId(result.storyId)
        if (result.mediaWarnings?.length) {
          setMediaWarnings(result.mediaWarnings)
        }
        sessionStorage.removeItem('briefDraftState')
        sessionStorage.removeItem('briefEditMetadata')
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
              {isVerticalVideo
                ? 'Video Saved Successfully!'
                : isEditMode
                  ? 'Story Updated Successfully!'
                  : 'Story Saved Successfully!'}
            </h2>
            <p className="text-muted-foreground mb-4">
              {isVerticalVideo
                ? 'Your video has been uploaded and saved.'
                : isEditMode
                  ? 'Your story has been updated successfully.'
                  : 'Your story has been saved and is ready for review.'}
            </p>
            {mediaWarnings.length > 0 && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-left">
                <div className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">
                  Media Warnings
                </div>
                <ul className="space-y-1">
                  {mediaWarnings.map((w, i) => (
                    <li key={i} className="text-sm text-amber-700 dark:text-amber-300">{w}</li>
                  ))}
                </ul>
              </div>
            )}
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
                onClick={() => router.push(`/dashboard/create/content?format=${format}${isEditMode && storyId ? `&storyId=${storyId}` : ''}`)}
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground text-sm font-bold">N</span>
                </div>
                <h1 className="text-xl font-bold text-foreground">{isEditMode ? 'Edit Post' : 'New Post'}</h1>
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
              Preview & Publish
            </h2>
            <p className="text-muted-foreground">
              Preview your story below, then save as draft or publish immediately.
            </p>
          </div>

          {/* Content Preview */}
          {isVerticalVideo ? (
            // Vertical Video Preview
            videoDraftState ? (
              <div className="space-y-6">
                {/* Phone Frame Video Preview */}
                <div className="flex justify-center">
                  <div className="bg-card rounded-[3rem] p-[6px] shadow-lg" style={{ width: '240px', aspectRatio: '9/19' }}>
                    <div className="bg-background rounded-[2.5rem] h-full overflow-hidden relative">
                      {previewUrls.videoUrl ? (
                        <video
                          src={previewUrls.videoUrl}
                          className="w-full h-full object-cover"
                          controls={false}
                          muted
                          loop
                          playsInline
                          autoPlay
                        />
                      ) : previewUrls.posterUrl ? (
                        <div className="relative w-full h-full">
                          <img
                            src={previewUrls.posterUrl}
                            alt="Poster preview"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Play className="h-12 w-12 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50">
                          <Video className="h-12 w-12 mb-2" />
                          <span className="text-xs">No video</span>
                        </div>
                      )}
                      {/* Headline/Caption overlay */}
                      {(videoDraftState.headline || videoDraftState.caption) && (
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                          {videoDraftState.headline && (
                            <p className="text-white text-sm font-semibold line-clamp-2">
                              {videoDraftState.headline}
                            </p>
                          )}
                          {videoDraftState.caption && (
                            <p className="text-white/80 text-xs mt-1 line-clamp-2">
                              {videoDraftState.caption}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Author and Source */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      Author
                    </div>
                    <div className="text-sm text-card-foreground">
                      {videoDraftState.author_name || getAuthorName()}
                    </div>
                  </div>
                  {videoDraftState.media_source_name && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Source
                      </div>
                      <div className="text-sm text-card-foreground">
                        {videoDraftState.media_source_name}
                      </div>
                    </div>
                  )}
                </div>

                {/* Missing video warning */}
                {!(window as any).__verticalVideoMediaFiles?.videoFile && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">No video file found. Please go back and upload a video.</p>
                  </div>
                )}

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
                  onClick={() => router.push(`/dashboard/create/content?format=${format}${isEditMode && storyId ? `&storyId=${storyId}` : ''}`)}
                >
                  Go Back
                </Button>
              </div>
            )
          ) : (
            // Brief Preview
            draftState ? (
              <div className="space-y-8">
                {/* Cover Media Hero */}
                {previewUrls.coverUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    {isCoverVideo() ? (
                      <div className="relative">
                        <video
                          src={previewUrls.coverUrl}
                          className="w-full h-64 object-cover"
                          controls={false}
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Video className="h-10 w-10 text-white" />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={previewUrls.coverUrl}
                        alt="Cover"
                        className="w-full h-64 object-cover"
                      />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
                      <h3 className="text-xl font-bold text-white leading-tight">
                        {draftState.story_headline || '(No headline)'}
                      </h3>
                      {(draftState as any).subhead && (
                        <p className="text-white/80 text-sm mt-1">{(draftState as any).subhead}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-white/70 text-xs">
                        <User className="h-3 w-3" />
                        {draftState.author_name || getAuthorName()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs mb-3">
                      <ImageIcon className="h-4 w-4" />
                      No cover photo selected
                    </div>
                    <h3 className="text-xl font-bold text-card-foreground leading-tight">
                      {draftState.story_headline || '(No headline)'}
                    </h3>
                    {(draftState as any).subhead && (
                      <p className="text-muted-foreground text-sm mt-1">{(draftState as any).subhead}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-muted-foreground text-xs">
                      <User className="h-3 w-3" />
                      {draftState.author_name || getAuthorName()}
                    </div>
                  </div>
                )}

                {/* Slides */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    {draftState.slides.length} {draftState.slides.length === 1 ? 'Slide' : 'Slides'}
                  </h4>
                  <div className="space-y-4">
                    {draftState.slides.map((slide) => {
                      const mediaUrls = previewUrls.slideMediaUrls.get(slide.id)
                      const hasMedia = mediaUrls && mediaUrls.length > 0
                      const slideIsVideo = hasMedia && (isVideoFile(slide.id) || isVideoUrl(mediaUrls[0]))

                      return (
                        <div
                          key={slide.id}
                          className="rounded-lg border border-border overflow-hidden bg-muted/30"
                        >
                          {/* Slide media */}
                          {hasMedia && (
                            <div className="relative">
                              {slideIsVideo ? (
                                <>
                                  <video
                                    src={mediaUrls[0]}
                                    className="w-full h-40 object-cover"
                                    controls={false}
                                    muted
                                    preload="metadata"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <Play className="h-8 w-8 text-white" />
                                  </div>
                                </>
                              ) : (
                                <img
                                  src={mediaUrls[0]}
                                  alt={`Slide ${slide.slideIndex} media`}
                                  className="w-full h-40 object-cover"
                                />
                              )}
                              {slide.slide_media_source && (
                                <div className="absolute bottom-1 right-1 px-2 py-0.5 bg-black/60 rounded text-[10px] text-white/80">
                                  {slide.slide_media_source}
                                </div>
                              )}
                            </div>
                          )}
                          {/* Slide text content */}
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                Slide {slide.slideIndex}
                              </span>
                            </div>
                            {slide.slide_headline_1 && (
                              <h5 className="text-sm font-semibold text-card-foreground mb-1">
                                {slide.slide_headline_1}
                              </h5>
                            )}
                            {slide.slide_content_1 && (
                              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {slide.slide_content_1}
                              </p>
                            )}
                            {slide.slide_quote && (
                              <div className="mt-2 pl-3 border-l-2 border-primary/40 italic text-sm text-muted-foreground">
                                &ldquo;{slide.slide_quote}&rdquo;
                              </div>
                            )}
                            {!slide.slide_headline_1 && !slide.slide_content_1 && !slide.slide_quote && (
                              <p className="text-sm text-muted-foreground/50 italic">
                                (Empty slide)
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Quiz */}
                {draftState.quiz && draftState.quiz.quiz_content && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="px-4 py-2 bg-primary/10 border-b border-border flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium text-primary uppercase tracking-wider">Quiz</span>
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-semibold text-card-foreground mb-3">
                        {draftState.quiz.quiz_content}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'A', value: draftState.quiz.quiz_answer_a },
                          { label: 'B', value: draftState.quiz.quiz_answer_b },
                          { label: 'C', value: draftState.quiz.quiz_answer_c },
                          { label: 'D', value: draftState.quiz.quiz_answer_d },
                        ].filter(opt => opt.value).map(opt => (
                          <div
                            key={opt.label}
                            className="p-2 rounded-md border border-border bg-background text-sm text-card-foreground flex items-center gap-2"
                          >
                            <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground flex-shrink-0">
                              {opt.label}
                            </span>
                            {opt.value}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Poll */}
                {draftState.poll && draftState.poll.question && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="px-4 py-2 bg-primary/10 border-b border-border flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium text-primary uppercase tracking-wider">Poll</span>
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-semibold text-card-foreground">
                        {draftState.poll.question}
                      </p>
                    </div>
                  </div>
                )}

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
                  onClick={() => router.push(`/dashboard/create/content?format=${format}${isEditMode && storyId ? `&storyId=${storyId}` : ''}`)}
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
              onClick={() => router.push(`/dashboard/create/content?format=${format}${isEditMode && storyId ? `&storyId=${storyId}` : ''}`)}
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
