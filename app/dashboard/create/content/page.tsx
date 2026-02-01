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
import type { SlideFormData, BriefFormData, QuizFormData, PollFormData, EditBriefMetadata } from '@/lib/supabase/types'
import { getFullBriefStory } from '@/lib/supabase/brief'
import VerticalVideoContent from '@/components/create/vertical-video-content'
import { MediaPickerModal } from '@/components/media-picker-modal'
import { MediaSearchModal } from '@/components/media-search-modal'
import type { MediaItem } from '@/lib/media-search/types'

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
  const storyId = searchParams.get('storyId')
  const isVerticalVideo = format === 'vertical-video'
  const isEditMode = !!storyId

  // All hooks must be called unconditionally at the top
  const [user, setUser] = useState<any>(null)
  const [author, setAuthor] = useState<Author | null>(null)
  const [loading, setLoading] = useState(true)

  // Edit mode metadata
  const [editMetadata, setEditMetadata] = useState<EditBriefMetadata | null>(null)

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
    quiz: null,
    poll: null,
  })

  // Track object URLs for cleanup
  const [headlinePhotoPreview, setHeadlinePhotoPreview] = useState<string | null>(null)
  const [slideMediaPreviews, setSlideMediaPreviews] = useState<Map<string, string[]>>(new Map())
  const [mediaPickerSlideId, setMediaPickerSlideId] = useState<string | null>(null)
  const [mediaSearchSlideId, setMediaSearchSlideId] = useState<string | null>(null)

  // Drag and drop state
  const [draggedSlideId, setDraggedSlideId] = useState<string | null>(null)
  const [dragOverSlideId, setDragOverSlideId] = useState<string | null>(null)

  useEffect(() => {
    checkUser()
    // Initialize global file storage
    if (!window.__briefMediaFiles) {
      window.__briefMediaFiles = {
        headlinePhoto: null,
        slideMedia: new Map(),
      }
    }
    // If edit mode, load existing story data
    if (isEditMode && storyId) {
      loadExistingStory(storyId)
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

  const loadExistingStory = async (id: string) => {
    try {
      const result = await getFullBriefStory(id)
      if (result) {
        setStoryData(result.storyData)
        setEditMetadata(result.editMetadata)
      }
    } catch (error) {
      console.error('Error loading story for edit:', error)
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

  const handleSlideChange = (slideId: string, field: keyof SlideFormData, value: string | boolean | File[] | string[]) => {
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

  const handleSearchMediaSelect = (slideId: string, item: MediaItem) => {
    // Store the selected URL as a saved media URL on the slide
    handleSlideChange(slideId, 'savedMediaUrls', [item.url])
    // Clear any previously uploaded files for this slide
    handleSlideChange(slideId, 'mediaFiles', [])
    // Revoke old preview URLs
    const oldUrls = slideMediaPreviews.get(slideId)
    if (oldUrls) {
      oldUrls.forEach(url => URL.revokeObjectURL(url))
      setSlideMediaPreviews(prev => {
        const newMap = new Map(prev)
        newMap.delete(slideId)
        return newMap
      })
    }
    if (window.__briefMediaFiles) {
      window.__briefMediaFiles.slideMedia.delete(slideId)
    }
    // Also store the media source attribution if available
    if (item.attribution || item.source) {
      handleSlideChange(slideId, 'slide_media_source', item.attribution || item.source)
    }
  }

  const isVideoFile = (file: File): boolean => {
    return file.type.startsWith('video/')
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, slideId: string) => {
    setDraggedSlideId(slideId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', slideId)
  }

  const handleDragOver = (e: React.DragEvent, slideId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedSlideId !== slideId) {
      setDragOverSlideId(slideId)
    }
  }

  const handleDragLeave = () => {
    setDragOverSlideId(null)
  }

  const handleDragEnd = () => {
    setDraggedSlideId(null)
    setDragOverSlideId(null)
  }

  const handleDrop = (e: React.DragEvent, targetSlideId: string) => {
    e.preventDefault()

    if (!draggedSlideId || draggedSlideId === targetSlideId) {
      setDraggedSlideId(null)
      setDragOverSlideId(null)
      return
    }

    // Find indices
    const draggedIndex = storyData.slides.findIndex(s => s.id === draggedSlideId)
    const targetIndex = storyData.slides.findIndex(s => s.id === targetSlideId)

    if (draggedIndex === -1 || targetIndex === -1) return

    // Reorder slides
    const newSlides = [...storyData.slides]
    const [removed] = newSlides.splice(draggedIndex, 1)
    newSlides.splice(targetIndex, 0, removed)

    // Reindex slides
    const reindexed = newSlides.map((slide, index) => ({
      ...slide,
      slideIndex: index + 1,
    }))

    setStoryData(prev => ({
      ...prev,
      slides: reindexed,
    }))

    setDraggedSlideId(null)
    setDragOverSlideId(null)
  }

  const handleContinue = () => {
    // Save serializable state to sessionStorage
    // Note: File objects can't be serialized, so they're stored in window.__briefMediaFiles
    const serializableState = {
      story_headline: storyData.story_headline,
      headlinePhoto: null, // File stored in global
      headlinePhotoName: storyData.headlinePhoto?.name || null,
      headlinePhotoUrl: storyData.headlinePhotoUrl || null,
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
        slide_media_source: slide.slide_media_source,
        portrait_video: slide.portrait_video,
        mediaFiles: [], // Files stored in global
        mediaFileNames: slide.mediaFiles.map(f => f.name),
        savedMediaUrls: slide.savedMediaUrls || [],
      })),
      // Include quiz and poll (optional, can be null)
      quiz: storyData.quiz,
      poll: storyData.poll,
    }
    sessionStorage.setItem('briefDraftState', JSON.stringify(serializableState))

    // Store edit metadata if in edit mode
    if (isEditMode && editMetadata) {
      sessionStorage.setItem('briefEditMetadata', JSON.stringify(editMetadata))
    } else {
      sessionStorage.removeItem('briefEditMetadata')
    }

    // Navigate to next step (Response)
    const editParam = isEditMode && storyId ? `&storyId=${storyId}` : ''
    router.push(`/dashboard/create/response?format=${format}${editParam}`)
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
                onClick={() => router.push(isEditMode ? '/dashboard' : '/dashboard/create')}
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
                        {storyData.headlinePhoto
                          ? storyData.headlinePhoto.name
                          : (isEditMode && storyData.headlinePhotoUrl)
                            ? 'Current cover photo'
                            : 'No file chosen'}
                      </span>
                    </div>
                    {/* Headline Photo Preview - new file or existing URL */}
                    {(headlinePhotoPreview || (isEditMode && storyData.headlinePhotoUrl && !storyData.headlinePhoto)) && (
                      <div className="relative w-full max-w-xs">
                        <img
                          src={headlinePhotoPreview || storyData.headlinePhotoUrl || ''}
                          alt="Headline preview"
                          className="w-full h-40 object-cover rounded-lg border border-border"
                        />
                        {headlinePhotoPreview && (
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
                        )}
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
                  <Card
                    key={slide.id}
                    className={cn(
                      "p-4 border-2 transition-all",
                      draggedSlideId === slide.id && "opacity-50 scale-[0.98]",
                      dragOverSlideId === slide.id && "border-primary border-dashed"
                    )}
                    draggable
                    onDragStart={(e) => handleDragStart(e, slide.id)}
                    onDragOver={(e) => handleDragOver(e, slide.id)}
                    onDragLeave={handleDragLeave}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, slide.id)}
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div
                        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors pt-1"
                        aria-label="Drag to reorder"
                      >
                        <GripVertical className="h-5 w-5" />
                      </div>
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

                          {/* Media Source */}
                          <div className="space-y-2">
                            <Label htmlFor={`media-source-${slide.id}`} className="text-foreground">
                              Media Source <span className="text-muted-foreground font-normal">(optional)</span>
                            </Label>
                            <Input
                              id={`media-source-${slide.id}`}
                              value={slide.slide_media_source || ''}
                              onChange={(e) => handleSlideChange(slide.id, 'slide_media_source', e.target.value)}
                              placeholder="e.g., Reuters, AP, Getty Images"
                              className="bg-background"
                            />
                          </div>

                          {/* Image or Video (optional) */}
                          <div className="space-y-2">
                            <Label htmlFor={`image-${slide.id}`} className="text-foreground">
                              Image or Video <span className="text-muted-foreground font-normal">(optional)</span>
                            </Label>
                            <div className="space-y-3">
                              <MediaPickerModal
                                open={mediaPickerSlideId === slide.id}
                                onOpenChange={(open) => setMediaPickerSlideId(open ? slide.id : null)}
                                onUploadClick={() => document.getElementById(`image-input-${slide.id}`)?.click()}
                                onSearchClick={() => setMediaSearchSlideId(slide.id)}
                              />
                              <MediaSearchModal
                                open={mediaSearchSlideId === slide.id}
                                onOpenChange={(open) => setMediaSearchSlideId(open ? slide.id : null)}
                                onSelectMedia={(item) => handleSearchMediaSelect(slide.id, item)}
                              />
                              <div className="flex items-center gap-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setMediaPickerSlideId(slide.id)}
                                  className="bg-background"
                                >
                                  Choose Media
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
                                    : (slide.savedMediaUrls && slide.savedMediaUrls.length > 0)
                                      ? 'Current media'
                                      : 'No file chosen'}
                                </span>
                              </div>
                              {/* Existing Media Preview (edit mode) */}
                              {!slideMediaPreviews.get(slide.id) && slide.savedMediaUrls?.map((url, idx) => {
                                const isVideoUrl = url.includes('/video/') || /\.(mp4|mov|webm|avi)(\?|$)/i.test(url)
                                return (
                                  <div key={`saved-${idx}`} className="relative w-full max-w-xs">
                                    {isVideoUrl ? (
                                      <div className="relative">
                                        <video
                                          src={url}
                                          className="w-full h-40 object-cover rounded-lg border border-border"
                                          controls={false}
                                          muted
                                          preload="metadata"
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
                                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-background/80 rounded text-xs text-muted-foreground flex items-center gap-1">
                                      <ImageIcon className="h-3 w-3" />
                                      Existing media
                                    </div>
                                  </div>
                                )
                              })}
                              {/* New File Media Preview */}
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

            {/* Quiz Slide (Optional) */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">
                    Quiz Slide
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Optional - Add a quiz question with multiple choice answers
                  </p>
                </div>
                {storyData.quiz && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStoryData(prev => ({ ...prev, quiz: null }))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>

              {storyData.quiz ? (
                <div className="space-y-4">
                  {/* Quiz Content */}
                  <div className="space-y-2">
                    <Label htmlFor="quiz-content" className="text-foreground">
                      Quiz Question
                    </Label>
                    <Textarea
                      id="quiz-content"
                      value={storyData.quiz.quiz_content}
                      onChange={(e) => setStoryData(prev => ({
                        ...prev,
                        quiz: prev.quiz ? { ...prev.quiz, quiz_content: e.target.value } : null
                      }))}
                      placeholder="Enter your quiz question..."
                      className="bg-background"
                    />
                  </div>

                  {/* Answer Options */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quiz-answer-a" className="text-foreground">
                        Answer A
                      </Label>
                      <Input
                        id="quiz-answer-a"
                        value={storyData.quiz.quiz_answer_a}
                        onChange={(e) => setStoryData(prev => ({
                          ...prev,
                          quiz: prev.quiz ? { ...prev.quiz, quiz_answer_a: e.target.value } : null
                        }))}
                        placeholder="Option A"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quiz-answer-b" className="text-foreground">
                        Answer B
                      </Label>
                      <Input
                        id="quiz-answer-b"
                        value={storyData.quiz.quiz_answer_b}
                        onChange={(e) => setStoryData(prev => ({
                          ...prev,
                          quiz: prev.quiz ? { ...prev.quiz, quiz_answer_b: e.target.value } : null
                        }))}
                        placeholder="Option B"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quiz-answer-c" className="text-foreground">
                        Answer C
                      </Label>
                      <Input
                        id="quiz-answer-c"
                        value={storyData.quiz.quiz_answer_c}
                        onChange={(e) => setStoryData(prev => ({
                          ...prev,
                          quiz: prev.quiz ? { ...prev.quiz, quiz_answer_c: e.target.value } : null
                        }))}
                        placeholder="Option C"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quiz-answer-d" className="text-foreground">
                        Answer D
                      </Label>
                      <Input
                        id="quiz-answer-d"
                        value={storyData.quiz.quiz_answer_d}
                        onChange={(e) => setStoryData(prev => ({
                          ...prev,
                          quiz: prev.quiz ? { ...prev.quiz, quiz_answer_d: e.target.value } : null
                        }))}
                        placeholder="Option D"
                        className="bg-background"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setStoryData(prev => ({
                    ...prev,
                    quiz: {
                      quiz_content: '',
                      quiz_answer_a: '',
                      quiz_answer_b: '',
                      quiz_answer_c: '',
                      quiz_answer_d: '',
                    }
                  }))}
                  className="w-full border-dashed"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Quiz Slide
                </Button>
              )}
            </Card>

            {/* Poll Slide (Optional) */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">
                    Poll Slide
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Optional - Add a poll question with weight parameters
                  </p>
                </div>
                {storyData.poll && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStoryData(prev => ({ ...prev, poll: null }))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>

              {storyData.poll ? (
                <div className="space-y-4">
                  {/* Poll Question */}
                  <div className="space-y-2">
                    <Label htmlFor="poll-question" className="text-foreground">
                      Poll Question
                    </Label>
                    <Textarea
                      id="poll-question"
                      value={storyData.poll.question}
                      onChange={(e) => setStoryData(prev => ({
                        ...prev,
                        poll: prev.poll ? { ...prev.poll, question: e.target.value } : null
                      }))}
                      placeholder="Enter your poll question..."
                      className="bg-background"
                    />
                  </div>

                  {/* Weight Parameters */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="econ-weight" className="text-foreground">
                        Economic Weight
                      </Label>
                      <Input
                        id="econ-weight"
                        type="number"
                        step="0.01"
                        value={storyData.poll.econ_weight ?? ''}
                        onChange={(e) => setStoryData(prev => ({
                          ...prev,
                          poll: prev.poll ? {
                            ...prev.poll,
                            econ_weight: e.target.value ? parseFloat(e.target.value) : null
                          } : null
                        }))}
                        placeholder="0.00"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="social-weight" className="text-foreground">
                        Social Weight
                      </Label>
                      <Input
                        id="social-weight"
                        type="number"
                        step="0.01"
                        value={storyData.poll.social_weight ?? ''}
                        onChange={(e) => setStoryData(prev => ({
                          ...prev,
                          poll: prev.poll ? {
                            ...prev.poll,
                            social_weight: e.target.value ? parseFloat(e.target.value) : null
                          } : null
                        }))}
                        placeholder="0.00"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="importance" className="text-foreground">
                        Importance
                      </Label>
                      <Input
                        id="importance"
                        type="number"
                        step="0.01"
                        value={storyData.poll.importance ?? ''}
                        onChange={(e) => setStoryData(prev => ({
                          ...prev,
                          poll: prev.poll ? {
                            ...prev.poll,
                            importance: e.target.value ? parseFloat(e.target.value) : null
                          } : null
                        }))}
                        placeholder="0.00"
                        className="bg-background"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setStoryData(prev => ({
                    ...prev,
                    poll: {
                      question: '',
                      econ_weight: null,
                      social_weight: null,
                      importance: null,
                    }
                  }))}
                  className="w-full border-dashed"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Poll Slide
                </Button>
              )}
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
