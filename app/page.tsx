import { LoginForm } from '@/components/auth/login-form'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Logo } from '@/components/brand/logo'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative">
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Centered Login Card */}
      <div className="w-full max-w-lg">
        <div className="bg-card border border-border rounded-lg p-8 shadow-xl">
          {/* Brand Header */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-3xl italic text-foreground" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              Benny
            </h1>
            <span className="text-muted-foreground text-lg italic" style={{ fontFamily: 'var(--font-playfair), serif' }}>by</span>
            <Logo width={72} height={72} />
          </div>
          <div className="text-center mb-8">
            <p className="text-sm italic text-muted-foreground" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              The content management system for Newsreel contributors
            </p>
          </div>

          {/* Login Form */}
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
