'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
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

type FormatType = 'brief' | 'vertical-video' | 'carousel' | null

export default function CreateStoryPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [author, setAuthor] = useState<Author | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedFormat, setSelectedFormat] = useState<FormatType>(null)

  useEffect(() => {
    // Skip format selection — redirect to brief content directly
    sessionStorage.removeItem('briefDraftState')
    sessionStorage.removeItem('aiGenerated')
    router.replace('/dashboard/create/content?format=brief')
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

  const getAuthorName = () => {
    if (author?.author_first_name || author?.author_last_name) {
      return `${author.author_first_name || ''} ${author.author_last_name || ''}`.trim()
    }
    return user?.email?.split('@')[0] || 'Author'
  }

  const handleContinue = () => {
    if (selectedFormat) {
      // Clear any previous AI-generated or stale draft state for a fresh canvas
      sessionStorage.removeItem('briefDraftState')
      sessionStorage.removeItem('aiGenerated')
      // Navigate to Content step
      router.push(`/dashboard/create/content?format=${selectedFormat}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const formats = [
    {
      id: 'brief' as FormatType,
      title: 'Brief',
      subtitle: 'Structured Newsreel story',
      description: 'A deeper story built in Newsreel standard slide format, with editorial layout handled for you.',
    },
    {
      id: 'vertical-video' as FormatType,
      title: 'Vertical Video',
      subtitle: 'Single video',
      description: 'Single vertical video that auto-plays on scroll with optional captions',
    },
    {
      id: 'carousel' as FormatType,
      title: 'Carousel',
      subtitle: 'Swipeable story',
      description: 'A short, finite set of slides that explains one idea clearly. Slides can include images, video clips, or text.',
    },
  ]

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
                onClick={() => router.push('/dashboard')}
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground text-sm font-bold">N</span>
                </div>
                <h1 className="text-xl font-heading text-foreground">New Post</h1>
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
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                "bg-primary text-primary-foreground"
              )}>
                Format
              </div>
              <div className="h-px w-8 bg-border" />
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                "text-muted-foreground"
              )}>
                Content
              </div>
              <div className="h-px w-8 bg-border" />
            </div>
            <div className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              "text-muted-foreground"
            )}>
              Response
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 pb-24">
        <div className="max-w-3xl mx-auto">
          <Card className="p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-heading text-card-foreground mb-2">
                Choose format.
              </h2>
              <p className="text-muted-foreground">
                Select the type of post you want to create.
              </p>
            </div>

            <div className="space-y-0">
              {formats.map((format, index) => (
                <div key={format.id}>
                  {index > 0 && <div className="border-t border-border my-0" />}
                  <button
                    type="button"
                    onClick={() => setSelectedFormat(format.id)}
                    className={cn(
                      "w-full text-left p-6 rounded-lg transition-all",
                      "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      selectedFormat === format.id && "bg-accent"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-heading text-card-foreground">
                            {format.title}
                          </h3>
                          <span className="text-sm text-muted-foreground">
                            {format.subtitle}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format.description}
                        </p>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center ml-4 transition-all",
                        selectedFormat === format.id
                          ? "border-primary bg-primary"
                          : "border-border"
                      )}>
                        {selectedFormat === format.id && (
                          <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                    </div>
                  </button>
                </div>
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
              disabled={!selectedFormat}
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
