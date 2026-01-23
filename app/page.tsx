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
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg p-8 shadow-xl">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-black dark:bg-black rounded-xl flex items-center justify-center p-3">
              <Logo width={48} height={48} />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8 space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Welcome to NewsReel!
            </h1>
            <p className="text-sm text-muted-foreground">
              Log in to your NewsReel account
            </p>
          </div>

          {/* Login Form */}
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
