import { LoginForm } from '@/components/auth/login-form'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Logo } from '@/components/brand/logo'
import { StaticCanvas } from '@/components/effects/static-canvas'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background relative">
      {/* VHS Static Effect */}
      <StaticCanvas />

      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Hero Section */}
      <div className="flex flex-col items-center pt-12 pb-8 px-4">
        <Logo width={120} height={120} priority />
        <div className="mt-4 px-4 py-1.5 border border-border rounded-full flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
            Contributor
          </span>
        </div>
        <h1
          className="mt-8 text-5xl md:text-7xl text-foreground text-center"
          style={{ fontFamily: 'var(--font-playfair), serif', fontStyle: 'italic' }}
        >
          News for thinkers.
        </h1>
        <p className="mt-4 text-base md:text-lg text-muted-foreground text-center max-w-lg leading-relaxed">
          A vetted network of journalists and creators reaching the most engaged young readers on the internet.
        </p>
      </div>

      {/* Main Content — Form + Features */}
      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-4xl flex flex-col md:flex-row gap-12 md:gap-16 items-start">
          {/* Login Card */}
          <div className="w-full md:w-[420px] shrink-0">
            <div className="bg-card border border-border rounded-lg p-8">
              <LoginForm />
            </div>
          </div>

          {/* Feature List */}
          <div className="flex-1 space-y-8 pt-2">
            <div className="flex gap-4">
              <span className="text-primary font-medium text-sm mt-0.5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>01</span>
              <div>
                <h3 className="text-foreground font-semibold text-base">A real audience</h3>
                <p className="text-muted-foreground text-sm mt-1">12,000+ readers across 200+ classrooms in 38 states and 3 countries.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-primary font-medium text-sm mt-0.5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>02</span>
              <div>
                <h3 className="text-foreground font-semibold text-base">Contributor status</h3>
                <p className="text-muted-foreground text-sm mt-1">A public profile that proves you are human, vetted, and transparent.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-primary font-medium text-sm mt-0.5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>03</span>
              <div>
                <h3 className="text-foreground font-semibold text-base">Smart publishing tools</h3>
                <p className="text-muted-foreground text-sm mt-1">Create interactive stories with quizzes and polls in minutes.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-primary font-medium text-sm mt-0.5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>04</span>
              <div>
                <h3 className="text-foreground font-semibold text-base">Your numbers</h3>
                <p className="text-muted-foreground text-sm mt-1">Monthly reader counts, quiz accuracy, and engagement data.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-8 text-center">
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
          Contributors Include
        </p>
        <p className="text-sm text-muted-foreground italic" style={{ fontFamily: 'var(--font-playfair), serif' }}>
          MediaWise &middot; Open Secrets &middot; Mo News &middot; Dave Jorgenson
        </p>
      </div>
    </div>
  )
}
