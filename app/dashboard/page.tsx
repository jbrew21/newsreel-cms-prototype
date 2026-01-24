'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LogOut, Plus } from 'lucide-react'
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

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [author, setAuthor] = useState<Author | null>(null)
  const [loading, setLoading] = useState(true)

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
        }
      }
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/')
    } finally {
      setLoading(false)
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

  // Dashboard metrics (using dummy/0 values as requested)
  const storiesContributed = 0
  const readersReached = 0
  const completionRate = 0
  const medianTimeSpent = '0s'
  const reactions = 0
  const quizResponses = 0
  const pollResponses = 0

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
              This is the working version of Newsreel's posting system. Expect rough edges. Your feedback shapes what stays.
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
              {storiesContributed}
            </div>
            <div className="text-sm text-muted-foreground uppercase tracking-wide">
              Stories Contributed
            </div>
          </Card>

          {/* Readers Reached Card */}
          <Card className="p-6 flex flex-col justify-center items-center">
            <div className="text-4xl font-bold text-card-foreground mb-2">
              {readersReached === 0 ? '0' : `${(readersReached / 1000).toFixed(1)}K`}
            </div>
            <div className="text-sm text-muted-foreground uppercase tracking-wide">
              Readers Reached
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Across all stories
            </div>
          </Card>
        </div>

        {/* Story Performance Section */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Story Performance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Completion Rate */}
            <Card className="p-6">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Completion Rate
              </div>
              <div className="text-3xl font-bold text-card-foreground mb-1">
                {completionRate}%
              </div>
              <div className="text-xs text-muted-foreground">
                % who finish stories
              </div>
            </Card>

            {/* Median Time Spent */}
            <Card className="p-6">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Median Time Spent
              </div>
              <div className="text-3xl font-bold text-card-foreground mb-1">
                {medianTimeSpent}
              </div>
              <div className="text-xs text-muted-foreground">
                Per story
              </div>
            </Card>

            {/* Reactions */}
            <Card className="p-6">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Reactions
              </div>
              <div className="text-3xl font-bold text-card-foreground mb-1">
                {reactions}
              </div>
              <div className="text-xs text-muted-foreground">
                Total reactions
              </div>
            </Card>

            {/* Quiz Responses */}
            <Card className="p-6">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Quiz Responses
              </div>
              <div className="text-3xl font-bold text-card-foreground mb-1">
                {quizResponses}
              </div>
              <div className="text-xs text-muted-foreground">
                Avg. score: 0%
              </div>
            </Card>

            {/* Poll Responses */}
            <Card className="p-6">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Poll Responses
              </div>
              <div className="text-3xl font-bold text-card-foreground mb-1">
                {pollResponses}
              </div>
              <div className="text-xs text-muted-foreground">
                Total poll responses
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
