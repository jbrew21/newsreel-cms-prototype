/**
 * Shared number, date, and duration formatters.
 * Used across the analytics dashboard for consistent display.
 */

// ── Numbers ─────────────────────────────────────────────────────────────────

/**
 * Format a number with smart abbreviation:
 *   - < 1,000          → "985"
 *   - 1,000 - 999,999  → "1.2k"
 *   - 1M - 999M        → "2.4M"
 *   - >= 1B            → "1.8B"
 */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${Math.round(value / 1_000)}k`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return Math.round(value).toString()
}

/** Format with thousand separators: 12345 → "12,345" */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Math.round(value).toLocaleString('en-US')
}

/** Format a 0-100 number as a percent with optional decimals. */
export function formatPercent(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '0%'
  return `${value.toFixed(decimals)}%`
}

/** Format a 0-1 ratio as a percent: 0.682 → "68%" */
export function formatRatio(value: number, decimals = 0): string {
  return formatPercent(value * 100, decimals)
}

/** Percentage delta: (curr - prev) / prev  (safe for zero) */
export function percentDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous === 0) {
    if (current === 0) return 0
    return null // can't meaningfully compute
  }
  return ((current - previous) / previous) * 100
}

// ── Durations ───────────────────────────────────────────────────────────────

/**
 * Format a millisecond duration in a human-friendly way:
 *   < 1s      → "850ms"
 *   < 60s     → "42s"
 *   < 60m     → "1m 42s"
 *   >= 60m    → "2h 14m"
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`
  const hours = Math.floor(minutes / 60)
  const remMin = minutes % 60
  return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`
}

/** Short duration (best for tight spaces): 42000 → "42s", 125000 → "2:05" */
export function formatDurationShort(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—'
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// ── Dates ───────────────────────────────────────────────────────────────────

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Relative time: "just now", "5m ago", "3h ago", "2d ago", "Apr 3" */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  const diffMs = Date.now() - d.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 10) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 7) return `${days}d ago`
  return formatDateShort(d)
}

// ── Geography ───────────────────────────────────────────────────────────────

/**
 * Convert an ISO country code to its flag emoji (🇺🇸 etc.)
 * Falls back to the code if conversion fails.
 */
export function countryFlag(code: string | null | undefined): string {
  if (!code || typeof code !== 'string' || code.length !== 2) return '🏳️'
  try {
    const upper = code.toUpperCase()
    const flag = String.fromCodePoint(
      ...upper.split('').map((c) => 0x1f1a5 + c.charCodeAt(0))
    )
    return flag
  } catch {
    return code
  }
}

/** Full country name from ISO code, using Intl.DisplayNames */
const COUNTRY_NAMES_CACHE = new Map<string, string>()
export function countryName(code: string | null | undefined): string {
  if (!code) return 'Unknown'
  const upper = code.toUpperCase()
  if (COUNTRY_NAMES_CACHE.has(upper)) return COUNTRY_NAMES_CACHE.get(upper)!
  try {
    const display = new Intl.DisplayNames(['en'], { type: 'region' })
    const name = display.of(upper) || upper
    COUNTRY_NAMES_CACHE.set(upper, name)
    return name
  } catch {
    return upper
  }
}
