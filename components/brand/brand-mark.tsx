'use client'

/**
 * BrandMark — the publisher logo chip shown on every phone-frame slide.
 *
 * Positions itself absolutely at the top-right "notch" area of a phone
 * frame. Parents just need their container to be the positioning context
 * (any `position: relative` / `absolute` / `fixed` element will do).
 *
 * Two modes:
 *   1. Display (default): just the logo floating over the slide.
 *   2. Editable: the same logo wrapped in a clickable pill with a pencil
 *      icon and "Add your brand" label. Used only when the resolved brand
 *      is the Newsreel fallback AND the viewer owns a work-email domain
 *      AND they're currently in edit mode. Clicking fires `onEditClick`.
 *
 * This component is brand-data-agnostic — it just takes a logo URL and a
 * flag. All "should we show edit?" logic lives at the call site.
 */

import { Pencil } from 'lucide-react'

export interface BrandMarkProps {
  /**
   * Public URL of the logo to render. Null is legitimate — it means
   * neither the author nor the house has a logo uploaded yet. In
   * display mode nothing renders; in editable mode only the
   * "Add your brand" pill renders (without a logo image).
   */
  logoUrl: string | null
  /** When true, renders the editable pill with pencil + label. */
  showEditAffordance?: boolean
  /** Fired when the edit pill is clicked. Required iff `showEditAffordance`. */
  onEditClick?: () => void
}

// ─── Constants ───────────────────────────────────────────────────────────────

const POSITION = {
  position: 'absolute',
  top: 20,
  right: 16,
  zIndex: 55,
} as const

// ─── Component ───────────────────────────────────────────────────────────────

export function BrandMark({
  logoUrl,
  showEditAffordance = false,
  onEditClick,
}: BrandMarkProps) {
  if (!showEditAffordance) {
    // No logo and nothing to edit → render nothing. Slides stay clean.
    if (!logoUrl) return null
    return (
      <div
        style={{
          ...POSITION,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          style={{
            maxHeight: 24,
            maxWidth: 80,
            objectFit: 'contain',
            display: 'block',
            // Subtle drop shadow so the mark reads over any background
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35))',
          }}
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onEditClick}
      aria-label="Add your brand"
      style={{
        ...POSITION,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px 5px 6px',
        borderRadius: 999,
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background =
          'rgba(0, 0, 0, 0.72)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background =
          'rgba(0, 0, 0, 0.55)'
      }}
    >
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          style={{
            maxHeight: 20,
            maxWidth: 60,
            objectFit: 'contain',
            display: 'block',
          }}
        />
      )}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          fontWeight: 500,
          color: '#FFFFFF',
          fontFamily: '"DM Sans", sans-serif',
          whiteSpace: 'nowrap',
          letterSpacing: 0.1,
        }}
      >
        <Pencil style={{ width: 11, height: 11 }} />
        Add your brand
      </span>
    </button>
  )
}
