/**
 * Server-only Supabase client using the service role key.
 *
 * ⚠️ CRITICAL: This client BYPASSES Row Level Security.
 * - NEVER import this from a client component
 * - NEVER expose the returned client to the browser
 * - Only use inside API routes (`app/api/.../route.ts`) or server components
 *
 * The service role key is read from `process.env.SUPABASE_SERVICE_ROLE_KEY`.
 * It does NOT use the `NEXT_PUBLIC_` prefix on purpose, so Next.js cannot
 * accidentally bundle it into the browser JavaScript.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedAdminClient: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('[supabase/admin] Missing NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!serviceRoleKey) {
    throw new Error('[supabase/admin] Missing SUPABASE_SERVICE_ROLE_KEY (server-only env var)')
  }

  cachedAdminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: { 'x-client-info': 'newsreel-cms-admin' },
    },
  })

  return cachedAdminClient
}
