'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus, FileText, Video, Calendar, X, ExternalLink, Search, Users, Trash2 } from 'lucide-react'
import { deleteStory } from '@/lib/supabase/brief'
import { cn } from '@/lib/utils'
import { Sidebar, MobileHeader, TabContent, type TabId } from '@/components/dashboard'

// ── Types ────────────────────────────────────────────────────────────────────

interface Author {
  id: string
  author_first_name: string | null
  author_last_name: string | null
  author_bio: string | null
  author_email: string | null
  author_role: string | null
  author_organization: string | null
  author_avatar: string | null
  author_cover: string | null
  is_first_login: boolean | null
  created_at: string | null
}

interface StoryWithMedia {
  id: string
  story_headline: string | null
  published_at: string | null
  created_at: string | null
  slides: { id: string }[]
  coverUrl?: string
  coverMediaType?: 'image' | 'video'
  authorName?: string
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Draft'
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [author, setAuthor] = useState<Author | null>(null)
  const [loading, setLoading] = useState(true)
  const [stories, setStories] = useState<StoryWithMedia[]>([])
  const [videoFeeds, setVideoFeeds] = useState<VideoFeedWithMedia[]>([])
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null)
  const [isInternalTeam, setIsInternalTeam] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('drafts')
  const [allStories, setAllStories] = useState<StoryWithMedia[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [allStoriesLoading, setAllStoriesLoading] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [monthlyReaders, setMonthlyReaders] = useState(0)
  const [quizAccuracy, setQuizAccuracy] = useState<number | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ── Data fetching (unchanged) ──────────────────────────────────────

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

      if (user.email) {
        const { data: authorData, error } = await supabase
          .from('authors')
          .select('*')
          .eq('author_email', user.email)
          .maybeSingle()

        if (!error && authorData) {
          if (authorData.is_first_login) {
            router.push('/onboarding')
            return
          }
          setAuthor(authorData)

          const internal = user.email?.endsWith('@newsreel.co') ?? false
          setIsInternalTeam(internal)

          await fetchAuthorContent(authorData.id)

          if (internal) {
            await fetchAllStories()
          }
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
      const { data: storyLinks } = await supabase
        .from('authors_stories_links')
        .select('story_id')
        .eq('author_id', authorId)

      if (storyLinks && storyLinks.length > 0) {
        const storyIds = storyLinks.map(link => link.story_id)

        const now = new Date()
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        const monthEnd = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`

        const { data: readersCount } = await supabase
          .rpc('get_author_monthly_readers', {
            story_ids: storyIds,
            month_start: monthStart,
            month_end: monthEnd,
          })

        if (typeof readersCount === 'number') {
          setMonthlyReaders(readersCount)
        }

        const { data: accuracy } = await supabase
          .rpc('get_author_quiz_accuracy', {
            story_ids: storyIds,
          })

        if (accuracy !== null && accuracy !== undefined) {
          setQuizAccuracy(Number(accuracy))
        }

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
                object_path,
                media_type
              )
            )
          `)
          .in('id', storyIds)
          .order('created_at', { ascending: false })

        if (storiesData) {
          const storiesWithUrls = storiesData.map((story: any) => {
            let coverUrl: string | undefined
            let coverMediaType: 'image' | 'video' | undefined
            const coverMedia = story.story_media?.find((sm: any) => sm.role === 'cover')
            if (coverMedia?.media_assets) {
              const { data } = supabase.storage
                .from(coverMedia.media_assets.bucket)
                .getPublicUrl(coverMedia.media_assets.object_path)
              coverUrl = data.publicUrl
              coverMediaType = coverMedia.media_assets.media_type || undefined
            }
            return {
              id: story.id,
              story_headline: story.story_headline,
              published_at: story.published_at,
              created_at: story.created_at,
              slides: story.slides || [],
              coverUrl,
              coverMediaType,
            }
          })
          setStories(storiesWithUrls)
        }
      }

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

  const fetchAllStories = async () => {
    try {
      setAllStoriesLoading(true)

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
              object_path,
              media_type
            )
          ),
          authors_stories_links (
            authors (
              author_first_name,
              author_last_name
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (storiesData) {
        const storiesWithUrls = storiesData.map((story: any) => {
          let coverUrl: string | undefined
          let coverMediaType: 'image' | 'video' | undefined
          const coverMedia = story.story_media?.find((sm: any) => sm.role === 'cover')
          if (coverMedia?.media_assets) {
            const { data } = supabase.storage
              .from(coverMedia.media_assets.bucket)
              .getPublicUrl(coverMedia.media_assets.object_path)
            coverUrl = data.publicUrl
            coverMediaType = coverMedia.media_assets.media_type || undefined
          }

          const authorLink = story.authors_stories_links?.[0]?.authors
          const authorName = authorLink
            ? `${authorLink.author_first_name || ''} ${authorLink.author_last_name || ''}`.trim()
            : 'Unknown Author'

          return {
            id: story.id,
            story_headline: story.story_headline,
            published_at: story.published_at,
            created_at: story.created_at,
            slides: story.slides || [],
            coverUrl,
            coverMediaType,
            authorName,
          }
        })
        setAllStories(storiesWithUrls)
      }
    } catch (error) {
      console.error('Error fetching all stories:', error)
    } finally {
      setAllStoriesLoading(false)
    }
  }

  // ── Actions (unchanged) ────────────────────────────────────────────

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const handleDeleteStory = async (storyId: string) => {
    setDeleting(true)
    const result = await deleteStory(storyId)
    if (result.success) {
      setStories(prev => prev.filter(s => s.id !== storyId))
      setAllStories(prev => prev.filter(s => s.id !== storyId))
      setSelectedContent(null)
      setDeleteConfirmId(null)
    } else {
      console.error('Delete failed:', result.error)
    }
    setDeleting(false)
  }

  const handlePublishStory = async (storyId: string) => {
    setPublishing(true)
    const { error } = await supabase
      .from('stories')
      .update({ published_at: new Date().toISOString() })
      .eq('id', storyId)
    if (!error) {
      const now = new Date().toISOString()
      setStories(prev => prev.map(s => s.id === storyId ? { ...s, published_at: now } : s))
      setAllStories(prev => prev.map(s => s.id === storyId ? { ...s, published_at: now } : s))
      setSelectedContent(null)
    } else {
      console.error('Publish failed:', error)
    }
    setPublishing(false)
  }

  const handleNewStory = () => {
    sessionStorage.removeItem('briefDraftState')
    sessionStorage.removeItem('aiGenerated')
    router.push('/dashboard/create/content?format=brief')
  }

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    if (tab === 'all') fetchAllStories()
  }

  // ── Derived data ───────────────────────────────────────────────────

  const canDeleteSelectedStory = () => {
    if (!selectedContent || selectedContent.type !== 'story') return false
    if (isInternalTeam) return true
    return stories.some(s => s.id === selectedContent.data.id)
  }

  const getAuthorName = () => {
    if (author?.author_first_name || author?.author_last_name) {
      return `${author.author_first_name || ''} ${author.author_last_name || ''}`.trim()
    }
    return user?.email?.split('@')[0] || 'Author'
  }

  const getAuthorInitials = () => {
    if (author?.author_first_name && author?.author_last_name) {
      return `${author.author_first_name[0]}${author.author_last_name[0]}`.toUpperCase()
    }
    const name = getAuthorName()
    return name[0]?.toUpperCase() || 'A'
  }

  const drafts = useMemo(() => stories.filter(s => !s.published_at), [stories])
  const published = useMemo(() => stories.filter(s => s.published_at), [stories])

  const draftContent: ContentItem[] = useMemo(() => [
    ...drafts.map(s => ({ type: 'story' as const, data: s })),
    ...videoFeeds.filter(v => !v.published_at).map(v => ({ type: 'video' as const, data: v })),
  ].sort((a, b) => new Date(b.data.created_at || 0).getTime() - new Date(a.data.created_at || 0).getTime()), [drafts, videoFeeds])

  const publishedContent: ContentItem[] = useMemo(() => [
    ...published.map(s => ({ type: 'story' as const, data: s })),
    ...videoFeeds.filter(v => v.published_at).map(v => ({ type: 'video' as const, data: v })),
  ].sort((a, b) => new Date(b.data.created_at || 0).getTime() - new Date(a.data.created_at || 0).getTime()), [published, videoFeeds])

  const filteredAllStories = useMemo(() => {
    if (!isInternalTeam) return []
    const q = searchQuery.toLowerCase().trim()
    if (!q) return allStories
    return allStories.filter(s =>
      (s.story_headline || '').toLowerCase().includes(q) ||
      (s.authorName || '').toLowerCase().includes(q)
    )
  }, [allStories, searchQuery, isInternalTeam])

  // ── Loading ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // ── Nav items ──────────────────────────────────────────────────────

  const navItems = [
    { id: 'drafts' as TabId, label: 'Drafts', count: draftContent.length },
    { id: 'published' as TabId, label: 'Published', count: publishedContent.length },
    { id: 'all' as TabId, label: 'All Stories', icon: <Users className="h-3.5 w-3.5" />, visible: isInternalTeam },
  ]

  const greeting = getGreeting()

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex">
      <MobileHeader
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        onNewStory={handleNewStory}
      />

      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onNewStory={handleNewStory}
        onLogout={handleLogout}
        navItems={navItems}
        authorId={author?.id}
        authorName={getAuthorName()}
        authorAvatar={author?.author_avatar}
        authorInitials={getAuthorInitials()}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ── Main Canvas ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <div className="max-w-5xl mx-auto px-6 md:px-8 py-8 md:py-10">

          {/* Greeting + Role badge + Stats */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-foreground text-2xl font-heading">
                {greeting}, {author?.author_first_name || 'there'}.
              </h1>
              {author?.author_role && (
                <span className="px-2.5 py-0.5 rounded-full bg-accent border border-border text-muted-foreground text-[11px] font-mono uppercase tracking-wide">
                  {author.author_role}
                </span>
              )}
            </div>
            <div className="flex items-center gap-5 mt-3">
              {monthlyReaders > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground text-sm font-medium">{monthlyReaders.toLocaleString()}</span>
                  <span className="text-muted-foreground text-xs">readers this month</span>
                </div>
              )}
              {(publishedContent.length > 0) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground text-sm font-medium">{publishedContent.length}</span>
                  <span className="text-muted-foreground text-xs">published</span>
                </div>
              )}
              {quizAccuracy !== null && quizAccuracy > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground text-sm font-medium">{Math.round(quizAccuracy)}%</span>
                  <span className="text-muted-foreground text-xs">quiz accuracy</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Drafts Tab ───────────────────────────────────────── */}
          <TabContent id="drafts" active={activeTab === 'drafts'}>
            {draftContent.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-heading text-card-foreground mb-2">
                  Your desk is clear.
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Start creating your first story to see it here.
                </p>
                <Button onClick={handleNewStory}>
                  <Plus className="h-4 w-4 mr-2" />
                  Start a story
                </Button>
              </Card>
            ) : (
              <>
                <h2 className="text-foreground text-base font-medium mb-4">Continue working</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {draftContent.map((item) => (
                    <ContentCard
                      key={`${item.type}-${item.data.id}`}
                      item={item}
                      onClick={() => setSelectedContent(item)}
                    />
                  ))}
                </div>
              </>
            )}
          </TabContent>

          {/* ── Published Tab ────────────────────────────────────── */}
          <TabContent id="published" active={activeTab === 'published'}>
            {publishedContent.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">Nothing published yet. No rush.</p>
              </Card>
            ) : (
              <>
                <h2 className="text-foreground text-base font-medium mb-4">Published</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {publishedContent.map((item) => (
                    <ContentCard
                      key={`${item.type}-${item.data.id}`}
                      item={item}
                      onClick={() => setSelectedContent(item)}
                    />
                  ))}
                </div>
              </>
            )}
          </TabContent>

          {/* ── All Stories Tab (editors only) ────────────────────── */}
          <TabContent id="all" active={activeTab === 'all' && isInternalTeam}>
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-foreground text-base font-medium">All Stories</h2>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search stories, authors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {filteredAllStories.length} {filteredAllStories.length === 1 ? 'story' : 'stories'}
              </span>
            </div>
            {allStoriesLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading all stories...</div>
            ) : filteredAllStories.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-heading text-card-foreground mb-2">
                  {searchQuery ? 'No stories found' : 'No stories yet'}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {searchQuery
                    ? `No stories matching "${searchQuery}". Try a different search.`
                    : 'Stories from all authors will appear here.'}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAllStories.map((story) => (
                  <Card
                    key={`all-${story.id}`}
                    className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all duration-200"
                    onClick={() => setSelectedContent({ type: 'story', data: story })}
                  >
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {story.coverUrl ? (
                        story.coverMediaType === 'video' ? (
                          <div className="relative w-full h-full">
                            <video src={story.coverUrl} className="w-full h-full object-cover" muted preload="metadata" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <Video className="h-8 w-8 text-white" />
                            </div>
                          </div>
                        ) : (
                          <img src={story.coverUrl} alt={story.story_headline || 'Story cover'} className="w-full h-full object-cover" />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="h-12 w-12 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className={cn(
                        "absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium",
                        story.published_at ? "bg-green-500/90 text-white" : "bg-amber-500/90 text-white"
                      )}>
                        {story.published_at ? 'Published' : 'Draft'}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-heading text-card-foreground line-clamp-2 mb-2">
                        {story.story_headline || 'Untitled Story'}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Users className="h-3 w-3" />
                        <span>{story.authorName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(story.published_at || story.created_at)}
                        {story.slides && (
                          <>
                            <span className="text-muted-foreground/50">·</span>
                            <span>{story.slides.length} slides</span>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabContent>

        </div>
      </main>

      {/* ── Preview Modal (unchanged) ────────────────────────────── */}
      {selectedContent && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => { setSelectedContent(null); setDeleteConfirmId(null) }}
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
              <Button variant="ghost" size="icon" onClick={() => setSelectedContent(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
              {selectedContent.type === 'story' ? (
                <div>
                  {selectedContent.data.coverUrl && (
                    <div className="aspect-video bg-muted">
                      {selectedContent.data.coverMediaType === 'video' ? (
                        <video src={selectedContent.data.coverUrl} controls muted className="w-full h-full object-cover" />
                      ) : (
                        <img src={selectedContent.data.coverUrl} alt="Story cover" className="w-full h-full object-cover" />
                      )}
                    </div>
                  )}
                  <div className="p-6">
                    <h2 className="text-2xl font-heading text-card-foreground mb-4">
                      {selectedContent.data.story_headline || 'Untitled Story'}
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                      {selectedContent.data.authorName && (
                        <div className="flex items-center gap-1"><Users className="h-4 w-4" />{selectedContent.data.authorName}</div>
                      )}
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
                          ? "bg-success/10 text-success dark:bg-success/20 dark:text-success"
                          : "bg-secondary/20 text-secondary-foreground dark:bg-secondary/30 dark:text-secondary"
                      )}>
                        {selectedContent.data.published_at ? 'Published' : 'Draft'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {selectedContent.data.videoUrl ? (
                    <div className="bg-black">
                      <video src={selectedContent.data.videoUrl} poster={selectedContent.data.posterUrl} controls className="w-full max-h-[400px]" />
                    </div>
                  ) : selectedContent.data.posterUrl ? (
                    <div className="aspect-video bg-muted">
                      <img src={selectedContent.data.posterUrl} alt="Video poster" className="w-full h-full object-cover" />
                    </div>
                  ) : null}
                  <div className="p-6">
                    <h2 className="text-2xl font-heading text-card-foreground mb-2">
                      {selectedContent.data.headline || 'Untitled Video'}
                    </h2>
                    {selectedContent.data.caption && (
                      <p className="text-muted-foreground mb-4">{selectedContent.data.caption}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(selectedContent.data.published_at || selectedContent.data.created_at)}
                      </div>
                      <div className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        selectedContent.data.published_at
                          ? "bg-success/10 text-success dark:bg-success/20 dark:text-success"
                          : "bg-secondary/20 text-secondary-foreground dark:bg-secondary/30 dark:text-secondary"
                      )}>
                        {selectedContent.data.published_at ? 'Published' : 'Draft'}
                      </div>
                    </div>
                    {selectedContent.data.videoUrl && (
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Video URL</div>
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
            <div className="p-4 border-t border-border flex items-center justify-between">
              <div>
                {selectedContent.type === 'story' && canDeleteSelectedStory() && (
                  deleteConfirmId === selectedContent.data.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-destructive">Delete this story?</span>
                      <Button variant="destructive" size="sm" disabled={deleting} onClick={() => handleDeleteStory(selectedContent.data.id)}>
                        {deleting ? 'Deleting...' : 'Yes, delete'}
                      </Button>
                      <Button variant="ghost" size="sm" disabled={deleting} onClick={() => setDeleteConfirmId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => setDeleteConfirmId(selectedContent.data.id)}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )
                )}
              </div>
              <div className="flex gap-2">
                {selectedContent.type === 'story' && !selectedContent.data.published_at ? (
                  <Button disabled={publishing} className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => handlePublishStory(selectedContent.data.id)}>
                    {publishing ? 'Publishing...' : 'Publish'}
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => { setSelectedContent(null); setDeleteConfirmId(null) }}>
                    Close
                  </Button>
                )}
                {selectedContent.type === 'story' && (
                  <Button onClick={() => {
                    setSelectedContent(null)
                    setDeleteConfirmId(null)
                    router.push(`/dashboard/create/content?format=brief&storyId=${selectedContent.data.id}`)
                  }}>
                    Edit Story
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// ── Content Card (reusable) ──────────────────────────────────────────────────

function ContentCard({ item, onClick }: { item: ContentItem; onClick: () => void }) {
  return (
    <Card
      className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all duration-200"
      onClick={onClick}
    >
      <div className="aspect-video bg-muted relative overflow-hidden">
        {item.type === 'story' && item.data.coverUrl ? (
          item.data.coverMediaType === 'video' ? (
            <div className="relative w-full h-full">
              <video src={item.data.coverUrl} className="w-full h-full object-cover" muted preload="metadata" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Video className="h-8 w-8 text-white" />
              </div>
            </div>
          ) : (
            <img src={item.data.coverUrl} alt={item.data.story_headline || 'Story cover'} className="w-full h-full object-cover" />
          )
        ) : item.type === 'video' && item.data.posterUrl ? (
          <img src={item.data.posterUrl} alt={item.data.headline || 'Video poster'} className="w-full h-full object-cover" />
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
          item.type === 'story' ? "bg-blue-500/90 text-white" : "bg-purple-500/90 text-white"
        )}>
          {item.type === 'story' ? 'Brief' : 'Video'}
        </div>

        {/* Status badge */}
        <div className={cn(
          "absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium",
          item.data.published_at ? "bg-green-500/90 text-white" : "bg-amber-500/90 text-white"
        )}>
          {item.data.published_at ? 'Published' : 'Draft'}
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-heading text-card-foreground line-clamp-2 mb-2">
          {item.type === 'story'
            ? item.data.story_headline || 'Untitled Story'
            : item.data.headline || 'Untitled Video'}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {formatDate(item.data.published_at || item.data.created_at)}
          {item.type === 'story' && item.data.slides && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span>{item.data.slides.length} slides</span>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
