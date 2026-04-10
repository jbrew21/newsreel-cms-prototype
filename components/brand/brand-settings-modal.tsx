'use client'

/**
 * BrandSettingsModal — the single source of truth for editing publisher brand.
 *
 * Reusable: drop it anywhere you have a logged-in author's email + id and it
 * handles its own fetch, upload, and save. Emits the saved `AuthorBrand` back
 * via `onSaved` so parents can refresh their UI.
 *
 * Theming: built entirely on existing design tokens (bg-background,
 * text-foreground, border-border, etc.) so it inherits the app's light/dark
 * mode automatically. No hardcoded colors except the curated palette preset.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Upload, Check, AlertCircle, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  getAuthorBrandByDomain,
  isValidHexColor,
  normalizeHexColor,
  resolveBrandDomain,
  uploadBrandLogo,
  upsertAuthorBrand,
} from '@/lib/supabase/author-brand'
import type { AuthorBrand } from '@/lib/supabase/types'

// ─── Props ───────────────────────────────────────────────────────────────────

export interface BrandSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Authenticated author's email — used to derive the brand domain. */
  authorEmail: string | null | undefined
  /** Author id — stamped into `created_by` / `updated_by` for audit. */
  authorId: string | null | undefined
  /** Called after a successful save with the freshly-persisted brand row. */
  onSaved?: (brand: AuthorBrand) => void
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_PRIMARY = '#FF6343'
const DEFAULT_SECONDARY = '#1E3A5F'
const MAX_LOGO_BYTES = 1024 * 1024 // 1 MB

/** Curated palette — balanced across hues, readable on both light and dark. */
const COLOR_PALETTE: readonly string[] = [
  '#FF6343', '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#10B981', '#14B8A6', '#06B6D4',
  '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7',
  '#D946EF', '#EC4899', '#F43F5E', '#64748B', '#0F172A',
]

// ─── Component ───────────────────────────────────────────────────────────────

export function BrandSettingsModal({
  open,
  onOpenChange,
  authorEmail,
  authorId,
  onSaved,
}: BrandSettingsModalProps) {
  const domain = useMemo(() => resolveBrandDomain(authorEmail), [authorEmail])

  // ─── State ───────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [existing, setExisting] = useState<AuthorBrand | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [primary, setPrimary] = useState<string>(DEFAULT_PRIMARY)
  const [secondary, setSecondary] = useState<string>(DEFAULT_SECONDARY)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Load existing brand when the modal opens ───────────────────────
  useEffect(() => {
    if (!open || !domain) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getAuthorBrandByDomain(domain)
      .then((brand) => {
        if (cancelled) return
        setExisting(brand)
        setLogoFile(null)
        setLogoPreview(brand?.logo_url ?? null)
        setPrimary(brand?.primary_color ?? DEFAULT_PRIMARY)
        setSecondary(brand?.secondary_color ?? DEFAULT_SECONDARY)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, domain])

  // Revoke any blob URLs we created for previews
  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview)
      }
    }
  }, [logoPreview])

  // ─── Handlers ───────────────────────────────────────────────────────
  const handlePickFile = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // Blob URL lifecycle: we only CREATE object URLs here. Revocation is
  // owned by a single effect (below) that runs on every `logoPreview`
  // change AND on unmount — never double-revoke, never leak.
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return

    if (file.type !== 'image/png') {
      setError('Logo must be a PNG file.')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('Logo must be under 1 MB.')
      return
    }

    setError(null)
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }, [])

  const handleRemoveLogo = useCallback(() => {
    setLogoFile(null)
    setLogoPreview(null)
  }, [])

  // Memoize normalized hex values so the Save button's disabled check
  // and the save handler share a single canonical form. Recomputes only
  // when the raw inputs change.
  const normalizedPrimary = useMemo(() => normalizeHexColor(primary), [primary])
  const normalizedSecondary = useMemo(() => normalizeHexColor(secondary), [secondary])
  const colorsValid = normalizedPrimary !== null && normalizedSecondary !== null

  const handleSave = useCallback(async () => {
    if (!domain || !authorId) return
    setError(null)

    if (!normalizedPrimary) {
      setError('Primary color must be a valid 6-digit hex (e.g. #FF6343).')
      return
    }
    if (!normalizedSecondary) {
      setError('Secondary color must be a valid 6-digit hex (e.g. #1E3A5F).')
      return
    }

    setSaving(true)
    try {
      let logoUrl: string | null = existing?.logo_url ?? null

      // Upload new logo if one was picked this session.
      if (logoFile) {
        logoUrl = await uploadBrandLogo({ file: logoFile, domain })
      } else if (logoPreview === null) {
        // User removed existing logo without picking a new one.
        logoUrl = null
      }

      const saved = await upsertAuthorBrand({
        domain,
        authorId,
        logo_url: logoUrl,
        primary_color: normalizedPrimary,
        secondary_color: normalizedSecondary,
      })

      onSaved?.(saved)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save brand.')
    } finally {
      setSaving(false)
    }
  }, [
    domain,
    authorId,
    normalizedPrimary,
    normalizedSecondary,
    logoFile,
    logoPreview,
    existing,
    onSaved,
    onOpenChange,
  ])

  // ─── Guard: generic / invalid domain ────────────────────────────────
  if (!domain) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publisher branding</DialogTitle>
            <DialogDescription>
              Branding is shared across everyone at your publisher, so it
              requires a work email. Sign in with your organization email to
              set up a brand.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // ─── Audit banner: who set this up ──────────────────────────────────
  const auditLine =
    existing?.updated_at && existing?.updated_by
      ? `Last updated ${new Date(existing.updated_at).toLocaleDateString()} — changes apply to every author at ${domain}.`
      : existing
        ? `Changes apply to every author at ${domain}.`
        : `You're the first to set up branding for ${domain}. Everyone at your publisher will share these settings.`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publisher brand</DialogTitle>
          <DialogDescription>
            Your logo and colors appear on every story embed from{' '}
            <span className="font-medium text-foreground">{domain}</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Shared-brand notice */}
        <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
          {auditLine}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-1">
            {/* ── Logo ─────────────────────────────────────────── */}
            <section className="space-y-2">
              <Label>Logo</Label>
              <LogoDropzone
                preview={logoPreview}
                onPick={handlePickFile}
                onRemove={handleRemoveLogo}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png"
                className="hidden"
                onChange={handleFileChange}
              />
              <p className="text-xs text-muted-foreground">
                PNG, max 1 MB. Transparent background recommended.
              </p>
            </section>

            {/* ── Primary color ────────────────────────────────── */}
            <ColorField
              label="Primary color"
              description="Used for the partner accent, active progress, and call-to-action highlights."
              value={primary}
              onChange={setPrimary}
            />

            {/* ── Secondary color ──────────────────────────────── */}
            <ColorField
              label="Secondary color"
              description="Used for the slide caption bubble background."
              value={secondary}
              onChange={setSecondary}
            />

            {/* ── Error ─────────────────────────────────────────── */}
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !authorId || !colorsValid}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save brand
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function LogoDropzone({
  preview,
  onPick,
  onRemove,
}: {
  preview: string | null
  onPick: () => void
  onRemove: () => void
}) {
  if (preview) {
    return (
      <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
        <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Brand logo preview"
            className="max-h-full max-w-full object-contain"
          />
        </div>
        <div className="flex flex-col gap-2 flex-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPick}
            className="justify-start"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="justify-start text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Remove
          </Button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 px-4 py-8 transition-colors',
        'hover:border-primary/50 hover:bg-muted/40'
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Upload className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">Upload your logo</p>
      <p className="text-xs text-muted-foreground">Click to pick a PNG file</p>
    </button>
  )
}

function ColorField({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: string
  onChange: (next: string) => void
}) {
  const safeValue = isValidHexColor(value) ? value : '#000000'
  const invalid = !isValidHexColor(normalizeHexColor(value) || '')

  return (
    <section className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground -mt-1">{description}</p>

      <div className="flex items-center gap-3">
        {/* Native color picker — styled to look like a swatch */}
        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border border-border shadow-sm">
          <input
            type="color"
            value={safeValue}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 h-[200%] w-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer border-none bg-transparent p-0"
            aria-label={`${label} color picker`}
          />
        </div>

        {/* Hex input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const v = e.target.value.trim()
              onChange(v.startsWith('#') ? v : `#${v}`)
            }}
            maxLength={7}
            spellCheck={false}
            className={cn(
              'h-10 w-full rounded-md border bg-background px-3 font-mono text-sm uppercase tracking-wider text-foreground transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
              invalid
                ? 'border-destructive/50 focus:ring-destructive/50'
                : 'border-border'
            )}
            placeholder="#RRGGBB"
          />
        </div>
      </div>

      {/* Palette presets */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {COLOR_PALETTE.map((swatch) => {
          const selected = normalizeHexColor(value) === swatch
          return (
            <button
              key={swatch}
              type="button"
              onClick={() => onChange(swatch)}
              className={cn(
                'h-6 w-6 rounded-full border transition-all',
                selected
                  ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110'
                  : 'border-border/60 hover:scale-110'
              )}
              style={{ background: swatch }}
              aria-label={`Use ${swatch}`}
            />
          )
        })}
      </div>
    </section>
  )
}
