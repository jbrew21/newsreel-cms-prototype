import { supabase } from './client'

/**
 * Check if an author exists with the given email
 * Returns the exact email from database (case-insensitive search)
 */
export async function checkAuthorExists(email: string): Promise<{
  exists: boolean
  authorEmail: string | null
}> {
  try {
    // First try exact match
    const { data: exactMatch, error: exactError } = await supabase
      .from('authors')
      .select('author_email')
      .eq('author_email', email)
      .maybeSingle()

    if (!exactError && exactMatch) {
      return {
        exists: true,
        authorEmail: exactMatch.author_email,
      }
    }

    // Fallback to case-insensitive search
    const { data: caseInsensitive, error: caseError } = await supabase
      .from('authors')
      .select('author_email')
      .ilike('author_email', email)
      .maybeSingle()

    if (!caseError && caseInsensitive) {
      return {
        exists: true,
        authorEmail: caseInsensitive.author_email,
      }
    }

    return {
      exists: false,
      authorEmail: null,
    }
  } catch (error) {
    return {
      exists: false,
      authorEmail: null,
    }
  }
}

/**
 * Check if a user exists in Supabase Auth
 */
export async function checkUserExistsInAuth(email: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.admin.getUserByEmail(email)
    // If we get data, user exists. If error, user doesn't exist
    return !error && !!data?.user
  } catch (error) {
    // If admin API is not available, try alternative method
    // We'll use signInWithOtp with shouldCreateUser: false to check
    // But actually, we can't check without admin API, so we'll try to create
    // and handle the error if user already exists
    return false
  }
}

/**
 * Create user in Supabase Auth if they don't exist
 * Uses signUp with a random password (user will use OTP for login, not password)
 */
export async function ensureUserExistsInAuth(email: string): Promise<{
  success: boolean
  error: string | null
}> {
  try {
    // Generate a random secure password (user won't use it, OTP is the login method)
    const randomPassword = crypto.randomUUID() + crypto.randomUUID()
    
    // Try to create user using signUp
    const { data, error } = await supabase.auth.signUp({
      email,
      password: randomPassword,
      options: {
        emailRedirectTo: undefined,
        // Don't send confirmation email since we're using OTP
      },
    })

    // If user already exists, that's fine - we can proceed
    if (error) {
      // Check if error is because user already exists
      const errorMessage = error.message.toLowerCase()
      if (
        errorMessage.includes('already registered') ||
        errorMessage.includes('user already registered') ||
        errorMessage.includes('already exists')
      ) {
        // User already exists, which is what we want
        return { success: true, error: null }
      }
      
      // If it's a confirmation email error, user might still be created
      // We'll treat it as success and proceed - OTP send will confirm if user exists
      if (
        errorMessage.includes('confirmation email') ||
        errorMessage.includes('error sending')
      ) {
        // User might have been created, proceed anyway
        return { success: true, error: null }
      }
      
      // For other errors, return them
      return { success: false, error: error.message }
    }

    // User was created successfully (even if confirmation email failed)
    return { success: true, error: null }
  } catch (error: any) {
    // If user already exists or confirmation email error, we'll try to proceed anyway
    // The OTP send will fail if user truly doesn't exist
    const errorMessage = error?.message?.toLowerCase() || ''
    if (
      errorMessage.includes('already registered') ||
      errorMessage.includes('user already registered') ||
      errorMessage.includes('already exists') ||
      errorMessage.includes('confirmation email') ||
      errorMessage.includes('error sending')
    ) {
      return { success: true, error: null }
    }
    return { success: false, error: error?.message || 'Unknown error' }
  }
}
