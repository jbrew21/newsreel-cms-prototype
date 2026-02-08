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
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Logo width={96} height={96} />
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl italic text-foreground" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              Welcome to Newsreel Contributors
            </h1>
          </div>

          {/* Login Form */}
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
