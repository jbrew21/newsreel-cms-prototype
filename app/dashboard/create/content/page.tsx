'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Plus, X, GripVertical, Check, Image as ImageIcon, Video, ChevronDown, Camera, Smartphone, AlertCircle } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Logo } from '@/components/brand/logo'
import { cn } from '@/lib/utils'
import type { SlideFormData, BriefFormData, QuizFormData, PollFormData, EditBriefMetadata } from '@/lib/supabase/types'
import { getFullBriefStory } from '@/lib/supabase/brief'
import VerticalVideoContent from '@/components/create/vertical-video-content'
import { MediaPickerModal } from '@/components/media-picker-modal'
import { MediaSearchModal } from '@/components/media-search-modal'
import type { MediaItem } from '@/lib/media-search/types'
import { AIStoryGenerator } from '@/components/ai-story-generator'
import { BackgroundSelectorModal, VideoRecorderModal, AuthorVideoPreview } from '@/components/video-recorder'
import type { BackgroundConfig } from '@/hooks/use-video-compositor'
import { AIQuizPollRecommender } from '@/components/ai-quiz-poll-recommender'
import { MobileSlidePreviewRenderer } from '@/components/preview/mobile-slide-preview'
import { briefFormToCmsStory } from '@/components/preview/brief-to-preview-adapter'
import dynamic from 'next/dynamic'

const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

interface Author {
  id: string
  author_first_name: string | null
  author_last_name: string | null
  author_bio: string | null
  author_email: string | null
  author_avatar: string | null
  created_at: string | null
}

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024
const MAX_UPLOAD_LABEL = '500 MB'

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

const SUBHEADLINE_PRESETS = [
  'The hook 🪝',
  'Zoom in 🔍',
  'Zoom out 🌎',
  'Rewind ⏪',
  'By the numbers 📊',
  'What to watch for 👀',
  'Counterpoint 🔄',
  'Yes, but… 👇',
  'Food for thought 🍎',
  'Tangent 🌀',
]

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
    is_k12: false,
    is_premium: false,
    slides: [
      {
        id: crypto.randomUUID(),
        slideIndex: 1,
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
  const [coverPickerOpen, setCoverPickerOpen] = useState(false)
  const [coverSearchOpen, setCoverSearchOpen] = useState(false)

  // Upload size validation errors
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null)
  const [slideUploadErrors, setSlideUploadErrors] = useState<Map<string, string>>(new Map())

  // Video recorder state
  const [bgSelectorSlideId, setBgSelectorSlideId] = useState<string | null>(null)
  const [recorderSlideId, setRecorderSlideId] = useState<string | null>(null)
  const [recorderBackground, setRecorderBackground] = useState<BackgroundConfig>({ type: 'none' })
  const [authorVideos, setAuthorVideos] = useState<Map<string, { file: File; previewUrl: string }>>(new Map())
  const [bgSearchSlideId, setBgSearchSlideId] = useState<string | null>(null)

  // Story headline video recorder state
  const [storyHeadlineBgSelectorOpen, setStoryHeadlineBgSelectorOpen] = useState(false)
  const [storyHeadlineBgSearchOpen, setStoryHeadlineBgSearchOpen] = useState(false)
  const [storyHeadlineRecorderOpen, setStoryHeadlineRecorderOpen] = useState(false)
  const [storyHeadlineRecorderBackground, setStoryHeadlineRecorderBackground] = useState<BackgroundConfig>({ type: 'none' })
  const [storyHeadlineVideo, setStoryHeadlineVideo] = useState<{ file: File; previewUrl: string } | null>(null)

  // Back confirmation modal
  const [showBackConfirm, setShowBackConfirm] = useState(false)

  // AI Quiz/Poll Recommender modal
  const [aiRecommenderOpen, setAiRecommenderOpen] = useState(false)
  const [aiRecommenderType, setAiRecommenderType] = useState<'quiz' | 'poll'>('quiz')

  // Mobile preview panel
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)

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
    } else {
      // Restore draft from sessionStorage (e.g. when navigating back from review page)
      restoreDraftFromSession()
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
    } else if (!storyData.headlinePhotoUrl) {
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

  const restoreDraftFromSession = () => {
    try {
      const stored = sessionStorage.getItem('briefDraftState')
      if (!stored) return

      const parsed = JSON.parse(stored)
      if (!parsed.story_headline && (!parsed.slides || parsed.slides.length === 0)) return

      // Restore text/serializable data into storyData
      setStoryData(prev => ({
        ...prev,
        story_headline: parsed.story_headline || '',
        subhead: parsed.subhead || null,
        headlinePhoto: window.__briefMediaFiles?.headlinePhoto || null,
        headlinePhotoUrl: parsed.headlinePhotoUrl || null,
        author_id: parsed.author_id || prev.author_id,
        author_name: parsed.author_name || prev.author_name,
        story_type: parsed.story_type || null,
        story_date: parsed.story_date || null,
        is_k12: parsed.is_k12 ?? false,
        is_premium: parsed.is_premium ?? false,
        story_media_source: parsed.story_media_source || null,
        allowed_domains: parsed.allowed_domains || null,
        slides: (parsed.slides || []).map((slide: any) => ({
          id: slide.id,
          slideIndex: slide.slideIndex,
          slide_headline_1: slide.slide_headline_1 || '',
          slide_content_1: slide.slide_content_1 || '',
          slide_headline_2: slide.slide_headline_2 || '',
          slide_content_2: slide.slide_content_2 || '',
          slide_quote: slide.slide_quote || '',
          slide_media_source: slide.slide_media_source || '',
          portrait_video: slide.portrait_video || false,
          mediaFiles: window.__briefMediaFiles?.slideMedia?.get(slide.id) || [],
          savedMediaUrls: slide.savedMediaUrls || [],
          existingMediaUrls: slide.existingMediaUrls || [],
        })),
        quiz: parsed.quiz || null,
        poll: parsed.poll || null,
      }))

      // Restore headline photo preview from window global
      if (window.__briefMediaFiles?.headlinePhoto) {
        const file = window.__briefMediaFiles.headlinePhoto
        // Check if it's a video file (recorded video)
        if (file.type.startsWith('video/')) {
          const url = URL.createObjectURL(file)
          setStoryHeadlineVideo({ file, previewUrl: url })
        } else {
          const url = URL.createObjectURL(file)
          setHeadlinePhotoPreview(url)
        }
      } else if (parsed.headlinePhotoUrl) {
        setHeadlinePhotoPreview(parsed.headlinePhotoUrl)
      }

      // Restore slide media previews from window global or savedMediaUrls
      const newPreviews = new Map<string, string[]>()
      for (const slide of parsed.slides || []) {
        const files = window.__briefMediaFiles?.slideMedia?.get(slide.id)
        if (files && files.length > 0) {
          newPreviews.set(slide.id, files.map((f: File) => URL.createObjectURL(f)))
        } else if (slide.savedMediaUrls && slide.savedMediaUrls.length > 0) {
          newPreviews.set(slide.id, slide.savedMediaUrls)
        } else if (slide.existingMediaUrls && slide.existingMediaUrls.length > 0) {
          newPreviews.set(slide.id, slide.existingMediaUrls)
        }
      }
      if (newPreviews.size > 0) {
        setSlideMediaPreviews(newPreviews)
      }
    } catch (error) {
      console.error('Error restoring draft from session:', error)
    }
  }

  const getAuthorName = () => {
    if (author?.author_first_name || author?.author_last_name) {
      return `${author.author_first_name || ''} ${author.author_last_name || ''}`.trim()
    }
    return user?.email?.split('@')[0] || 'Author'
  }

  // Live preview: convert current form state → CmsStory for the phone renderer
  const authorVideoPreviewUrls = useMemo(() => {
    const map = new Map<string, string>()
    authorVideos.forEach((v, slideId) => map.set(slideId, v.previewUrl))
    return map
  }, [authorVideos])

  const previewStory = useMemo(
    () =>
      briefFormToCmsStory(storyData, {
        coverPreviewUrl: headlinePhotoPreview || storyData.headlinePhotoUrl || null,
        coverFile: storyData.headlinePhoto,
        slideMediaPreviewUrls: slideMediaPreviews,
        authorVideoUrls: authorVideoPreviewUrls,
        storyHeadlineVideoUrl: storyHeadlineVideo?.previewUrl || null,
        authorAvatarUrl: author?.author_avatar || null,
      }),
    [storyData, headlinePhotoPreview, slideMediaPreviews, authorVideoPreviewUrls, storyHeadlineVideo, author],
  )

  const handleAIGenerated = (draftState: any) => {
    setStoryData(prev => ({
      ...prev,
      story_headline: draftState.story_headline || '',
      subhead: draftState.subhead || null,
      headlinePhoto: null,
      headlinePhotoUrl: undefined,
      author_id: draftState.author_id || prev.author_id,
      author_name: draftState.author_name || prev.author_name,
      story_type: draftState.story_type || null,
      story_date: draftState.story_date || null,
      is_k12: draftState.is_k12 ?? false,
      is_premium: draftState.is_premium ?? false,
      slides: (draftState.slides || []).map((slide: any) => ({
        id: slide.id,
        slideIndex: slide.slideIndex,
        slide_headline_1: slide.slide_headline_1 || '',
        slide_content_1: slide.slide_content_1 || '',
        slide_headline_2: slide.slide_headline_2 || '',
        slide_content_2: slide.slide_content_2 || '',
        slide_quote: slide.slide_quote || '',
        slide_media_source: slide.slide_media_source || '',
        portrait_video: slide.portrait_video || false,
        mediaFiles: [],
        savedMediaUrls: [],
      })),
      quiz: draftState.quiz || null,
      poll: draftState.poll || null,
    }))
    // Clear media previews since AI doesn't generate media files
    setHeadlinePhotoPreview(null)
    setSlideMediaPreviews(new Map())
    if (window.__briefMediaFiles) {
      window.__briefMediaFiles = {
        headlinePhoto: null,
        slideMedia: new Map(),
      }
    }
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

      // Size validation — reject the whole selection if any file exceeds the cap
      const oversized = fileArray.find(file => file.size > MAX_UPLOAD_BYTES)
      if (oversized) {
        setSlideUploadErrors(prev => {
          const next = new Map(prev)
          next.set(
            slideId,
            `"${oversized.name}" is ${formatFileSize(oversized.size)}. Maximum file size is ${MAX_UPLOAD_LABEL}.`
          )
          return next
        })
        const input = document.getElementById(`image-input-${slideId}`) as HTMLInputElement | null
        if (input) input.value = ''
        return
      }
      setSlideUploadErrors(prev => {
        if (!prev.has(slideId)) return prev
        const next = new Map(prev)
        next.delete(slideId)
        return next
      })

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

      // Update form state — clear existing/saved URLs since user is uploading new files
      handleSlideChange(slideId, 'mediaFiles', fileArray)
      handleSlideChange(slideId, 'savedMediaUrls', [])
      handleSlideChange(slideId, 'existingMediaUrls', [])
    }
  }

  const handleSearchMediaSelect = (slideId: string, item: MediaItem) => {
    // Store the selected URL as a saved media URL on the slide
    handleSlideChange(slideId, 'savedMediaUrls', [item.url])
    // Clear any previously uploaded files and existing media for this slide
    handleSlideChange(slideId, 'mediaFiles', [])
    handleSlideChange(slideId, 'existingMediaUrls', [])
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

  const handleCoverSearchSelect = (item: MediaItem) => {
    setStoryData(prev => ({
      ...prev,
      headlinePhotoUrl: item.url,
      headlinePhoto: null,
      story_media_source: item.attribution || item.source || prev.story_media_source,
    }))
    setHeadlinePhotoPreview(item.url)
    if (window.__briefMediaFiles) {
      window.__briefMediaFiles.headlinePhoto = null
    }
    setCoverSearchOpen(false)
  }

  // Video recorder handlers
  const handleBgSelected = (slideId: string, config: BackgroundConfig) => {
    setRecorderBackground(config)
    setBgSelectorSlideId(null)
    setTimeout(() => setRecorderSlideId(slideId), 150)
  }

  const handleBgSearchMediaSelect = (slideId: string, item: MediaItem) => {
    const isVideo = item.mediaType === 'video'
    const config: BackgroundConfig = isVideo
      ? { type: 'video', src: item.url }
      : { type: 'image', src: item.url }
    handleBgSelected(slideId, config)
    setBgSearchSlideId(null)
  }

  const handleStoryHeadlineBgSearchMediaSelect = (item: MediaItem) => {
    const isVideo = item.mediaType === 'video'
    const config: BackgroundConfig = isVideo
      ? { type: 'video', src: item.url }
      : { type: 'image', src: item.url }
    setStoryHeadlineRecorderBackground(config)
    setStoryHeadlineBgSearchOpen(false)
    setTimeout(() => setStoryHeadlineRecorderOpen(true), 150)
  }

  const handleRecordingComplete = (slideId: string, file: File) => {
    // Create preview URL
    const previewUrl = URL.createObjectURL(file)

    // Revoke old preview if exists
    const old = authorVideos.get(slideId)
    if (old) URL.revokeObjectURL(old.previewUrl)

    // Store the video
    setAuthorVideos(prev => {
      const next = new Map(prev)
      next.set(slideId, { file, previewUrl })
      return next
    })

    // Store in global file storage — the recorded video replaces slide media
    if (window.__briefMediaFiles) {
      window.__briefMediaFiles.slideMedia.set(slideId, [file])
    }

    // Update slide form data — mark as portrait video, clear other media
    handleSlideChange(slideId, 'portrait_video', true)
    handleSlideChange(slideId, 'mediaFiles', [file])
    handleSlideChange(slideId, 'savedMediaUrls', [])
    handleSlideChange(slideId, 'existingMediaUrls', [])

    // Update slide media preview
    const oldUrls = slideMediaPreviews.get(slideId)
    if (oldUrls) oldUrls.forEach(url => URL.revokeObjectURL(url))
    setSlideMediaPreviews(prev => {
      const newMap = new Map(prev)
      newMap.delete(slideId) // Let AuthorVideoPreview handle display
      return newMap
    })
  }

  const handleDeleteRecording = (slideId: string) => {
    const recording = authorVideos.get(slideId)
    if (recording) {
      URL.revokeObjectURL(recording.previewUrl)
    }
    setAuthorVideos(prev => {
      const next = new Map(prev)
      next.delete(slideId)
      return next
    })

    // Clear from global storage and form data
    if (window.__briefMediaFiles) {
      window.__briefMediaFiles.slideMedia.delete(slideId)
    }
    handleSlideChange(slideId, 'portrait_video', false)
    handleSlideChange(slideId, 'mediaFiles', [])
  }

  const handleStoryHeadlineRecordingComplete = (file: File) => {
    // Create preview URL
    const previewUrl = URL.createObjectURL(file)

    // Revoke old preview if exists
    if (storyHeadlineVideo) {
      URL.revokeObjectURL(storyHeadlineVideo.previewUrl)
    }

    // Store the video
    setStoryHeadlineVideo({ file, previewUrl })

    // Store in global file storage
    if (window.__briefMediaFiles) {
      window.__briefMediaFiles.headlinePhoto = file
    }

    // Update form data
    setStoryData(prev => ({
      ...prev,
      headlinePhoto: file,
    }))

    // Close recorder modal
    setStoryHeadlineRecorderOpen(false)
  }

  const handleDeleteStoryHeadlineRecording = () => {
    if (storyHeadlineVideo) {
      URL.revokeObjectURL(storyHeadlineVideo.previewUrl)
    }
    setStoryHeadlineVideo(null)

    // Clear from global storage and form data
    if (window.__briefMediaFiles) {
      window.__briefMediaFiles.headlinePhoto = null
    }
    setStoryData(prev => ({
      ...prev,
      headlinePhoto: null,
    }))
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

  const handleQuizSelected = (quiz: any) => {
    setStoryData(prev => ({
      ...prev,
      quiz: {
        quiz_content: quiz.question,
        quiz_answer_a: quiz.options[0] || '',
        quiz_answer_b: quiz.options[1] || '',
        quiz_answer_c: quiz.options[2] || '',
        quiz_answer_d: quiz.options[3] || '',
      },
    }))
  }

  const handlePollSelected = (poll: any) => {
    setStoryData(prev => ({
      ...prev,
      poll: {
        question: poll.question,
        econ_weight: null,
        social_weight: null,
        importance: null,
      },
    }))
  }

  const openQuizRecommender = () => {
    setAiRecommenderType('quiz')
    setAiRecommenderOpen(true)
  }

  const openPollRecommender = () => {
    setAiRecommenderType('poll')
    setAiRecommenderOpen(true)
  }

  const handleContinue = () => {
    // Save serializable state to sessionStorage
    // Note: File objects can't be serialized, so they're stored in window.__briefMediaFiles
    const serializableState = {
      story_headline: storyData.story_headline,
      subhead: storyData.subhead || null,
      headlinePhoto: null, // File stored in global
      headlinePhotoName: storyData.headlinePhoto?.name || null,
      headlinePhotoUrl: storyData.headlinePhotoUrl || null,
      author_id: storyData.author_id,
      author_name: storyData.author_name,
      story_type: storyData.story_type || 'Brief',
      story_date: storyData.story_date || null,
      is_k12: storyData.is_k12 ?? false,
      is_premium: storyData.is_premium ?? false,
      story_media_source: storyData.story_media_source || null,
      allowed_domains: storyData.allowed_domains || null,
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
        existingMediaUrls: slide.existingMediaUrls || [],
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
                onClick={() => setShowBackConfirm(true)}
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <Logo width={90} height={22} />
                <h1 className="text-xl font-heading text-foreground">{isEditMode ? 'Edit Story' : 'New Story'}</h1>
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
            {/* AI Story Generator - only show for new stories */}
            {!isEditMode && (
              <AIStoryGenerator
                authorId={author?.id || null}
                authorName={getAuthorName()}
                onGenerated={handleAIGenerated}
              />
            )}

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

                {/* Subhead */}
                <div className="space-y-2">
                  <Label htmlFor="subhead" className="text-foreground">
                    Subhead
                  </Label>
                  <Input
                    id="subhead"
                    value={storyData.subhead || ''}
                    onChange={(e) => setStoryData(prev => ({ ...prev, subhead: e.target.value || null }))}
                    placeholder="Enter subhead (optional)"
                    className="bg-background"
                  />
                </div>

                {/* Headline Photo */}
                <div className="space-y-2">
                  <Label htmlFor="headline-photo" className="text-foreground">
                    Cover Media<span className="text-primary ml-1">*</span>
                  </Label>
                  <div className="space-y-3">
                    <MediaPickerModal
                      open={coverPickerOpen}
                      onOpenChange={setCoverPickerOpen}
                      onUploadClick={() => document.getElementById('headline-photo-input')?.click()}
                      onSearchClick={() => setCoverSearchOpen(true)}
                    />
                    <MediaSearchModal
                      open={coverSearchOpen}
                      onOpenChange={setCoverSearchOpen}
                      onSelectMedia={handleCoverSearchSelect}
                    />
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCoverPickerOpen(true)}
                        className="bg-background"
                      >
                        Choose Media
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStoryHeadlineBgSelectorOpen(true)}
                        className="bg-background"
                      >
                        <Camera className="h-4 w-4 mr-1.5" />
                        Record Video
                      </Button>
                      <input
                        id="headline-photo-input"
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null
                          if (file && file.size > MAX_UPLOAD_BYTES) {
                            setCoverUploadError(
                              `"${file.name}" is ${formatFileSize(file.size)}. Maximum file size is ${MAX_UPLOAD_LABEL}.`
                            )
                            e.target.value = ''
                            return
                          }
                          setCoverUploadError(null)
                          setStoryData(prev => ({ ...prev, headlinePhoto: file, headlinePhotoUrl: undefined }))
                        }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {storyHeadlineVideo
                          ? 'Video recorded'
                          : storyData.headlinePhoto
                            ? storyData.headlinePhoto.name
                            : storyData.headlinePhotoUrl
                              ? 'Current cover media'
                              : 'No file chosen'}
                      </span>
                    </div>
                    {coverUploadError && (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                      >
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <div className="flex-1">
                          <p className="font-medium">File too large</p>
                          <p className="text-destructive/90">{coverUploadError}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCoverUploadError(null)}
                          className="text-destructive/70 hover:text-destructive transition-colors"
                          aria-label="Dismiss error"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {/* Headline Photo/Video Preview - new file or existing URL (but not if recording exists) */}
                    {!storyHeadlineVideo && (headlinePhotoPreview || (storyData.headlinePhotoUrl && !storyData.headlinePhoto)) && (
                      <div className="relative w-full max-w-xs">
                        {/* Check if it's a video - either from File type or URL pattern */}
                        {(storyData.headlinePhoto?.type.startsWith('video/') ||
                          (!storyData.headlinePhoto && storyData.headlinePhotoUrl &&
                           (storyData.headlinePhotoUrl.includes('/video/') || /\.(mp4|mov|webm|avi)(\?|$)/i.test(storyData.headlinePhotoUrl)))) ? (
                          <div className="relative">
                            <video
                              src={headlinePhotoPreview || storyData.headlinePhotoUrl || ''}
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
                            src={headlinePhotoPreview || storyData.headlinePhotoUrl || ''}
                            alt="Headline preview"
                            className="w-full h-40 object-cover rounded-lg border border-border"
                          />
                        )}
                        {(headlinePhotoPreview || storyData.headlinePhotoUrl) && (
                          <button
                            type="button"
                            onClick={() => {
                              setStoryData(prev => ({ ...prev, headlinePhoto: null, headlinePhotoUrl: undefined }))
                              setHeadlinePhotoPreview(null)
                              if (window.__briefMediaFiles) {
                                window.__briefMediaFiles.headlinePhoto = null
                              }
                            }}
                            className="absolute top-2 right-2 p-1 bg-background/80 rounded-full hover:bg-background transition-colors"
                            aria-label="Remove media"
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    )}
                    {/* Story Headline Video Recording Preview */}
                    {storyHeadlineVideo && (
                      <div className="relative w-full max-w-xs">
                        <div className="relative">
                          <video
                            src={storyHeadlineVideo.previewUrl}
                            className="w-full h-40 object-cover rounded-lg border border-border"
                            controls={false}
                            muted
                            loop
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                            <Video className="h-8 w-8 text-white" />
                          </div>
                        </div>
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-background/80 rounded text-xs text-muted-foreground flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          Author Recording
                        </div>
                        <button
                          type="button"
                          onClick={handleDeleteStoryHeadlineRecording}
                          className="absolute top-2 right-2 p-1 bg-background/80 rounded-full hover:bg-background transition-colors"
                          aria-label="Delete recording"
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cover Media Source */}
                <div className="space-y-2">
                  <Label htmlFor="story-media-source" className="text-foreground">
                    Media Source <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="story-media-source"
                    value={storyData.story_media_source || ''}
                    onChange={(e) => setStoryData(prev => ({ ...prev, story_media_source: e.target.value || null }))}
                    placeholder="e.g., Reuters, AP, Getty Images"
                    className="bg-background"
                  />
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

                {/* Story Type & Date Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Story Type */}
                  <div className="space-y-2">
                    <Label htmlFor="story-type" className="text-foreground">
                      Story Type
                    </Label>
                    {(() => {
                      const STORY_TYPE_OPTIONS = [
                        'Brief', 'Explainer', 'Feature', 'Exposé', 'Breaking',
                        'Politics', 'Business', 'Culture', 'Science', 'Technology',
                        'Health', 'Sports', 'Opinion', 'Investigation'
                      ]
                      const currentValue = storyData.story_type || ''
                      const isCustom = currentValue !== '' && !STORY_TYPE_OPTIONS.some(
                        opt => opt.toLowerCase() === currentValue.toLowerCase()
                      )
                      return (
                        <div className="flex gap-2">
                          <div className="relative w-full">
                          <select
                            id="story-type"
                            value={isCustom ? '__custom__' : currentValue}
                            onChange={(e) => {
                              const val = e.target.value
                              if (val === '__custom__') {
                                setStoryData(prev => ({ ...prev, story_type: '' }))
                              } else {
                                setStoryData(prev => ({ ...prev, story_type: val || null }))
                              }
                            }}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm ring-offset-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none cursor-pointer"
                          >
                            <option value="" className="bg-background text-foreground">Select type...</option>
                            {STORY_TYPE_OPTIONS.map(opt => (
                              <option key={opt} value={opt} className="bg-background text-foreground">{opt}</option>
                            ))}
                            <option value="__custom__" className="bg-background text-foreground">Custom...</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          </div>
                          {isCustom && (
                            <Input
                              value={currentValue}
                              onChange={(e) => setStoryData(prev => ({ ...prev, story_type: e.target.value || null }))}
                              placeholder="Enter custom type"
                              className="bg-background"
                            />
                          )}
                        </div>
                      )
                    })()}
                    <p className="text-xs text-muted-foreground">
                      Optional. Defaults to &quot;Brief&quot; if empty.
                    </p>
                  </div>

                  {/* Story Date */}
                  <div className="space-y-2">
                    <Label htmlFor="story-date" className="text-foreground">
                      Story Date
                    </Label>
                    <Input
                      id="story-date"
                      type="date"
                      value={storyData.story_date || ''}
                      onChange={(e) => setStoryData(prev => ({ ...prev, story_date: e.target.value || null }))}
                      className="bg-background"
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional. Defaults to publish/draft date.
                    </p>
                  </div>
                </div>

                {/* Story Flags */}
                <div className="flex items-center gap-6">
                  <label htmlFor="is-k12" className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      id="is-k12"
                      type="checkbox"
                      checked={storyData.is_k12 ?? false}
                      onChange={(e) => setStoryData(prev => ({ ...prev, is_k12: e.target.checked }))}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="text-sm font-medium text-foreground">Sensitive Story (K-12)</span>
                  </label>
                  <label htmlFor="is-premium" className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      id="is-premium"
                      type="checkbox"
                      checked={storyData.is_premium ?? false}
                      onChange={(e) => setStoryData(prev => ({ ...prev, is_premium: e.target.checked }))}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="text-sm font-medium text-foreground">Premium</span>
                  </label>
                </div>

                {/* Campus Visibility (optional, collapsible) */}
                {storyData.allowed_domains && storyData.allowed_domains.length > 0 ? (
                  <div className="space-y-3 pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <Label className="text-foreground text-sm">
                        Campus Visibility
                      </Label>
                      <button
                        type="button"
                        onClick={() => setStoryData(prev => ({ ...prev, allowed_domains: null }))}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Make public
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {storyData.allowed_domains.map((domain, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-sm"
                        >
                          {domain}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = storyData.allowed_domains!.filter((_, i) => i !== idx)
                              setStoryData(prev => ({
                                ...prev,
                                allowed_domains: updated.length > 0 ? updated : null,
                              }))
                            }}
                            className="hover:text-destructive transition-colors"
                            aria-label={`Remove ${domain}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        placeholder="add domain..."
                        className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-32"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault()
                            const value = (e.target as HTMLInputElement).value.trim().toLowerCase().replace(/^@/, '')
                            if (value && !storyData.allowed_domains?.includes(value)) {
                              setStoryData(prev => ({
                                ...prev,
                                allowed_domains: [...(prev.allowed_domains || []), value],
                              }))
                            }
                            ;(e.target as HTMLInputElement).value = ''
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Only readers with these email domains will see this story.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      // Auto-fill with author's email domain if available
                      const email = author?.author_email || user?.email
                      const domain = email?.split('@')[1]
                      setStoryData(prev => ({
                        ...prev,
                        allowed_domains: domain ? [domain] : [],
                      }))
                    }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
                  >
                    <Plus className="h-3 w-3" />
                    Limit to campus readers
                  </button>
                )}
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
                            <div className="flex gap-2">
                              <div className="relative">
                                <select
                                  className="appearance-none bg-background border border-input rounded-md px-3 py-2 pr-8 text-sm cursor-pointer hover:bg-accent/50 transition-colors"
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleSlideChange(slide.id, 'slide_headline_1', e.target.value)
                                    }
                                  }}
                                >
                                  <option value="" disabled>Presets</option>
                                  {SUBHEADLINE_PRESETS.map((preset) => (
                                    <option key={preset} value={preset}>{preset}</option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                              </div>
                              <Input
                                id={`subheadline-${slide.id}`}
                                value={slide.slide_headline_1 || ''}
                                onChange={(e) => handleSlideChange(slide.id, 'slide_headline_1', e.target.value)}
                                placeholder="Slide subheadline"
                                className="bg-background flex-1"
                              />
                            </div>
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
                              {/* Background selector for video recording */}
                              <BackgroundSelectorModal
                                open={bgSelectorSlideId === slide.id}
                                onOpenChange={(open) => setBgSelectorSlideId(open ? slide.id : null)}
                                onSelect={(config) => handleBgSelected(slide.id, config)}
                                onSearchMediaClick={() => setBgSearchSlideId(slide.id)}
                              />
                              <MediaSearchModal
                                open={bgSearchSlideId === slide.id}
                                onOpenChange={(open) => setBgSearchSlideId(open ? slide.id : null)}
                                onSelectMedia={(item) => handleBgSearchMediaSelect(slide.id, item)}
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
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setBgSelectorSlideId(slide.id)}
                                  className="bg-background"
                                >
                                  <Camera className="h-4 w-4 mr-1.5" />
                                  Record Video
                                </Button>
                                <input
                                  id={`image-input-${slide.id}`}
                                  type="file"
                                  accept="image/*,video/*"
                                  className="hidden"
                                  onChange={(e) => handleSlideMediaChange(slide.id, e.target.files)}
                                />
                                <span className="text-sm text-muted-foreground">
                                  {authorVideos.has(slide.id)
                                    ? 'Video recorded'
                                    : slide.mediaFiles.length > 0
                                      ? `${slide.mediaFiles.length} file${slide.mediaFiles.length > 1 ? 's' : ''} chosen`
                                      : (slide.savedMediaUrls && slide.savedMediaUrls.length > 0)
                                        ? 'Current media'
                                        : (slide.existingMediaUrls && slide.existingMediaUrls.length > 0)
                                          ? 'Current media'
                                          : 'No file chosen'}
                                </span>
                              </div>
                              {slideUploadErrors.get(slide.id) && (
                                <div
                                  role="alert"
                                  className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                                >
                                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                                  <div className="flex-1">
                                    <p className="font-medium">File too large</p>
                                    <p className="text-destructive/90">{slideUploadErrors.get(slide.id)}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSlideUploadErrors(prev => {
                                      if (!prev.has(slide.id)) return prev
                                      const next = new Map(prev)
                                      next.delete(slide.id)
                                      return next
                                    })}
                                    className="text-destructive/70 hover:text-destructive transition-colors"
                                    aria-label="Dismiss error"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                              {/* Existing Media Preview (edit mode or search selection) */}
                              {!slideMediaPreviews.get(slide.id) && (slide.savedMediaUrls?.length ? slide.savedMediaUrls : slide.existingMediaUrls)?.map((url, idx) => {
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
                              {/* Author Video Recording Preview */}
                              {authorVideos.has(slide.id) && (
                                <AuthorVideoPreview
                                  videoUrl={authorVideos.get(slide.id)!.previewUrl}
                                  onDelete={() => handleDeleteRecording(slide.id)}
                                />
                              )}
                              {/* New File Media Preview (non-recording uploads) */}
                              {!authorVideos.has(slide.id) && slideMediaPreviews.get(slide.id)?.map((url, idx) => {
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

            {/* Video Recorder Modal (shared across all slides) */}
            <VideoRecorderModal
              open={recorderSlideId !== null}
              onOpenChange={(open) => { if (!open) setRecorderSlideId(null) }}
              background={recorderBackground}
              onRecordingComplete={(file) => {
                if (recorderSlideId) handleRecordingComplete(recorderSlideId, file)
              }}
              maxDuration={60}
            />

            {/* Story Headline Background Selector Modal */}
            <BackgroundSelectorModal
              open={storyHeadlineBgSelectorOpen}
              onOpenChange={setStoryHeadlineBgSelectorOpen}
              onSelect={(bg) => {
                setStoryHeadlineRecorderBackground(bg)
                setStoryHeadlineBgSelectorOpen(false)
                setTimeout(() => setStoryHeadlineRecorderOpen(true), 150)
              }}
              onSearchMediaClick={() => setStoryHeadlineBgSearchOpen(true)}
            />

            {/* Story Headline Background Search Modal */}
            <MediaSearchModal
              open={storyHeadlineBgSearchOpen}
              onOpenChange={setStoryHeadlineBgSearchOpen}
              onSelectMedia={handleStoryHeadlineBgSearchMediaSelect}
            />

            {/* Story Headline Video Recorder Modal */}
            <VideoRecorderModal
              open={storyHeadlineRecorderOpen}
              onOpenChange={(open) => { if (!open) setStoryHeadlineRecorderOpen(false) }}
              background={storyHeadlineRecorderBackground}
              onRecordingComplete={handleStoryHeadlineRecordingComplete}
              maxDuration={60}
            />

            {/* Quiz Slide (Optional) */}
            <Card className="p-6 relative overflow-hidden">
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
                      <Label htmlFor="quiz-answer-a" className="text-foreground font-semibold" style={{ color: '#DAA520' }}>
                        Answer A (Correct)
                      </Label>
                      <Input
                        id="quiz-answer-a"
                        value={storyData.quiz.quiz_answer_a}
                        onChange={(e) => setStoryData(prev => ({
                          ...prev,
                          quiz: prev.quiz ? { ...prev.quiz, quiz_answer_a: e.target.value } : null
                        }))}
                        placeholder="Option A (Correct Answer)"
                        className="bg-background"
                        style={{ borderColor: '#DAA520', borderWidth: '2px' }}
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
                <div className="space-y-3">
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

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-2 bg-card text-muted-foreground">or</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={openQuizRecommender}
                    className="w-full"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative w-4 h-4">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 animate-spin opacity-75"></div>
                        <div className="absolute inset-0.5 bg-card rounded-full"></div>
                      </div>
                      <span>Create Quiz with AI</span>
                    </div>
                  </Button>
                </div>
              )}
            </Card>

            {/* Poll Slide (Optional) */}
            <Card className="p-6 relative overflow-hidden">
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

                  {/* Weight Parameters - hidden from authors, data preserved */}
                  {/* <div className="grid grid-cols-3 gap-4">
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
                  </div> */}
                </div>
              ) : (
                <div className="space-y-3">
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

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-2 bg-card text-muted-foreground">or</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={openPollRecommender}
                    className="w-full"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative w-4 h-4">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 animate-spin opacity-75"></div>
                        <div className="absolute inset-0.5 bg-card rounded-full"></div>
                      </div>
                      <span>Create Poll with AI</span>
                    </div>
                  </Button>
                </div>
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

      {/* AI Quiz/Poll Recommender Modal */}
      <AIQuizPollRecommender
        open={aiRecommenderOpen}
        onOpenChange={setAiRecommenderOpen}
        headline={storyData.story_headline}
        subhead={storyData.subhead}
        slides={storyData.slides}
        onQuizSelected={handleQuizSelected}
        onPollSelected={handlePollSelected}
        type={aiRecommenderType}
      />

      {/* Mobile Preview — fixed button, top-right of content area */}
      <button
        onClick={() => setMobilePreviewOpen(true)}
        className={cn(
          'fixed right-8 top-[160px] z-40',
          'flex items-center gap-2.5 px-5 py-2.5 rounded-lg',
          'border border-border bg-card text-foreground shadow-md',
          'hover:bg-muted transition-colors',
          'hidden xl:flex',
        )}
      >
        <Smartphone className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Mobile Preview</span>
      </button>

      {/* Mobile Preview — small screen fallback (bottom-right, above footer) */}
      <button
        onClick={() => setMobilePreviewOpen(true)}
        className={cn(
          'fixed right-4 bottom-20 z-40',
          'flex items-center justify-center w-12 h-12 rounded-full',
          'bg-primary text-primary-foreground shadow-lg',
          'hover:bg-primary/90 transition-all',
          'xl:hidden',
        )}
        aria-label="Mobile Preview"
      >
        <Smartphone className="h-5 w-5" />
      </button>

      {/* Mobile Preview Slide-out Panel */}
      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobilePreviewOpen(false)}
          />
          {/* Panel */}
          <div className="relative w-full max-w-[560px] bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Mobile Preview</span>
              </div>
              <button
                onClick={() => setMobilePreviewOpen(false)}
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Phone preview — large, vertically scrollable */}
            <div className="flex-1 overflow-y-auto flex items-start justify-center py-8 px-6">
              <MobileSlidePreviewRenderer story={previewStory} />
            </div>
            <div className="px-5 py-3 border-t border-border flex-shrink-0">
              <p className="text-xs text-muted-foreground text-center">
                Live preview &mdash; updates as you edit
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Back Confirmation Modal */}
      {showBackConfirm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowBackConfirm(false)}
        >
          <Card
            className="w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-foreground">Leave this page?</h2>
            <p className="text-sm text-muted-foreground">
              Any unsaved changes will be lost. Are you sure you want to go back?
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowBackConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => router.push('/dashboard')}
              >
                Leave
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
