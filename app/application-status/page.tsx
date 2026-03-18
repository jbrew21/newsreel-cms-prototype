'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Logo } from '@/components/brand/logo'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Clock, XCircle, LogOut, RefreshCw } from 'lucide-react'

export default function ApplicationStatusPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <ApplicationStatusContent />
    </Suspense>
  )
}

function ApplicationStatusContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const status = searchParams.get('status') || 'pending'
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    // Verify user is authenticated
    const verify = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
      }
    }
    verify()
  }, [router])

  const handleCheckStatus = async () => {
    setChecking(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        router.push('/')
        return
      }

      const { data: authorData } = await supabase
        .from('authors')
        .select('application_status')
        .eq('author_email', user.email)
        .maybeSingle()

      if (authorData?.application_status === 'approved') {
        router.push('/dashboard')
      } else if (authorData?.application_status === 'rejected') {
        router.replace('/application-status?status=rejected')
      }
    } catch (error) {
      console.error('Error checking status:', error)
    } finally {
      setChecking(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const isPending = status === 'pending'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo width={64} height={64} />
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-16 max-w-lg">
        <Card className="p-8 text-center">
          {/* Icon */}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
            isPending
              ? 'bg-secondary/10 dark:bg-secondary/20'
              : 'bg-destructive/10 dark:bg-destructive/20'
          }`}>
            {isPending ? (
              <Clock className="h-10 w-10 text-secondary" />
            ) : (
              <XCircle className="h-10 w-10 text-destructive" />
            )}
          </div>

          {/* Status Badge */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wide mb-6 ${
            isPending
              ? 'bg-secondary/10 text-secondary border border-secondary/20 dark:bg-secondary/20 dark:border-secondary/30'
              : 'bg-destructive/10 text-destructive border border-destructive/20 dark:bg-destructive/20 dark:border-destructive/30'
          }`}
            style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isPending ? 'bg-secondary' : 'bg-destructive'}`} />
            {isPending ? 'Under Review' : 'Not Approved'}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-heading text-foreground mb-3">
            {isPending
              ? 'Your application is under review'
              : 'Application not approved'}
          </h1>

          {/* Description */}
          <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-sm mx-auto">
            {isPending
              ? 'Our editorial team is reviewing your profile and credentials. This usually takes 1\u20132 business days. We\u2019ll notify you by email once a decision is made.'
              : 'Unfortunately, your application wasn\u2019t approved at this time. This could be due to incomplete information or not meeting our contributor criteria. Feel free to reach out to our team for more details.'}
          </p>

          {/* Speed up review hint */}
          {isPending && (
            <p className="text-muted-foreground text-xs leading-relaxed mb-8 max-w-sm mx-auto">
              Want a faster decision? Send us your notable work, portfolio, or LinkedIn profile —{' '}
              <a
                href="mailto:jack@newsreel.co?cc=brijesh@newsreel.co&subject=Newsreel%20Contributor%20Application%20%E2%80%94%20Supporting%20Material"
                className="text-primary underline hover:text-primary/80 transition-colors"
              >
                email us
              </a>
              {' '}and we&apos;ll review your application right away.
            </p>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {isPending && (
              <Button
                onClick={handleCheckStatus}
                disabled={checking}
                className="w-full"
                size="lg"
              >
                {checking ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Check Status
                  </>
                )}
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full"
              size="lg"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </Card>

        {/* Help text */}
        <p className="text-center text-xs text-muted-foreground mt-6" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
          Questions? Reach out to{' '}
          <a href="mailto:support@newsreel.co" className="text-primary hover:underline">
            support@newsreel.co
          </a>
        </p>
      </main>
    </div>
  )
}
