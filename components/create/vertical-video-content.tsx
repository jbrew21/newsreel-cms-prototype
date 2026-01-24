'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Check, X, Video, Image as ImageIcon, Play } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { cn } from '@/lib/utils'
import type { VerticalVideoFormData } from '@/lib/supabase/types'

interface Author {
  id: string
  author_first_name: string | null
  author_last_name: string | null
  author_email: string | null
}

// Global storage for File objects (can't be serialized to sessionStorage)
declare global {
  interface Window {
    __verticalVideoMediaFiles?: {
      videoFile: File | null
      posterFile: File | null
    }
  }
}

export default function VerticalVideoContent() {
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [author, setAuthor] = useState<Author | null>(null)
  const [loading, setLoading] = useState(true)

  // Video form data
  const [videoData, setVideoData] = useState<VerticalVideoFormData>({
    headline: '',
    caption: '',
    videoFile: null,
    posterFile: null,
    author_id: null,
    author_name: '',
    media_source_name: '',
  })

  // Track object URLs for previews
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [posterPreview, setPosterPreview] = useState<string | null>(null)

  useEffect(() => {
    checkUser()
    // Initialize global file storage
    if (!window.__verticalVideoMediaFiles) {
      window.__verticalVideoMediaFiles = {
        videoFile: null,
        posterFile: null,
      }
    }
    // Cleanup object URLs on unmount
    return () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview)
      if (posterPreview) URL.revokeObjectURL(posterPreview)
    }
  }, [])

  // Update video preview when file changes
  useEffect(() => {
    if (videoData.videoFile) {
      const url = URL.createObjectURL(videoData.videoFile)
      setVideoPreview(url)
      if (window.__verticalVideoMediaFiles) {
        window.__verticalVideoMediaFiles.videoFile = videoData.videoFile
      }
      return () => URL.revokeObjectURL(url)
    } else {
      setVideoPreview(null)
    }
  }, [videoData.videoFile])

  // Update poster preview when file changes
  useEffect(() => {
    if (videoData.posterFile) {
      const url = URL.createObjectURL(videoData.posterFile)
      setPosterPreview(url)
      if (window.__verticalVideoMediaFiles) {
        window.__verticalVideoMediaFiles.posterFile = videoData.posterFile
      }
      return () => URL.revokeObjectURL(url)
    } else {
      setPosterPreview(null)
    }
  }, [videoData.posterFile])

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
          const fullName = `${authorData.author_first_name || ''} ${authorData.author_last_name || ''}`.trim()
          setVideoData(prev => ({
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

  const handleVideoChange = (files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0]
      if (file.type.startsWith('video/')) {
        setVideoData(prev => ({ ...prev, videoFile: file }))
      }
    }
  }

  const handlePosterChange = (files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0]
      if (file.type.startsWith('image/')) {
        setVideoData(prev => ({ ...prev, posterFile: file }))
      }
    }
  }

  const handleContinue = () => {
    // Save serializable state to sessionStorage
    const serializableState = {
      headline: videoData.headline,
      caption: videoData.caption,
      videoFile: null, // File stored in global
      videoFileName: videoData.videoFile?.name || null,
      posterFile: null, // File stored in global
      posterFileName: videoData.posterFile?.name || null,
      author_id: videoData.author_id,
      author_name: videoData.author_name,
      media_source_name: videoData.media_source_name,
    }
    sessionStorage.setItem('verticalVideoDraftState', JSON.stringify(serializableState))

    router.push('/dashboard/create/response?format=vertical-video')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
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
                onClick={() => router.push('/dashboard/create')}
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground text-sm font-bold">N</span>
                </div>
                <h1 className="text-xl font-bold text-foreground">New Vertical Video</h1>
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
      <main className="container mx-auto px-4 py-8 max-w-7xl pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Pane: Video Preview */}
          <div className="lg:col-span-4 lg:sticky lg:top-8 lg:h-fit">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-card-foreground mb-4">
                Video Preview
              </h2>
              <div className="bg-muted rounded-lg p-4 border border-border flex justify-center">
                {/* Phone Frame */}
                <div className="bg-card rounded-[3rem] p-[6px] shadow-lg" style={{ width: '220px', aspectRatio: '9/16' }}>
                  <div className="bg-background rounded-[2.5rem] h-full overflow-hidden relative">
                    {videoPreview ? (
                      <video
                        src={videoPreview}
                        className="w-full h-full object-cover"
                        controls={false}
                        muted
                        loop
                        playsInline
                        autoPlay
                      />
                    ) : posterPreview ? (
                      <div className="relative w-full h-full">
                        <img
                          src={posterPreview}
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
                        <span className="text-xs">Upload a video</span>
                      </div>
                    )}
                    {/* Overlay info */}
                    {(videoData.headline || videoData.caption) && (
                      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                        {videoData.headline && (
                          <p className="text-white text-sm font-semibold line-clamp-2">
                            {videoData.headline}
                          </p>
                        )}
                        {videoData.caption && (
                          <p className="text-white/80 text-xs mt-1 line-clamp-2">
                            {videoData.caption}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Pane: Content Editing */}
          <div className="lg:col-span-8 space-y-8">
            {/* Video Upload */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-card-foreground mb-6">
                Video File
              </h2>

              <div className="space-y-6">
                {/* Video Upload */}
                <div className="space-y-2">
                  <Label htmlFor="video-file" className="text-foreground">
                    Video<span className="text-primary ml-1">*</span>
                  </Label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('video-file-input')?.click()}
                        className="bg-background"
                      >
                        Choose Video
                      </Button>
                      <input
                        id="video-file-input"
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => handleVideoChange(e.target.files)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {videoData.videoFile ? videoData.videoFile.name : 'No video chosen'}
                      </span>
                    </div>
                    {/* Video Preview Thumbnail */}
                    {videoPreview && (
                      <div className="relative w-full max-w-md">
                        <video
                          src={videoPreview}
                          className="w-full h-48 object-cover rounded-lg border border-border"
                          controls
                          muted
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setVideoData(prev => ({ ...prev, videoFile: null }))
                            if (window.__verticalVideoMediaFiles) {
                              window.__verticalVideoMediaFiles.videoFile = null
                            }
                          }}
                          className="absolute top-2 right-2 p-1 bg-background/80 rounded-full hover:bg-background transition-colors"
                          aria-label="Remove video"
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-background/80 rounded text-xs text-muted-foreground flex items-center gap-1">
                          <Video className="h-3 w-3" />
                          {(videoData.videoFile?.size || 0) > 1024 * 1024
                            ? `${((videoData.videoFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB`
                            : `${((videoData.videoFile?.size || 0) / 1024).toFixed(0)} KB`}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Poster Upload (Optional) */}
                <div className="space-y-2">
                  <Label htmlFor="poster-file" className="text-foreground">
                    Poster/Thumbnail <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('poster-file-input')?.click()}
                        className="bg-background"
                      >
                        Choose Image
                      </Button>
                      <input
                        id="poster-file-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handlePosterChange(e.target.files)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {videoData.posterFile ? videoData.posterFile.name : 'No image chosen'}
                      </span>
                    </div>
                    {/* Poster Preview */}
                    {posterPreview && (
                      <div className="relative w-full max-w-xs">
                        <img
                          src={posterPreview}
                          alt="Poster preview"
                          className="w-full h-40 object-cover rounded-lg border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setVideoData(prev => ({ ...prev, posterFile: null }))
                            if (window.__verticalVideoMediaFiles) {
                              window.__verticalVideoMediaFiles.posterFile = null
                            }
                          }}
                          className="absolute top-2 right-2 p-1 bg-background/80 rounded-full hover:bg-background transition-colors"
                          aria-label="Remove poster"
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Video Details */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-card-foreground mb-6">
                Video Details
              </h2>

              <div className="space-y-6">
                {/* Headline */}
                <div className="space-y-2">
                  <Label htmlFor="headline" className="text-foreground">
                    Headline
                  </Label>
                  <Input
                    id="headline"
                    value={videoData.headline}
                    onChange={(e) => setVideoData(prev => ({ ...prev, headline: e.target.value }))}
                    placeholder="Enter video headline"
                    className="bg-background"
                  />
                </div>

                {/* Caption */}
                <div className="space-y-2">
                  <Label htmlFor="caption" className="text-foreground">
                    Caption
                  </Label>
                  <Textarea
                    id="caption"
                    value={videoData.caption}
                    onChange={(e) => setVideoData(prev => ({ ...prev, caption: e.target.value }))}
                    placeholder="Add a caption for your video..."
                    className="bg-background min-h-[100px]"
                  />
                </div>

                {/* Media Source */}
                <div className="space-y-2">
                  <Label htmlFor="media-source" className="text-foreground">
                    Media Source <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="media-source"
                    value={videoData.media_source_name}
                    onChange={(e) => setVideoData(prev => ({ ...prev, media_source_name: e.target.value }))}
                    placeholder="e.g., Reuters, AP, Original"
                    className="bg-background"
                  />
                </div>

                {/* Author Name */}
                <div className="space-y-2">
                  <Label htmlFor="author-name" className="text-foreground">
                    Author Name
                  </Label>
                  <Input
                    id="author-name"
                    value={videoData.author_name}
                    onChange={(e) => setVideoData(prev => ({ ...prev, author_name: e.target.value }))}
                    placeholder="Enter author name"
                    className="bg-background"
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer with Continue Button */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Button
              variant="ghost"
              onClick={() => router.push('/dashboard/create')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              variant="default"
              onClick={handleContinue}
              disabled={!videoData.videoFile}
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
