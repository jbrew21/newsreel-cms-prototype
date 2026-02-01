"use client"

import { Search, Upload } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface MediaPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadClick: () => void
  onSearchClick: () => void
}

export function MediaPickerModal({ open, onOpenChange, onUploadClick, onSearchClick }: MediaPickerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Media</DialogTitle>
          <DialogDescription>Choose how you want to add media to this slide.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 pt-2">
          {/* Search Media */}
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              setTimeout(() => onSearchClick(), 150)
            }}
            className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border p-6 text-foreground hover:bg-accent hover:border-accent-foreground/20 transition-colors cursor-pointer"
          >
            <Search className="h-8 w-8" />
            <span className="text-sm font-medium">Search Media</span>
            <span className="text-xs text-muted-foreground">From stock libraries</span>
          </button>

          {/* Upload */}
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              setTimeout(() => onUploadClick(), 150)
            }}
            className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border p-6 text-foreground hover:bg-accent hover:border-accent-foreground/20 transition-colors cursor-pointer"
          >
            <Upload className="h-8 w-8" />
            <span className="text-sm font-medium">Upload</span>
            <span className="text-xs text-muted-foreground">From your device</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
