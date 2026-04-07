/**
 * POST /api/analytics/track
 *
 * Public ingest endpoint for story analytics events. Designed to be
 * called from:
 *   - The iframe embed at /embed/story/[id] (anonymous visitors)
 *   - The mobile app (logged-in users)
 *
 * Security model:
 *   - Uses server-only `SUPABASE_SERVICE_ROLE_KEY` (never exposed to browser).
 *   - All writes go through this endpoint — direct client writes are blocked
 *     by the `story_events` table's RLS policies (deny-all, service role bypasses).
 *   - Every event is validated against a strict schema before insert.
 *   - In-memory rate limiter (60 req/min per IP) caps abuse at a single instance.
 *   - Domain / referrer / device / country are extracted SERVER-SIDE from request
 *     headers — never trusted from client payload.
 *   - Returns 204 No Content on success to minimize data leakage.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type {
  AnalyticsEventType,
  AnalyticsSource,
  TrackRequestBody,
} from '@/lib/analytics/types'

// ── CORS ────────────────────────────────────────────────────────────────────

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

// ── Limits & validation ────────────────────────────────────────────────────

const MAX_BATCH_SIZE = 50
const MAX_BODY_BYTES = 32 * 1024 // 32 KB
const MAX_DURATION_MS = 60 * 60 * 1000 // 1 hour (matches DB CHECK)
const MAX_SLIDE_INDEX = 200
const MAX_REFERRER_LENGTH = 2048
const MAX_METADATA_BYTES = 4 * 1024 // 4 KB per event
const MAX_ID_LENGTH = 128

const VALID_EVENT_TYPES: ReadonlySet<AnalyticsEventType> = new Set([
  'open',
  'slide_view',
  'complete',
  'share',
  'save',
  'audio_play',
  'audio_complete',
  'link_click',
])

const VALID_SOURCES: ReadonlySet<AnalyticsSource> = new Set(['app', 'iframe', 'web'])

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUUID(v: unknown): v is string {
  return typeof v === 'string' && UUID_REGEX.test(v)
}

// ── Rate limiter (in-memory, per-instance) ────────────────────────────────
// Render uses persistent containers, so this works across requests on the
// same instance. If you scale to multiple instances, move to Upstash/Redis.

const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 60

interface RateLimitEntry {
  count: number
  resetAt: number
}
const rateLimitMap = new Map<string, RateLimitEntry>()
let lastRateLimitCleanup = Date.now()

function rateLimitCheck(key: string): boolean {
  const now = Date.now()

  // Periodic cleanup to prevent unbounded growth
  if (now - lastRateLimitCleanup > 5 * 60 * 1000) {
    lastRateLimitCleanup = now
    for (const [k, v] of rateLimitMap.entries()) {
      if (v.resetAt < now) rateLimitMap.delete(k)
    }
  }

  const entry = rateLimitMap.get(key)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// ── Request helpers (server-side trust boundary) ───────────────────────────

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}

function extractDomain(req: NextRequest): string | null {
  const referer = req.headers.get('referer') || req.headers.get('referrer')
  if (!referer) return null
  try {
    const url = new URL(referer)
    const hostname = url.hostname
    if (!hostname || hostname.length > 255) return null
    return hostname.toLowerCase()
  } catch {
    return null
  }
}

function extractReferrer(req: NextRequest): string | null {
  const referer = req.headers.get('referer') || req.headers.get('referrer')
  if (!referer) return null
  return referer.length > MAX_REFERRER_LENGTH
    ? referer.slice(0, MAX_REFERRER_LENGTH)
    : referer
}

function parseDeviceType(ua: string | null): string | null {
  if (!ua) return null
  if (/iPad|Tablet|PlayBook|Silk(?!.*Mobile)/i.test(ua)) return 'tablet'
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua)) {
    return 'mobile'
  }
  return 'desktop'
}

function extractCountry(req: NextRequest): string | null {
  // Cloudflare (used by Render in many setups)
  const cf = req.headers.get('cf-ipcountry')
  if (cf && /^[A-Z]{2}$/i.test(cf)) return cf.toUpperCase()
  // Vercel
  const vercel = req.headers.get('x-vercel-ip-country')
  if (vercel && /^[A-Z]{2}$/i.test(vercel)) return vercel.toUpperCase()
  // Fly.io
  const fly = req.headers.get('fly-region')
  if (fly && fly.length === 3) return fly.toUpperCase().slice(0, 2)
  return null
}

// ── Response helpers ───────────────────────────────────────────────────────

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: corsHeaders })
}

function badRequest(message: string) {
  return jsonError(400, message)
}

// ── Route handlers ─────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function POST(req: NextRequest) {
  // ── Rate limit ────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  if (!rateLimitCheck(ip)) {
    return jsonError(429, 'Rate limit exceeded')
  }

  // ── Body size guard ───────────────────────────────────────────────────
  const contentLength = req.headers.get('content-length')
  if (contentLength) {
    const n = parseInt(contentLength, 10)
    if (Number.isFinite(n) && n > MAX_BODY_BYTES) {
      return badRequest('Payload too large')
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let body: TrackRequestBody
  try {
    body = (await req.json()) as TrackRequestBody
  } catch {
    return badRequest('Invalid JSON')
  }
  if (!body || typeof body !== 'object') return badRequest('Invalid body')

  // ── Validate top-level fields ────────────────────────────────────────
  if (!isUUID(body.story_id)) return badRequest('Invalid story_id')

  if (body.author_id != null && !isUUID(body.author_id)) {
    return badRequest('Invalid author_id')
  }

  if (body.user_id != null && !isUUID(body.user_id)) {
    return badRequest('Invalid user_id')
  }

  if (!body.user_id && !body.anonymous_id) {
    return badRequest('user_id or anonymous_id required')
  }

  if (body.anonymous_id != null) {
    if (typeof body.anonymous_id !== 'string' || body.anonymous_id.length === 0 || body.anonymous_id.length > MAX_ID_LENGTH) {
      return badRequest('Invalid anonymous_id')
    }
  }

  if (body.session_id != null) {
    if (typeof body.session_id !== 'string' || body.session_id.length === 0 || body.session_id.length > MAX_ID_LENGTH) {
      return badRequest('Invalid session_id')
    }
  }

  const source: AnalyticsSource =
    body.source && VALID_SOURCES.has(body.source) ? body.source : 'iframe'

  if (!Array.isArray(body.events) || body.events.length === 0) {
    return badRequest('events required')
  }
  if (body.events.length > MAX_BATCH_SIZE) {
    return badRequest(`Too many events (max ${MAX_BATCH_SIZE})`)
  }

  // ── Enrich from request headers (trusted server-side data) ───────────
  const domain = extractDomain(req)
  const referrer = extractReferrer(req)
  const deviceType = parseDeviceType(req.headers.get('user-agent'))
  const country = extractCountry(req)

  // ── Validate & shape each event ──────────────────────────────────────
  interface EventRow {
    story_id: string
    author_id: string | null
    user_id: string | null
    anonymous_id: string | null
    session_id: string | null
    event_type: string
    slide_index: number | null
    duration_ms: number | null
    source: string
    domain: string | null
    referrer: string | null
    device_type: string | null
    country: string | null
    metadata: Record<string, unknown>
  }

  const rows: EventRow[] = []

  for (let i = 0; i < body.events.length; i++) {
    const e = body.events[i]
    if (!e || typeof e !== 'object') {
      return badRequest(`event[${i}] invalid`)
    }

    if (typeof e.event_type !== 'string' || !VALID_EVENT_TYPES.has(e.event_type as AnalyticsEventType)) {
      return badRequest(`event[${i}] invalid event_type`)
    }

    let slideIndex: number | null = null
    if (e.slide_index != null) {
      if (
        typeof e.slide_index !== 'number' ||
        !Number.isInteger(e.slide_index) ||
        e.slide_index < 0 ||
        e.slide_index > MAX_SLIDE_INDEX
      ) {
        return badRequest(`event[${i}] invalid slide_index`)
      }
      slideIndex = e.slide_index
    }

    let durationMs: number | null = null
    if (e.duration_ms != null) {
      if (
        typeof e.duration_ms !== 'number' ||
        !Number.isFinite(e.duration_ms) ||
        e.duration_ms < 0 ||
        e.duration_ms > MAX_DURATION_MS
      ) {
        return badRequest(`event[${i}] invalid duration_ms`)
      }
      durationMs = Math.floor(e.duration_ms)
    }

    let metadata: Record<string, unknown> = {}
    if (e.metadata != null) {
      if (typeof e.metadata !== 'object' || Array.isArray(e.metadata)) {
        return badRequest(`event[${i}] invalid metadata`)
      }
      const metaStr = JSON.stringify(e.metadata)
      if (metaStr.length > MAX_METADATA_BYTES) {
        return badRequest(`event[${i}] metadata too large`)
      }
      metadata = e.metadata as Record<string, unknown>
    }

    rows.push({
      story_id: body.story_id,
      author_id: body.author_id ?? null,
      user_id: body.user_id ?? null,
      anonymous_id: body.anonymous_id ?? null,
      session_id: body.session_id ?? null,
      event_type: e.event_type,
      slide_index: slideIndex,
      duration_ms: durationMs,
      source,
      domain,
      referrer,
      device_type: deviceType,
      country,
      metadata,
    })
  }

  // ── Insert (service role bypasses RLS) ───────────────────────────────
  try {
    const admin = getSupabaseAdmin()
    const { error } = await admin.from('story_events').insert(rows)
    if (error) {
      // Common case: FK violation (story doesn't exist). Don't leak details.
      console.error('[analytics/track] insert error:', error.message)
      return jsonError(500, 'Insert failed')
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[analytics/track] error:', msg)
    return jsonError(500, 'Server error')
  }

  // 204 No Content — no data echoed back to the client
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
