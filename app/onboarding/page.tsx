'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/brand/logo'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Camera, ImageIcon, Loader2, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const AVATAR_BUCKET = 'author-avatars'
const COVER_BUCKET = 'author-covers'

interface FormData {
  author_first_name: string
  author_last_name: string
  author_bio: string
  author_role: string
  author_organization: string
  author_twitter: string
  author_linked_in: string
}

interface FormErrors {
  author_first_name?: string
  author_last_name?: string
  author_bio?: string
  author_role?: string
  author_organization?: string
  avatar?: string
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  )
}

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isEditMode = searchParams.get('edit') === 'true'
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [user, setUser] = useState<any>(null)
  const [authorId, setAuthorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isFirstLogin, setIsFirstLogin] = useState(true)

  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState<FormData>({
    author_first_name: '',
    author_last_name: '',
    author_bio: '',
    author_role: '',
    author_organization: '',
    author_twitter: '',
    author_linked_in: '',
  })

  const [errors, setErrors] = useState<FormErrors>({})

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

      // Check if author exists and if it's first login
      if (user.email) {
        const { data: authorData, error } = await supabase
          .from('authors')
          .select('*')
          .eq('author_email', user.email)
          .maybeSingle()

        if (!error && authorData) {
          // If not first login and not in edit mode, redirect to dashboard
          if (!authorData.is_first_login && !isEditMode) {
            router.push('/dashboard')
            return
          }
          setIsFirstLogin(authorData.is_first_login ?? true)
          setAuthorId(authorData.id)
          // Pre-fill any existing data
          setFormData({
            author_first_name: authorData.author_first_name || '',
            author_last_name: authorData.author_last_name || '',
            author_bio: authorData.author_bio || '',
            author_role: authorData.author_role || '',
            author_organization: authorData.author_organization || '',
            author_twitter: authorData.author_twitter || '',
            author_linked_in: authorData.author_linked_in || '',
          })
          if (authorData.author_avatar) {
            setAvatarPreview(authorData.author_avatar)
          }
          if (authorData.author_cover) {
            setCoverPreview(authorData.author_cover)
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

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user types
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, avatar: 'Please select an image file' }))
        return
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, avatar: 'Image must be less than 5MB' }))
        return
      }

      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
      setErrors(prev => ({ ...prev, avatar: undefined }))
    }
  }

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        return
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return
      }

      setCoverFile(file)
      setCoverPreview(URL.createObjectURL(file))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.author_first_name.trim()) {
      newErrors.author_first_name = 'First name is required'
    }
    if (!formData.author_last_name.trim()) {
      newErrors.author_last_name = 'Last name is required'
    }
    if (!formData.author_bio.trim()) {
      newErrors.author_bio = 'Bio is required'
    }
    if (!formData.author_role.trim()) {
      newErrors.author_role = 'Role is required'
    }
    if (!formData.author_organization.trim()) {
      newErrors.author_organization = 'Organization is required'
    }
    if (!avatarFile && !avatarPreview) {
      newErrors.avatar = 'Profile photo is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm() || !authorId || !user?.email) return

    setSubmitting(true)

    try {
      let avatarUrl = avatarPreview

      // Upload avatar if new file selected
      if (avatarFile) {
        // Use email as filename (sanitize it)
        const sanitizedEmail = user.email.replace(/[^a-zA-Z0-9]/g, '_')
        const fileExt = avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const avatarPath = `${sanitizedEmail}.${fileExt}`

        // Upload to author-avatars bucket
        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(avatarPath, avatarFile, { upsert: true })

        if (uploadError) {
          throw new Error(`Failed to upload avatar: ${uploadError.message}`)
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(AVATAR_BUCKET)
          .getPublicUrl(avatarPath)

        avatarUrl = urlData.publicUrl
      }

      let coverUrl = coverPreview

      // Upload cover if new file selected
      if (coverFile) {
        const sanitizedEmail = user.email.replace(/[^a-zA-Z0-9]/g, '_')
        const fileExt = coverFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const coverPath = `${sanitizedEmail}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from(COVER_BUCKET)
          .upload(coverPath, coverFile, { upsert: true })

        if (uploadError) {
          throw new Error(`Failed to upload cover: ${uploadError.message}`)
        }

        const { data: urlData } = supabase.storage
          .from(COVER_BUCKET)
          .getPublicUrl(coverPath)

        coverUrl = urlData.publicUrl
      }

      // Update author record
      const { error: updateError } = await supabase
        .from('authors')
        .update({
          author_first_name: formData.author_first_name.trim(),
          author_last_name: formData.author_last_name.trim(),
          author_bio: formData.author_bio.trim(),
          author_role: formData.author_role.trim(),
          author_organization: formData.author_organization.trim(),
          author_twitter: formData.author_twitter.trim() || null,
          author_linked_in: formData.author_linked_in.trim() || null,
          author_avatar: avatarUrl,
          author_cover: coverUrl,
          is_first_login: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', authorId)

      if (updateError) {
        throw new Error(`Failed to update profile: ${updateError.message}`)
      }

      // Redirect to dashboard
      router.push('/dashboard')

    } catch (error) {
      console.error('Error saving profile:', error)
      alert(error instanceof Error ? error.message : 'Failed to save profile')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo width={64} height={64} />
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {isFirstLogin ? 'Welcome to Newsreel' : 'Edit Your Profile'}
          </h1>
          <p className="text-muted-foreground">
            {isFirstLogin
              ? "Let's set up your author profile before you start creating stories."
              : 'Update your author profile information.'}
          </p>
        </div>

        <Card className="p-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center mb-8">
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "w-28 h-28 rounded-full flex items-center justify-center cursor-pointer",
                "border-2 border-dashed transition-colors overflow-hidden",
                errors.avatar
                  ? "border-destructive bg-destructive/10"
                  : "border-border hover:border-primary bg-muted"
              )}
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center text-muted-foreground">
                  <Camera className="h-8 w-8 mb-1" />
                  <span className="text-xs">Upload</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              className="hidden"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Profile Photo <span className="text-destructive">*</span>
            </p>
            {errors.avatar && (
              <p className="text-sm text-destructive mt-1">{errors.avatar}</p>
            )}
          </div>

          {/* Cover Upload */}
          <div className="mb-8">
            <div
              onClick={() => coverInputRef.current?.click()}
              className={cn(
                "w-full h-32 rounded-lg flex items-center justify-center cursor-pointer",
                "border-2 border-dashed transition-colors overflow-hidden",
                "border-border hover:border-primary bg-muted"
              )}
            >
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8 mb-1" />
                  <span className="text-xs">Upload Cover Image</span>
                </div>
              )}
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverSelect}
              className="hidden"
            />
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Cover Image (Optional)
            </p>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            {/* Name Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="first_name"
                  value={formData.author_first_name}
                  onChange={(e) => handleInputChange('author_first_name', e.target.value)}
                  placeholder="John"
                  className={cn(errors.author_first_name && "border-destructive")}
                />
                {errors.author_first_name && (
                  <p className="text-sm text-destructive mt-1">{errors.author_first_name}</p>
                )}
              </div>
              <div>
                <Label htmlFor="last_name">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="last_name"
                  value={formData.author_last_name}
                  onChange={(e) => handleInputChange('author_last_name', e.target.value)}
                  placeholder="Doe"
                  className={cn(errors.author_last_name && "border-destructive")}
                />
                {errors.author_last_name && (
                  <p className="text-sm text-destructive mt-1">{errors.author_last_name}</p>
                )}
              </div>
            </div>

            {/* Role & Organization Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">
                  Role <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="role"
                  value={formData.author_role}
                  onChange={(e) => handleInputChange('author_role', e.target.value)}
                  placeholder="Fellow, Editor, Contributor..."
                  className={cn(errors.author_role && "border-destructive")}
                />
                {errors.author_role && (
                  <p className="text-sm text-destructive mt-1">{errors.author_role}</p>
                )}
              </div>
              <div>
                <Label htmlFor="organization">
                  Organization <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="organization"
                  value={formData.author_organization}
                  onChange={(e) => handleInputChange('author_organization', e.target.value)}
                  placeholder="Newsreel"
                  className={cn(errors.author_organization && "border-destructive")}
                />
                {errors.author_organization && (
                  <p className="text-sm text-destructive mt-1">{errors.author_organization}</p>
                )}
              </div>
            </div>

            {/* Bio */}
            <div>
              <Label htmlFor="bio">
                Bio <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="bio"
                value={formData.author_bio}
                onChange={(e) => handleInputChange('author_bio', e.target.value)}
                placeholder="Tell readers about yourself..."
                rows={4}
                className={cn(errors.author_bio && "border-destructive")}
              />
              {errors.author_bio && (
                <p className="text-sm text-destructive mt-1">{errors.author_bio}</p>
              )}
            </div>

            {/* Social Links (Optional) */}
            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-4">
                Social Links (Optional)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="twitter">Twitter URL</Label>
                  <Input
                    id="twitter"
                    value={formData.author_twitter}
                    onChange={(e) => handleInputChange('author_twitter', e.target.value)}
                    placeholder="https://twitter.com/username"
                  />
                </div>
                <div>
                  <Label htmlFor="linkedin">LinkedIn URL</Label>
                  <Input
                    id="linkedin"
                    value={formData.author_linked_in}
                    onChange={(e) => handleInputChange('author_linked_in', e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full"
                size="lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : isFirstLogin ? (
                  'Complete Profile & Continue'
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  )
}
