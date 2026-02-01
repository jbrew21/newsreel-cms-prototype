"use client"

import { useState, useCallback, useRef } from 'react'
import { Search, Image as ImageIcon, Video, Play, Loader2, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { searchMedia } from '@/lib/media-search/client'
import type { MediaItem, MediaSource, MediaType } from '@/lib/media-search/types'
import { SOURCE_LABELS } from '@/lib/media-search/types'

interface MediaSearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectMedia: (item: MediaItem) => void
}

export function MediaSearchModal({ open, onOpenChange, onSelectMedia }: MediaSearchModalProps) {
  const [query, setQuery] = useState('')
  const [mediaType, setMediaType] = useState<MediaType>('image')
  const [results, setResults] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<'all' | MediaSource>('all')
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setSourceFilter('all')
    setHasSearched(true)
    try {
      const items = await searchMedia(query.trim(), mediaType)
      setResults(items)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [query, mediaType])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleToggle = (type: MediaType) => {
    if (type === mediaType) return
    setMediaType(type)
    setResults([])
    setSourceFilter('all')
    setHasSearched(false)
  }

  const handleSelect = (item: MediaItem) => {
    // YouTube videos: open in new tab (can't attach due to policies)
    if (item.source === 'youtube') {
      window.open(item.url, '_blank', 'noopener,noreferrer')
      return
    }
    onSelectMedia(item)
    onOpenChange(false)
  }

  // Source counts for pills
  const sourceCounts = results.reduce<Record<string, number>>((acc, item) => {
    acc[item.source] = (acc[item.source] || 0) + 1
    return acc
  }, {})

  const filteredResults = sourceFilter === 'all'
    ? results
    : results.filter(item => item.source === sourceFilter)

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Search Media</DialogTitle>
          <DialogDescription>
            Search across multiple sources for {mediaType === 'image' ? 'images' : 'videos'}.
          </DialogDescription>
        </DialogHeader>

        {/* Search row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder={mediaType === 'image' ? 'Search for images...' : 'Search for videos...'}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>

          {/* Image / Video toggle */}
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => handleToggle('image')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm transition-colors',
                mediaType === 'image'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:text-foreground'
              )}
            >
              <ImageIcon className="h-4 w-4" />
              Image
            </button>
            <button
              type="button"
              onClick={() => handleToggle('video')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm transition-colors',
                mediaType === 'video'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:text-foreground'
              )}
            >
              <Video className="h-4 w-4" />
              Video
            </button>
          </div>

          <Button onClick={handleSearch} disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {/* Source pills */}
        {results.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setSourceFilter('all')}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                sourceFilter === 'all'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
              )}
            >
              All ({results.length})
            </button>
            {Object.entries(sourceCounts).map(([source, count]) => (
              <button
                key={source}
                type="button"
                onClick={() => setSourceFilter(source as MediaSource)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                  sourceFilter === source
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                )}
              >
                {SOURCE_LABELS[source as MediaSource] || source} ({count})
              </button>
            ))}
          </div>
        )}

        {/* Results grid */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Searching across sources...</span>
            </div>
          )}

          {!loading && hasSearched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Search className="h-10 w-10 mb-3 opacity-40" />
              <p>No results found for &quot;{query}&quot;</p>
              <p className="text-xs mt-1">Try different keywords or switch between image/video</p>
            </div>
          )}

          {!loading && !hasSearched && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Search className="h-10 w-10 mb-3 opacity-40" />
              <p>Type a keyword and hit Search</p>
            </div>
          )}

          {!loading && filteredResults.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filteredResults.map((item, idx) => (
                <button
                  key={`${item.source}-${idx}`}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="group relative rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors text-left"
                >
                  <div className="aspect-video relative bg-muted">
                    <img
                      src={item.thumbnail || item.url}
                      alt={item.description || ''}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Video overlay */}
                    {item.mediaType === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                        <Play className="h-6 w-6 text-white drop-shadow-md" />
                      </div>
                    )}
                    {/* Duration badge */}
                    {item.duration && (
                      <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                        {formatDuration(item.duration)}
                      </span>
                    )}
                    {/* Source badge */}
                    <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                      {SOURCE_LABELS[item.source]}
                    </span>
                    {/* YouTube external link indicator */}
                    {item.source === 'youtube' && (
                      <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                        <ExternalLink className="h-2.5 w-2.5" />
                        Opens in YouTube
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground p-2 truncate">
                      {item.description}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
