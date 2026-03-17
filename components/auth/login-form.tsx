'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase/client'
import { checkAuthorExists } from '@/lib/supabase/auth'
import { useRouter } from 'next/navigation'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const router = useRouter()

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { exists, authorEmail } = await checkAuthorExists(email)

      if (!exists || !authorEmail) {
        setError('No account found with this email address.')
        setIsLoading(false)
        return
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: authorEmail,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setIsLoading(false)
        return
      }

      if (data.user) {
        router.push('/dashboard')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { exists, authorEmail } = await checkAuthorExists(email)

      if (!exists || !authorEmail) {
        setError('No account found with this email address.')
        setIsLoading(false)
        return
      }

      setUserEmail(authorEmail)

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: authorEmail,
        options: {
          shouldCreateUser: true,
        },
      })

      if (otpError) {
        setError(otpError.message)
        setIsLoading(false)
        return
      }

      setStep('otp')
      setError(null)
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // Hardcoded OTP for brijesh@newsreel.co (accepts 6 or 8 digits)
      const isHardcodedOTP = userEmail.toLowerCase() === 'brijesh@newsreel.co' && (otp === '123456' || otp === '12345678')

      if (isHardcodedOTP) {
        // Bypass verification for hardcoded OTP
        router.push('/dashboard')
        return
      }

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: userEmail,
        token: otp,
        type: 'email',
      })

      if (verifyError) {
        setError(verifyError.message)
        setIsLoading(false)
        return
      }

      if (data.user) {
        router.push('/dashboard')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (step === 'otp') {
    return (
      <form onSubmit={handleVerifyOTP} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="otp" className="text-sm font-medium text-foreground">
            Enter OTP<span className="text-primary">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            We&apos;ve sent a code to {userEmail}
          </p>
          <Input
            id="otp"
            type="text"
            placeholder="Enter verification code"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
            maxLength={8}
            required
            disabled={isLoading}
            className="h-11 bg-background border-input text-foreground placeholder:text-muted-foreground text-center text-2xl tracking-widest"
            autoFocus
          />
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11 text-base font-medium"
          disabled={isLoading || otp.length < 6}
        >
          {isLoading ? 'Verifying...' : 'Verify OTP'}
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setStep('email')
              setOtp('')
              setError(null)
            }}
            className="text-sm text-primary hover:underline font-medium"
          >
            Back to email
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={showPassword ? handlePasswordSignIn : handleSendOTP} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium text-foreground">
          Email<span className="text-primary">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
          className="h-11 bg-background border-input text-foreground placeholder:text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          New here? Just enter your email and we&apos;ll set you up.
        </p>
      </div>

      {showPassword && (
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-foreground">
            Password<span className="text-primary">*</span>
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            className="h-11 bg-background border-input text-foreground placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button
        type="submit"
        className="w-full h-12 text-base font-medium tracking-wide"
        style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
        disabled={isLoading || (showPassword && !password)}
      >
        {isLoading
          ? (showPassword ? 'Signing in...' : 'Sending OTP...')
          : (showPassword ? 'Sign In' : 'Get Started')
        }
      </Button>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setShowPassword(!showPassword)
            setPassword('')
            setError(null)
          }}
          className="text-sm text-muted-foreground underline hover:text-foreground transition-colors"
        >
          {showPassword ? 'use OTP' : 'use password'}
        </button>
      </div>

    </form>
  )
}
