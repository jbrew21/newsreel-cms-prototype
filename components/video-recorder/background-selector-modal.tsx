'use client'

import { useState, useRef } from 'react'
import { Search, Upload, Palette, VideoOff, Image as ImageIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { BackgroundConfig } from '@/hooks/use-video-compositor'

const COLOR_PALETTE = [
  '#000000', '#1a1a2e', '#16213e', '#0f3460',
  '#533483', '#2c003e', '#1b1b2f', '#162447',
  '#1f4068', '#1b262c', '#0f0e17', '#2d132c',
  '#e94560', '#f38181', '#fce38a', '#eaffd0',
  '#95e1d3', '#aa96da', '#c9b1ff', '#f0e6ef',
  '#ffffff', '#f5f5f5', '#e0e0e0', '#333333',
]

interface BackgroundSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (config: BackgroundConfig) => void
  /** Reuse existing media search */
  onSearchMediaClick?: () => void
}

export function BackgroundSelectorModal({
  open,
  onOpenChange,
  onSelect,
  onSearchMediaClick,
}: BackgroundSelectorModalProps) {
  const [tab, setTab] = useState<'options' | 'color'>('options')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    const url = URL.createObjectURL(file)
    const isVideo = file.type.startsWith('video/')
    onSelect(isVideo ? { type: 'video', src: url } : { type: 'image', src: url })
    onOpenChange(false)
  }

  const handleColorSelect = (color: string) => {
    onSelect({ type: 'color', color })
    onOpenChange(false)
  }

  const handleNoBackground = () => {
    onSelect({ type: 'none' })
    onOpenChange(false)
  }

  const handleSearchClick = () => {
    onOpenChange(false)
    setTimeout(() => onSearchMediaClick?.(), 150)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Background</DialogTitle>
          <DialogDescription>
            Select a background for your video recording.
          </DialogDescription>
        </DialogHeader>

        {tab === 'options' ? (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              {/* Search Media */}
              {onSearchMediaClick && (
                <button
                  type="button"
                  onClick={handleSearchClick}
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border p-5 text-foreground hover:bg-accent hover:border-accent-foreground/20 transition-colors cursor-pointer"
                >
                  <Search className="h-7 w-7" />
                  <span className="text-sm font-medium">Search Media</span>
                  <span className="text-[11px] text-muted-foreground">From stock libraries</span>
                </button>
              )}

              {/* Upload */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border p-5 text-foreground hover:bg-accent hover:border-accent-foreground/20 transition-colors cursor-pointer"
              >
                <Upload className="h-7 w-7" />
                <span className="text-sm font-medium">Upload</span>
                <span className="text-[11px] text-muted-foreground">From your device</span>
              </button>

              {/* Color */}
              <button
                type="button"
                onClick={() => setTab('color')}
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border p-5 text-foreground hover:bg-accent hover:border-accent-foreground/20 transition-colors cursor-pointer"
              >
                <Palette className="h-7 w-7" />
                <span className="text-sm font-medium">Solid Color</span>
                <span className="text-[11px] text-muted-foreground">Pick from palette</span>
              </button>

              {/* No Background */}
              <button
                type="button"
                onClick={handleNoBackground}
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border p-5 text-foreground hover:bg-accent hover:border-accent-foreground/20 transition-colors cursor-pointer"
              >
                <VideoOff className="h-7 w-7" />
                <span className="text-sm font-medium">No Background</span>
                <span className="text-[11px] text-muted-foreground">Plain camera feed</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => setTab('options')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Back to options
            </button>
            <div className="grid grid-cols-6 gap-2">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleColorSelect(color)}
                  className={cn(
                    'w-full aspect-square rounded-lg border-2 border-transparent hover:border-primary transition-colors cursor-pointer',
                    color === '#ffffff' && 'border-border'
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
