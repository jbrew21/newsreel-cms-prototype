'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft, Users, BookOpen, Target, Mail, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface AuthorProfile {
  id: string
  author_first_name: string | null
  author_last_name: string | null
  author_bio: string | null
  author_email: string | null
  author_role: string | null
  author_organization: string | null
  author_avatar: string | null
  author_cover: string | null
  author_twitter: string | null
  author_linked_in: string | null
  created_at: string | null
}

interface AuthorStats {
  monthlyReaders: number
  totalStories: number
  quizAccuracy: number | null
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AuthorProfilePage() {
  const router = useRouter()
  const params = useParams()
  const authorId = params.id as string

  const [author, setAuthor] = useState<AuthorProfile | null>(null)
  const [stats, setStats] = useState<AuthorStats>({ monthlyReaders: 0, totalStories: 0, quizAccuracy: null })
  const [loading, setLoading] = useState(true)
  const [bioExpanded, setBioExpanded] = useState(false)

  useEffect(() => {
    if (authorId) fetchAuthorProfile()
  }, [authorId])

  const fetchAuthorProfile = async () => {
    try {
      // Verify user is logged in
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      // Fetch author data
      const { data: authorData, error } = await supabase
        .from('authors')
        .select('*')
        .eq('id', authorId)
        .maybeSingle()

      if (error || !authorData) {
        router.push('/dashboard')
        return
      }

      setAuthor(authorData)

      // Fetch stats
      const { data: storyLinks } = await supabase
        .from('authors_stories_links')
        .select('story_id')
        .eq('author_id', authorId)

      if (storyLinks && storyLinks.length > 0) {
        const storyIds = storyLinks.map(link => link.story_id)

        const now = new Date()
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        const monthEnd = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`

        const [readersRes, accuracyRes, storiesRes] = await Promise.all([
          supabase.rpc('get_author_monthly_readers', { story_ids: storyIds, month_start: monthStart, month_end: monthEnd }),
          supabase.rpc('get_author_quiz_accuracy', { story_ids: storyIds }),
          supabase.from('stories').select('id, published_at').in('id', storyIds),
        ])

        setStats({
          monthlyReaders: typeof readersRes.data === 'number' ? readersRes.data : 0,
          totalStories: storiesRes.data?.length || 0,
          quizAccuracy: accuracyRes.data !== null && accuracyRes.data !== undefined ? Number(accuracyRes.data) : null,
        })
      }
    } catch (error) {
      console.error('Error fetching author profile:', error)
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!author) return null

  // ── Helpers ────────────────────────────────────────────────────────

  const fullName = `${author.author_first_name || ''} ${author.author_last_name || ''}`.trim() || 'Author'
  const subtitle = author.author_role && author.author_organization
    ? `${author.author_role} at ${author.author_organization}`
    : author.author_role || author.author_organization || ''
  const initials = (author.author_first_name?.[0] || '') + (author.author_last_name?.[0] || '')
  const bio = author.author_bio || ''
  const bioIsLong = bio.length > 200
  const displayBio = bioExpanded || !bioIsLong ? bio : bio.slice(0, 200) + '...'
  const isNewsreelTeam = author.author_email?.endsWith('@newsreel.co')

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Cover image area */}
      <div className="relative w-full h-[40vh] min-h-[280px] max-h-[480px] bg-muted overflow-hidden">
        {author.author_cover ? (
          <img
            src={author.author_cover}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/10 via-accent to-primary/5" />
        )}

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center hover:bg-background transition-all duration-200 shadow-sm"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
      </div>

      {/* Profile content */}
      <div className="max-w-3xl mx-auto px-6 md:px-8 mt-6 relative">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-heading text-foreground flex items-center gap-2">
              {fullName}
              {isNewsreelTeam && (
                <svg className="h-5 w-5 text-primary flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              )}
            </h1>
            {subtitle && (
              <p className="text-muted-foreground text-base mt-1">{subtitle}</p>
            )}
          </div>

          {/* Avatar */}
          <div className="flex-shrink-0 -mt-16">
            {author.author_avatar ? (
              <img
                src={author.author_avatar}
                alt={fullName}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-background shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/20 ring-4 ring-background shadow-lg flex items-center justify-center text-xl font-bold text-primary">
                {initials.toUpperCase() || 'A'}
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {stats.monthlyReaders > 0 && (
            <StatBadge icon={<Users className="h-3.5 w-3.5" />} value={stats.monthlyReaders.toLocaleString()} label="Readers this month" />
          )}
          {stats.totalStories > 0 && (
            <StatBadge icon={<BookOpen className="h-3.5 w-3.5" />} value={stats.totalStories.toString()} label="Stories" />
          )}
          {stats.quizAccuracy !== null && stats.quizAccuracy > 0 && (
            <StatBadge icon={<Target className="h-3.5 w-3.5" />} value={`${Math.round(stats.quizAccuracy)}%`} label="Quiz Accuracy" />
          )}
        </div>

        {/* Social links */}
        <div className="flex items-center gap-3 mb-6">
          {author.author_email && (
            <a
              href={`mailto:${author.author_email}`}
              className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-all duration-200"
              aria-label="Email"
            >
              <Mail className="h-4 w-4" />
            </a>
          )}
          {author.author_twitter && (
            <a
              href={author.author_twitter.startsWith('http') ? author.author_twitter : `https://${author.author_twitter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-all duration-200"
              aria-label="Twitter"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </a>
          )}
          {author.author_linked_in && (
            <a
              href={author.author_linked_in.startsWith('http') ? author.author_linked_in : `https://${author.author_linked_in}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-all duration-200"
              aria-label="LinkedIn"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
            </a>
          )}
        </div>

        {/* Bio */}
        {bio && (
          <div className="mb-8">
            <p className="text-foreground text-base leading-relaxed">
              {displayBio}
            </p>
            {bioIsLong && (
              <button
                onClick={() => setBioExpanded(!bioExpanded)}
                className="text-primary text-sm mt-1 hover:underline transition-colors duration-200"
              >
                {bioExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Joined date */}
        {author.created_at && (
          <p className="text-muted-foreground text-xs mb-12">
            Joined {new Date(author.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Stat Badge (reusable) ────────────────────────────────────────────────────

function StatBadge({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-full border border-border bg-card text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-semibold text-foreground">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}
