'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LogOut, Plus, FileText, Video, Eye, Calendar, X, ExternalLink } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { cn } from '@/lib/utils'

interface Author {
  id: string
  author_first_name: string | null
  author_last_name: string | null
  author_bio: string | null
  author_email: string | null
  created_at: string | null
}

interface StoryWithMedia {
  id: string
  story_headline: string | null
  published_at: string | null
  created_at: string | null
  slides: { id: string }[]
  coverUrl?: string
}

interface VideoFeedWithMedia {
  id: string
  headline: string | null
  caption: string | null
  published_at: string | null
  created_at: string | null
  videoUrl?: string
  posterUrl?: string
}

type ContentItem =
  | { type: 'story'; data: StoryWithMedia }
  | { type: 'video'; data: VideoFeedWithMedia }

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [author, setAuthor] = useState<Author | null>(null)
  const [loading, setLoading] = useState(true)
  const [stories, setStories] = useState<StoryWithMedia[]>([])
  const [videoFeeds, setVideoFeeds] = useState<VideoFeedWithMedia[]>([])
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null)

  useEffect(() => {
    checkUser()
  }, [])

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
          // Fetch content for this author
          await fetchAuthorContent(authorData.id)
        }
      }
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const fetchAuthorContent = async (authorId: string) => {
    try {
      // Fetch stories linked to this author
      const { data: storyLinks } = await supabase
        .from('authors_stories_links')
        .select('story_id')
        .eq('author_id', authorId)

      if (storyLinks && storyLinks.length > 0) {
        const storyIds = storyLinks.map(link => link.story_id)

        const { data: storiesData } = await supabase
          .from('stories')
          .select(`
            id,
            story_headline,
            published_at,
            created_at,
            slides (id),
            story_media (
              media_id,
              role,
              media_assets (
                bucket,
                object_path
              )
            )
          `)
          .in('id', storyIds)
          .order('created_at', { ascending: false })

        if (storiesData) {
          const storiesWithUrls = storiesData.map((story: any) => {
            let coverUrl: string | undefined
            const coverMedia = story.story_media?.find((sm: any) => sm.role === 'cover')
            if (coverMedia?.media_assets) {
              const { data } = supabase.storage
                .from(coverMedia.media_assets.bucket)
                .getPublicUrl(coverMedia.media_assets.object_path)
              coverUrl = data.publicUrl
            }
            return {
              id: story.id,
              story_headline: story.story_headline,
              published_at: story.published_at,
              created_at: story.created_at,
              slides: story.slides || [],
              coverUrl,
            }
          })
          setStories(storiesWithUrls)
        }
      }

      // Fetch video feeds for this author
      const { data: videoFeedsData } = await supabase
        .from('video_feeds')
        .select(`
          id,
          headline,
          caption,
          published_at,
          created_at,
          video_feed_media (
            media_id,
            role,
            media_assets (
              bucket,
              object_path
            )
          )
        `)
        .eq('author_id', authorId)
        .order('created_at', { ascending: false })

      if (videoFeedsData) {
        const videosWithUrls = videoFeedsData.map((video: any) => {
          let videoUrl: string | undefined
          let posterUrl: string | undefined

          const videoMedia = video.video_feed_media?.find((vfm: any) => vfm.role === 'video')
          if (videoMedia?.media_assets) {
            const { data } = supabase.storage
              .from(videoMedia.media_assets.bucket)
              .getPublicUrl(videoMedia.media_assets.object_path)
            videoUrl = data.publicUrl
          }

          const posterMedia = video.video_feed_media?.find((vfm: any) => vfm.role === 'poster')
          if (posterMedia?.media_assets) {
            const { data } = supabase.storage
              .from(posterMedia.media_assets.bucket)
              .getPublicUrl(posterMedia.media_assets.object_path)
            posterUrl = data.publicUrl
          }

          return {
            id: video.id,
            headline: video.headline,
            caption: video.caption,
            published_at: video.published_at,
            created_at: video.created_at,
            videoUrl,
            posterUrl,
          }
        })
        setVideoFeeds(videosWithUrls)
      }
    } catch (error) {
      console.error('Error fetching author content:', error)
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const formatJoinDate = (dateString: string | null) => {
    if (!dateString) return 'Recently'
    const date = new Date(dateString)
    const month = date.toLocaleString('default', { month: 'long' })
    const year = date.getFullYear()
    return `Joined ${month} ${year}`
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Draft'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getAuthorName = () => {
    if (author?.author_first_name || author?.author_last_name) {
      return `${author.author_first_name || ''} ${author.author_last_name || ''}`.trim()
    }
    return user?.email?.split('@')[0] || 'Author'
  }

  const getAuthorInitials = () => {
    const name = getAuthorName()
    if (author?.author_first_name && author?.author_last_name) {
      return `${author.author_first_name[0]}${author.author_last_name[0]}`.toUpperCase()
    }
    return name[0]?.toUpperCase() || 'A'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Calculate real stats
  const totalStories = stories.length + videoFeeds.length
  const publishedStories = stories.filter(s => s.published_at).length
  const publishedVideos = videoFeeds.filter(v => v.published_at).length
  const totalPublished = publishedStories + publishedVideos

  // Combine all content for display
  const allContent: ContentItem[] = [
    ...stories.map(s => ({ type: 'story' as const, data: s })),
    ...videoFeeds.map(v => ({ type: 'video' as const, data: v })),
  ].sort((a, b) => {
    const dateA = new Date(a.data.created_at || 0).getTime()
    const dateB = new Date(b.data.created_at || 0).getTime()
    return dateB - dateA
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo width={32} height={32} />
            <h1 className="text-xl font-bold text-foreground">Newsreel</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              onClick={() => router.push('/dashboard/create')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create a story
            </Button>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Early Access Banner */}
      <div className="bg-muted border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="text-sm">
            <span className="text-primary font-semibold">EARLY ACCESS</span>
            <p className="text-muted-foreground mt-1">
              This is the working version of Newsreel&apos;s posting system. Expect rough edges. Your feedback shapes what stays.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Author Info and Overall Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Author Profile Card */}
          <Card className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mb-4",
                "bg-primary text-primary-foreground"
              )}>
                <span className="text-xl font-bold">
                  {getAuthorInitials()}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-card-foreground mb-1">
                {getAuthorName()}
              </h2>
              <p className="text-sm text-muted-foreground mb-2">
                Building @Newsreel
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {formatJoinDate(author?.created_at || null)}
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {/* Handle edit profile */}}
              >
                Edit Profile
              </Button>
            </div>
          </Card>

          {/* Stories Contributed Card */}
          <Card className="p-6 flex flex-col justify-center items-center">
            <div className="text-4xl font-bold text-card-foreground mb-2">
              {totalStories}
            </div>
            <div className="text-sm text-muted-foreground uppercase tracking-wide">
              Stories Created
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {totalPublished} published
            </div>
          </Card>

          {/* Content Breakdown Card */}
          <Card className="p-6 flex flex-col justify-center items-center">
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-card-foreground mb-1">
                  {stories.length}
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Briefs
                </div>
              </div>
              <div className="w-px bg-border" />
              <div className="text-center">
                <div className="text-3xl font-bold text-card-foreground mb-1">
                  {videoFeeds.length}
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Video className="h-3 w-3" />
                  Videos
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Your Content Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">
              Your Content
            </h2>
            {allContent.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {allContent.length} {allContent.length === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>

          {allContent.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-2">
                No content yet
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Start creating your first story or video to see it here. Your published content will appear on the Newsreel app.
              </p>
              <Button onClick={() => router.push('/dashboard/create')}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first story
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allContent.map((item) => (
                <Card
                  key={item.type === 'story' ? `story-${item.data.id}` : `video-${item.data.id}`}
                  className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                  onClick={() => setSelectedContent(item)}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {item.type === 'story' && item.data.coverUrl ? (
                      <img
                        src={item.data.coverUrl}
                        alt={item.data.story_headline || 'Story cover'}
                        className="w-full h-full object-cover"
                      />
                    ) : item.type === 'video' && item.data.posterUrl ? (
                      <img
                        src={item.data.posterUrl}
                        alt={item.data.headline || 'Video poster'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {item.type === 'story' ? (
                          <FileText className="h-12 w-12 text-muted-foreground/50" />
                        ) : (
                          <Video className="h-12 w-12 text-muted-foreground/50" />
                        )}
                      </div>
                    )}

                    {/* Type badge */}
                    <div className={cn(
                      "absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium",
                      item.type === 'story'
                        ? "bg-blue-500/90 text-white"
                        : "bg-purple-500/90 text-white"
                    )}>
                      {item.type === 'story' ? 'Brief' : 'Video'}
                    </div>

                    {/* Status badge */}
                    <div className={cn(
                      "absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium",
                      item.data.published_at
                        ? "bg-green-500/90 text-white"
                        : "bg-amber-500/90 text-white"
                    )}>
                      {item.data.published_at ? 'Published' : 'Draft'}
                    </div>
                  </div>

                  {/* Content info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-card-foreground line-clamp-2 mb-2">
                      {item.type === 'story'
                        ? item.data.story_headline || 'Untitled Story'
                        : item.data.headline || 'Untitled Video'
                      }
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(item.data.published_at || item.data.created_at)}
                      {item.type === 'story' && item.data.slides && (
                        <>
                          <span className="text-muted-foreground/50">•</span>
                          <span>{item.data.slides.length} slides</span>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Preview Modal */}
      {selectedContent && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedContent(null)}
        >
          <Card
            className="w-full max-w-2xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                {selectedContent.type === 'story' ? (
                  <FileText className="h-5 w-5 text-blue-500" />
                ) : (
                  <Video className="h-5 w-5 text-purple-500" />
                )}
                <span className="font-semibold text-card-foreground">
                  {selectedContent.type === 'story' ? 'Brief Preview' : 'Video Preview'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedContent(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
              {selectedContent.type === 'story' ? (
                <div>
                  {/* Cover Image */}
                  {selectedContent.data.coverUrl && (
                    <div className="aspect-video bg-muted">
                      <img
                        src={selectedContent.data.coverUrl}
                        alt="Story cover"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="p-6">
                    <h2 className="text-2xl font-bold text-card-foreground mb-4">
                      {selectedContent.data.story_headline || 'Untitled Story'}
                    </h2>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(selectedContent.data.published_at || selectedContent.data.created_at)}
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        {selectedContent.data.slides?.length || 0} slides
                      </div>
                      <div className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        selectedContent.data.published_at
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      )}>
                        {selectedContent.data.published_at ? 'Published' : 'Draft'}
                      </div>
                    </div>

                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Story ID
                      </div>
                      <code className="text-sm text-card-foreground font-mono">
                        {selectedContent.data.id}
                      </code>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Video Player */}
                  {selectedContent.data.videoUrl ? (
                    <div className="bg-black">
                      <video
                        src={selectedContent.data.videoUrl}
                        poster={selectedContent.data.posterUrl}
                        controls
                        className="w-full max-h-[400px]"
                      />
                    </div>
                  ) : selectedContent.data.posterUrl ? (
                    <div className="aspect-video bg-muted">
                      <img
                        src={selectedContent.data.posterUrl}
                        alt="Video poster"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : null}

                  <div className="p-6">
                    <h2 className="text-2xl font-bold text-card-foreground mb-2">
                      {selectedContent.data.headline || 'Untitled Video'}
                    </h2>

                    {selectedContent.data.caption && (
                      <p className="text-muted-foreground mb-4">
                        {selectedContent.data.caption}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(selectedContent.data.published_at || selectedContent.data.created_at)}
                      </div>
                      <div className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        selectedContent.data.published_at
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      )}>
                        {selectedContent.data.published_at ? 'Published' : 'Draft'}
                      </div>
                    </div>

                    {selectedContent.data.videoUrl && (
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Video URL
                        </div>
                        <a
                          href={selectedContent.data.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline break-all flex items-center gap-1"
                        >
                          {selectedContent.data.videoUrl}
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedContent(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
