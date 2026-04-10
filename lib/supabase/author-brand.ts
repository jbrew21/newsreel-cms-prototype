/**
 * Author brand (publisher branding) helpers.
 *
 * A "brand" is shared by all authors under one email domain — e.g. every
 * author at `newsreel.co` sees the same logo and colors. One row per domain
 * in `author_brands`, one logo per domain in the `author-brand` bucket.
 *
 * All writes are gated by Postgres RLS: only authors whose authenticated
 * email domain matches the row can insert/update. This file is a thin,
 * well-typed wrapper around that contract — no business logic lives here
 * beyond input normalization and storage path construction.
 */

import { supabase } from './client'
import { getPublicUrl } from './storage'
import type { AuthorBrand } from './types'

// ─── Constants ───────────────────────────────────────────────────────────────

export const BRAND_BUCKET = 'author-brand'

/**
 * The Newsreel publisher's own domain. Its `author_brands` row is the
 * house fallback: any author without their own brand renders the logo and
 * colors stored here. This is a DB row, not code — changing the Newsreel
 * look means uploading a new logo through the same modal every other
 * publisher uses. No local files, no hardcoded logo paths.
 */
export const NEWSREEL_HOUSE_DOMAIN = 'newsreel.co'

/**
 * Absolute-last-resort hex colors, used only if BOTH the author's row and
 * the Newsreel house row are somehow missing from the DB. Never references
 * any local logo — the logo simply won't render in that degenerate case.
 * These exist only so slide color styles never resolve to `undefined`.
 */
const SAFETY_COLORS = {
  primary: '#FF6343',
  secondary: '#1E3A5F',
} as const

/**
 * Generic email providers that cannot own a publisher brand. Authors on
 * these domains share the root domain with unrelated strangers, so keying
 * a shared brand on them would let anyone stomp on everyone else's logo.
 * If an author wants branding, they need a work email.
 */
const GENERIC_EMAIL_DOMAINS = new Set<string>([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'gmx.com',
  'zoho.com',
  'yandex.com',
  'mail.com',
])

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

// ─── Domain utilities ────────────────────────────────────────────────────────

/**
 * Extract the lowercase domain from an email, or null if the input is
 * malformed. Does NOT filter generic providers — callers decide what to do
 * with e.g. "gmail.com" via {@link isGenericDomain}.
 */
export function getDomainFromEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.lastIndexOf('@')
  if (at === -1 || at === trimmed.length - 1) return null
  const domain = trimmed.slice(at + 1)
  if (!domain || domain.includes(' ') || !domain.includes('.')) return null
  return domain
}

/**
 * True if the given domain is a generic email provider (gmail, yahoo, etc.)
 * and therefore cannot own a shared publisher brand.
 */
export function isGenericDomain(domain: string | null | undefined): boolean {
  if (!domain) return false
  return GENERIC_EMAIL_DOMAINS.has(domain.toLowerCase())
}

/**
 * Convenience: resolve the branding domain for an author email, or null if
 * the author is on a generic provider or the email is invalid. Use this
 * anywhere you need to decide "can this user have a brand?"
 */
export function resolveBrandDomain(email: string | null | undefined): string | null {
  const domain = getDomainFromEmail(email)
  if (!domain || isGenericDomain(domain)) return null
  return domain
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function isValidHexColor(value: string | null | undefined): value is string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value)
}

/**
 * Normalize a hex string to the canonical `#RRGGBB` uppercase form.
 * Returns null if input isn't a valid 6-digit hex.
 */
export function normalizeHexColor(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (!HEX_COLOR_RE.test(withHash)) return null
  return withHash.toUpperCase()
}

/**
 * Convert a `#RRGGBB` hex color to an rgba() string with the given alpha.
 * Defaults to opaque black if the input is malformed — callers should have
 * already validated via {@link isValidHexColor}, but this stays defensive so
 * a bad DB value can never crash a slide render.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const normalized = normalizeHexColor(hex)
  if (!normalized) return `rgba(0, 0, 0, ${alpha})`
  const r = parseInt(normalized.slice(1, 3), 16)
  const g = parseInt(normalized.slice(3, 5), 16)
  const b = parseInt(normalized.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ─── Display resolution ──────────────────────────────────────────────────────

/**
 * A fully-resolved brand ready to render. Colors are guaranteed non-null
 * (safety defaults kick in only if both the author and house rows are
 * missing). The logo may legitimately be null if the author has no logo
 * yet AND the house row has no logo either — consumers should handle
 * that gracefully (BrandMark renders nothing in that case).
 */
export interface ResolvedBrand {
  logo_url: string | null
  primary_color: string
  secondary_color: string
  /**
   * True when we're rendering the house (Newsreel) brand because the
   * author hasn't set up their own. Drives the "Add your brand" edit
   * affordance — it's only about the logo, which is the most visible
   * branding surface and the thing that signals "this isn't mine yet."
   */
  isFallback: boolean
}

/**
 * Merge an author's brand row with the house (Newsreel) brand row.
 * Each field independently prefers the author's value, then the house
 * value, then a safety default (colors only — never a local logo).
 *
 * Partial setups are honored: an author who has picked colors but not a
 * logo will render their colors with the house logo, and still see the
 * "Add your brand" affordance since they haven't set up their own logo.
 */
export function resolveDisplayBrand(
  authorBrand: AuthorBrand | null | undefined,
  houseBrand: AuthorBrand | null | undefined
): ResolvedBrand {
  return {
    logo_url: authorBrand?.logo_url || houseBrand?.logo_url || null,
    primary_color:
      authorBrand?.primary_color ||
      houseBrand?.primary_color ||
      SAFETY_COLORS.primary,
    secondary_color:
      authorBrand?.secondary_color ||
      houseBrand?.secondary_color ||
      SAFETY_COLORS.secondary,
    isFallback: !authorBrand?.logo_url,
  }
}

/**
 * Fetch the Newsreel house brand row. Thin convenience around
 * {@link getAuthorBrandByDomain} so callers don't have to import the
 * domain constant. Returns null if the row is missing — callers pass
 * the result straight to {@link resolveDisplayBrand}.
 */
export function getHouseBrand(): Promise<AuthorBrand | null> {
  return getAuthorBrandByDomain(NEWSREEL_HOUSE_DOMAIN)
}

// ─── Storage paths ───────────────────────────────────────────────────────────

/**
 * Storage path for a publisher's logo. Deterministic per domain: re-uploading
 * replaces the existing file via upsert, so the public URL stays stable.
 */
export function buildBrandLogoPath(domain: string): string {
  return `logo/${domain.toLowerCase()}.png`
}

// ─── Data access ─────────────────────────────────────────────────────────────

/**
 * Fetch the brand row for a domain, or null if none exists yet.
 * Readable by anyone (public SELECT policy) — safe to call from the client.
 */
export async function getAuthorBrandByDomain(domain: string): Promise<AuthorBrand | null> {
  const { data, error } = await supabase
    .from('author_brands')
    .select('*')
    .eq('domain', domain.toLowerCase())
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch author brand: ${error.message}`)
  }
  return (data as AuthorBrand) ?? null
}

/**
 * Upload a logo file for the given domain. PNG only, enforced by the caller
 * and the storage policy. Returns the public URL (routed through CDN if
 * configured).
 */
export async function uploadBrandLogo(params: {
  file: File
  domain: string
}): Promise<string> {
  const { file, domain } = params

  if (file.type !== 'image/png') {
    throw new Error('Logo must be a PNG file')
  }

  const path = buildBrandLogoPath(domain)
  const { error } = await supabase.storage
    .from(BRAND_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'image/png',
    })

  if (error) {
    throw new Error(`Failed to upload brand logo: ${error.message}`)
  }

  // Bust any CDN / browser cache by appending a version — the path itself is
  // stable across uploads, so downstream renders pick up the new logo.
  const publicUrl = getPublicUrl(BRAND_BUCKET, path)
  return `${publicUrl}?v=${Date.now()}`
}

// ─── Upsert ──────────────────────────────────────────────────────────────────

export interface UpsertAuthorBrandInput {
  domain: string
  authorId: string
  logo_url?: string | null
  primary_color?: string | null
  secondary_color?: string | null
}

/**
 * Insert or update the brand row for a domain. Preserves `created_by` on
 * updates (only set once, on first insert) and always stamps `updated_by`.
 *
 * Writes are DB-enforced via RLS: the authenticated user's email domain
 * must match the row's domain. A stray caller trying to pass a different
 * domain will get a Postgres error, not a silent success.
 */
export async function upsertAuthorBrand(
  input: UpsertAuthorBrandInput
): Promise<AuthorBrand> {
  const domain = input.domain.toLowerCase()

  if (input.primary_color != null && !isValidHexColor(input.primary_color)) {
    throw new Error('Primary color must be a valid 6-digit hex (e.g. #FF6343)')
  }
  if (input.secondary_color != null && !isValidHexColor(input.secondary_color)) {
    throw new Error('Secondary color must be a valid 6-digit hex (e.g. #1E3A5F)')
  }

  const { data: existing, error: selectError } = await supabase
    .from('author_brands')
    .select('id')
    .eq('domain', domain)
    .maybeSingle()

  if (selectError) {
    throw new Error(`Failed to check existing brand: ${selectError.message}`)
  }

  if (existing) {
    const { data, error } = await supabase
      .from('author_brands')
      .update({
        logo_url: input.logo_url ?? null,
        primary_color: input.primary_color ?? null,
        secondary_color: input.secondary_color ?? null,
        updated_by: input.authorId,
      })
      .eq('domain', domain)
      .select('*')
      .single()

    if (error) throw new Error(`Failed to update brand: ${error.message}`)
    return data as AuthorBrand
  }

  const { data, error } = await supabase
    .from('author_brands')
    .insert({
      domain,
      logo_url: input.logo_url ?? null,
      primary_color: input.primary_color ?? null,
      secondary_color: input.secondary_color ?? null,
      created_by: input.authorId,
      updated_by: input.authorId,
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to create brand: ${error.message}`)
  return data as AuthorBrand
}
