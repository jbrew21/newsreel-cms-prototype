'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Plus, X, GripVertical, Check, Image as ImageIcon, Video } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { cn } from '@/lib/utils'
import type { SlideFormData, BriefFormData } from '@/lib/supabase/types'
import VerticalVideoContent from '@/components/create/vertical-video-content'

interface Author {
  id: string
  author_first_name: string | null
  author_last_name: string | null
  author_bio: string | null
  author_email: string | null
  created_at: string | null
}

// Global storage for File objects (can't be serialized to sessionStorage)
declare global {
  interface Window {
    __briefMediaFiles?: {
      headlinePhoto: File | null
      slideMedia: Map<string, File[]>
    }
  }
}

export default function CreateContentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const format = searchParams.get('format')
  const isVerticalVideo = format === 'vertical-video'

  // All hooks must be called unconditionally at the top
  const [user, setUser] = useState<any>(null)
  const [author, setAuthor] = useState<Author | null>(null)
  const [loading, setLoading] = useState(true)

  // Story form data - structured for backend integration
  const [storyData, setStoryData] = useState<BriefFormData>({
    story_headline: '',
    headlinePhoto: null,
    author_id: null,
    author_name: '',
    slides: [
      {
        id: crypto.randomUUID(),
        slideIndex: 1,
        slide_headline_1: '',
        slide_content_1: '',
        portrait_video: false,
        mediaFiles: [],
      },
      {
        id: crypto.randomUUID(),
        slideIndex: 2,
        slide_headline_1: '',
        slide_content_1: '',
        portrait_video: false,
        mediaFiles: [],
      },
    ],
  })

  // Track object URLs for cleanup
  const [headlinePhotoPreview, setHeadlinePhotoPreview] = useState<string | null>(null)
  const [slideMediaPreviews, setSlideMediaPreviews] = useState<Map<string, string[]>>(new Map())

  useEffect(() => {
    checkUser()
    // Initialize global file storage
    if (!window.__briefMediaFiles) {
      window.__briefMediaFiles = {
        headlinePhoto: null,
        slideMedia: new Map(),
      }
    }
    // Cleanup object URLs on unmount
    return () => {
      if (headlinePhotoPreview) {
        URL.revokeObjectURL(headlinePhotoPreview)
      }
      slideMediaPreviews.forEach(urls => {
        urls.forEach(url => URL.revokeObjectURL(url))
      })
    }
  }, [])

  // Update headline photo preview when file changes
  useEffect(() => {
    if (storyData.headlinePhoto) {
      const url = URL.createObjectURL(storyData.headlinePhoto)
      setHeadlinePhotoPreview(url)
      // Store in global
      if (window.__briefMediaFiles) {
        window.__briefMediaFiles.headlinePhoto = storyData.headlinePhoto
      }
      return () => URL.revokeObjectURL(url)
    } else {
      setHeadlinePhotoPreview(null)
    }
  }, [storyData.headlinePhoto])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)

      // Fetch author data
      if (user.email) {
        const { data: authorData, error } = await supabase
          .from('authors')
          .select('*')
          .eq('author_email', user.email)
          .maybeSingle()

        if (!error && authorData) {
          setAuthor(authorData)
          const fullName = `${authorData.author_first_name || ''} ${authorData.author_last_name || ''}`.trim()
          setStoryData(prev => ({
            ...prev,
            author_id: authorData.id,
            author_name: fullName || prev.author_name,
          }))
        }
      }
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const getAuthorName = () => {
    if (author?.author_first_name || author?.author_last_name) {
      return `${author.author_first_name || ''} ${author.author_last_name || ''}`.trim()
    }
    return user?.email?.split('@')[0] || 'Author'
  }

  const handleAddSlide = () => {
    const newSlide: SlideFormData = {
      id: crypto.randomUUID(),
      slideIndex: storyData.slides.length + 1,
      slide_headline_1: '',
      slide_content_1: '',
      portrait_video: false,
      mediaFiles: [],
    }
    setStoryData(prev => ({
      ...prev,
      slides: [...prev.slides, newSlide],
    }))
  }

  const handleDeleteSlide = (slideId: string) => {
    const filtered = storyData.slides.filter(s => s.id !== slideId)
    // Reindex slides
    const reindexed = filtered.map((slide, index) => ({
      ...slide,
      slideIndex: index + 1,
    }))
    setStoryData(prev => ({
      ...prev,
      slides: reindexed,
    }))
  }

  const handleSlideChange = (slideId: string, field: keyof SlideFormData, value: string | boolean | File[]) => {
    setStoryData(prev => ({
      ...prev,
      slides: prev.slides.map(slide =>
        slide.id === slideId ? { ...slide, [field]: value } : slide
      ),
    }))
  }

  const handleSlideMediaChange = (slideId: string, files: FileList | null) => {
    if (files && files.length > 0) {
      const fileArray = Array.from(files)

      // Create preview URLs
      const urls = fileArray.map(file => URL.createObjectURL(file))

      // Revoke old URLs for this slide
      const oldUrls = slideMediaPreviews.get(slideId)
      if (oldUrls) {
        oldUrls.forEach(url => URL.revokeObjectURL(url))
      }

      // Update preview map
      setSlideMediaPreviews(prev => {
        const newMap = new Map(prev)
        newMap.set(slideId, urls)
        return newMap
      })

      // Store in global for Response page
      if (window.__briefMediaFiles) {
        window.__briefMediaFiles.slideMedia.set(slideId, fileArray)
      }

      // Update form state
      handleSlideChange(slideId, 'mediaFiles', fileArray)
    }
  }

  const isVideoFile = (file: File): boolean => {
    return file.type.startsWith('video/')
  }

  const handleContinue = () => {
    // Save serializable state to sessionStorage
    // Note: File objects can't be serialized, so they're stored in window.__briefMediaFiles
    const serializableState = {
      story_headline: storyData.story_headline,
      headlinePhoto: null, // File stored in global
      headlinePhotoName: storyData.headlinePhoto?.name || null,
      author_id: storyData.author_id,
      author_name: storyData.author_name,
      slides: storyData.slides.map(slide => ({
        id: slide.id,
        slideIndex: slide.slideIndex,
        slide_headline_1: slide.slide_headline_1,
        slide_content_1: slide.slide_content_1,
        slide_headline_2: slide.slide_headline_2,
        slide_content_2: slide.slide_content_2,
        slide_quote: slide.slide_quote,
        slide_quote_source: slide.slide_quote_source,
        portrait_video: slide.portrait_video,
        mediaFiles: [], // Files stored in global
        mediaFileNames: slide.mediaFiles.map(f => f.name),
      })),
    }
    sessionStorage.setItem('briefDraftState', JSON.stringify(serializableState))

    // Navigate to next step (Response)
    router.push(`/dashboard/create/response?format=${format}`)
  }

  // Render Vertical Video content for that format
  if (isVerticalVideo) {
    return <VerticalVideoContent />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Brief format (default)
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
                onClick={() => router.push('/dashboard/create')}
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
            
            {/* Content Step - Active */}
            <div className="flex items-center gap-3">
              <div className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                "bg-primary text-primary-foreground"
              )}>
                Content
              </div>
              <div className="h-px w-6 border-t border-dashed border-border" />
            </div>
            
            {/* Response Step - Inactive */}
            <div className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-colors",
              "bg-muted text-muted-foreground"
            )}>
              Response
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl pb-24">
        <div className="space-y-8">
            {/* Story Details */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-card-foreground mb-6">
                Story Details
              </h2>
              
              <div className="space-y-6">
                {/* Headline */}
                <div className="space-y-2">
                  <Label htmlFor="headline" className="text-foreground">
                    Headline<span className="text-primary ml-1">*</span>
                  </Label>
                  <Input
                    id="headline"
                    value={storyData.story_headline}
                    onChange={(e) => setStoryData(prev => ({ ...prev, story_headline: e.target.value }))}
                    placeholder="Enter story headline"
                    className="bg-background"
                  />
                </div>

                {/* Headline Photo */}
                <div className="space-y-2">
                  <Label htmlFor="headline-photo" className="text-foreground">
                    Headline Photo<span className="text-primary ml-1">*</span>
                  </Label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('headline-photo-input')?.click()}
                        className="bg-background"
                      >
                        Choose File
                      </Button>
                      <input
                        id="headline-photo-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setStoryData(prev => ({ ...prev, headlinePhoto: e.target.files?.[0] || null }))}
                      />
                      <span className="text-sm text-muted-foreground">
                        {storyData.headlinePhoto ? storyData.headlinePhoto.name : 'No file chosen'}
                      </span>
                    </div>
                    {/* Headline Photo Preview */}
                    {headlinePhotoPreview && (
                      <div className="relative w-full max-w-xs">
                        <img
                          src={headlinePhotoPreview}
                          alt="Headline preview"
                          className="w-full h-40 object-cover rounded-lg border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setStoryData(prev => ({ ...prev, headlinePhoto: null }))
                            if (window.__briefMediaFiles) {
                              window.__briefMediaFiles.headlinePhoto = null
                            }
                          }}
                          className="absolute top-2 right-2 p-1 bg-background/80 rounded-full hover:bg-background transition-colors"
                          aria-label="Remove image"
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Author Name */}
                <div className="space-y-2">
                  <Label htmlFor="author-name" className="text-foreground">
                    Author Name<span className="text-primary ml-1">*</span>
                  </Label>
                  <Input
                    id="author-name"
                    value={storyData.author_name}
                    onChange={(e) => setStoryData(prev => ({ ...prev, author_name: e.target.value }))}
                    placeholder="Enter author name"
                    className="bg-background"
                  />
                </div>
              </div>
            </Card>

            {/* Story Slides */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">
                    Story Slides
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {storyData.slides.length} {storyData.slides.length === 1 ? 'slide' : 'slides'}
                  </p>
                </div>
                <Button
                  variant="default"
                  onClick={handleAddSlide}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Slide
                </Button>
              </div>

              <div className="space-y-4">
                {storyData.slides.map((slide) => (
                  <Card key={slide.id} className="p-4 border-2">
                    <div className="flex items-start gap-3 mb-4">
                      <button
                        type="button"
                        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Drag to reorder"
                      >
                        <GripVertical className="h-5 w-5" />
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm font-medium text-card-foreground">
                            Slide {slide.slideIndex}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSlide(slide.id)}
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            aria-label="Delete slide"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-4">
                          {/* Subheadline */}
                          <div className="space-y-2">
                            <Label htmlFor={`subheadline-${slide.id}`} className="text-foreground">
                              Subheadline
                            </Label>
                            <Input
                              id={`subheadline-${slide.id}`}
                              value={slide.slide_headline_1 || ''}
                              onChange={(e) => handleSlideChange(slide.id, 'slide_headline_1', e.target.value)}
                              placeholder="Slide subheadline"
                              className="bg-background"
                            />
                          </div>

                          {/* Body */}
                          <div className="space-y-2">
                            <Label htmlFor={`body-${slide.id}`} className="text-foreground">
                              Body
                            </Label>
                            <Textarea
                              id={`body-${slide.id}`}
                              value={slide.slide_content_1 || ''}
                              onChange={(e) => handleSlideChange(slide.id, 'slide_content_1', e.target.value)}
                              placeholder="Slide content..."
                              className="bg-background min-h-[120px]"
                            />
                          </div>

                          {/* Image or Video (optional) */}
                          <div className="space-y-2">
                            <Label htmlFor={`image-${slide.id}`} className="text-foreground">
                              Image or Video <span className="text-muted-foreground font-normal">(optional)</span>
                            </Label>
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => document.getElementById(`image-input-${slide.id}`)?.click()}
                                  className="bg-background"
                                >
                                  Choose File
                                </Button>
                                <input
                                  id={`image-input-${slide.id}`}
                                  type="file"
                                  accept="image/*,video/*"
                                  className="hidden"
                                  onChange={(e) => handleSlideMediaChange(slide.id, e.target.files)}
                                />
                                <span className="text-sm text-muted-foreground">
                                  {slide.mediaFiles.length > 0
                                    ? `${slide.mediaFiles.length} file${slide.mediaFiles.length > 1 ? 's' : ''} chosen`
                                    : 'No file chosen'}
                                </span>
                              </div>
                              {/* Slide Media Preview */}
                              {slideMediaPreviews.get(slide.id)?.map((url, idx) => {
                                const file = slide.mediaFiles[idx]
                                const isVideo = file && isVideoFile(file)
                                return (
                                  <div key={idx} className="relative w-full max-w-xs">
                                    {isVideo ? (
                                      <div className="relative">
                                        <video
                                          src={url}
                                          className="w-full h-40 object-cover rounded-lg border border-border"
                                          controls={false}
                                          muted
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                                          <Video className="h-8 w-8 text-white" />
                                        </div>
                                      </div>
                                    ) : (
                                      <img
                                        src={url}
                                        alt={`Slide ${slide.slideIndex} media ${idx + 1}`}
                                        className="w-full h-40 object-cover rounded-lg border border-border"
                                      />
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // Remove this file
                                        const newFiles = slide.mediaFiles.filter((_, i) => i !== idx)
                                        handleSlideChange(slide.id, 'mediaFiles', newFiles)
                                        // Update previews
                                        const currentUrls = slideMediaPreviews.get(slide.id) || []
                                        URL.revokeObjectURL(currentUrls[idx])
                                        const newUrls = currentUrls.filter((_, i) => i !== idx)
                                        setSlideMediaPreviews(prev => {
                                          const newMap = new Map(prev)
                                          if (newUrls.length > 0) {
                                            newMap.set(slide.id, newUrls)
                                          } else {
                                            newMap.delete(slide.id)
                                          }
                                          return newMap
                                        })
                                        // Update global
                                        if (window.__briefMediaFiles) {
                                          if (newFiles.length > 0) {
                                            window.__briefMediaFiles.slideMedia.set(slide.id, newFiles)
                                          } else {
                                            window.__briefMediaFiles.slideMedia.delete(slide.id)
                                          }
                                        }
                                      }}
                                      className="absolute top-2 right-2 p-1 bg-background/80 rounded-full hover:bg-background transition-colors"
                                      aria-label="Remove media"
                                    >
                                      <X className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-background/80 rounded text-xs text-muted-foreground flex items-center gap-1">
                                      {isVideo ? <Video className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                                      {file?.name?.slice(0, 20)}{file?.name && file.name.length > 20 ? '...' : ''}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
        </div>
      </main>

      {/* Footer with Continue Button */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-end">
            <Button
              variant="default"
              onClick={handleContinue}
              className="min-w-[120px]"
            >
              Continue
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
