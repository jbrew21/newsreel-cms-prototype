'use client'

import { useState } from 'react'
import { Plus, MessageSquare, BarChart3, Image as ImageIcon, Globe, Calendar, X, MoreHorizontal, FileText, Newspaper } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

// ── Types ────────────────────────────────────────────────────────────────────

export type WireType = 'text' | 'poll' | 'story-share'
export type WireVisibility = 'public' | 'subscribers' | 'circle'
export type WireStatus = 'draft' | 'published' | 'scheduled'

interface Wire {
  id: string
  type: WireType
  body?: string
  storyId?: string
  storyTitle?: string
  storyImg?: string
  pollQuestion?: string
  visibility: WireVisibility
  status: WireStatus
  createdAt: string
  scheduledFor?: string
  reads?: number
  replies?: number
  votes?: number
}

// ── Mock data (will swap to real backend later) ──────────────────────────────

const MOCK_WIRES: Wire[] = [
  {
    id: '1',
    type: 'text',
    body: "Just got off the phone with a senior State Department official. Confirms 'Project Freedom' Navy escorts begin Monday — three U.S. destroyers already repositioning to the Strait.",
    visibility: 'subscribers',
    status: 'published',
    createdAt: '12 min ago',
    reads: 142,
    replies: 8,
  },
  {
    id: '2',
    type: 'poll',
    pollQuestion: 'The Fed should have cut rates today rather than holding steady.',
    visibility: 'public',
    status: 'published',
    createdAt: '34 min ago',
    reads: 412,
    votes: 31,
  },
  {
    id: '3',
    type: 'story-share',
    body: 'Took me three days to get the Treasury sources to talk on record. Worth the wait.',
    storyTitle: 'The US economy is fine probably',
    storyImg: 'https://images.unsplash.com/photo-1554224155-1696413565d3?w=200&h=200&fit=crop',
    visibility: 'public',
    status: 'published',
    createdAt: '1h ago',
    reads: 982,
    replies: 14,
  },
  {
    id: '4',
    type: 'text',
    body: "Hot take from inside the Fed presser: Powell looked tired. Three reporters tried to get him on the dot-plot question. He swatted all three.",
    visibility: 'public',
    status: 'published',
    createdAt: '5h ago',
    reads: 2147,
    replies: 47,
  },
  {
    id: '5',
    type: 'text',
    body: "Working on a piece about Canada's quiet response to the bridge story. Aiming to file by Tuesday — anyone with sources at Trade Canada, please reach out.",
    visibility: 'public',
    status: 'draft',
    createdAt: '2h ago',
  },
  {
    id: '6',
    type: 'poll',
    pollQuestion: 'Climate policy should be linked to trade negotiations.',
    visibility: 'public',
    status: 'scheduled',
    createdAt: 'just now',
    scheduledFor: 'Tomorrow, 9:00 AM',
  },
]

const TYPE_ICON: Record<WireType, React.ReactNode> = {
  text: <FileText className="h-3.5 w-3.5" />,
  poll: <BarChart3 className="h-3.5 w-3.5 text-secondary" />,
  'story-share': <Newspaper className="h-3.5 w-3.5 text-primary" />,
}

// ── Wires List ───────────────────────────────────────────────────────────────

interface WiresTabProps {
  filter: 'drafts' | 'published' | 'scheduled' | 'all'
  onCompose: () => void
}

export function WiresTab({ filter, onCompose }: WiresTabProps) {
  const wires = MOCK_WIRES.filter(w => filter === 'all' ? true : w.status === filter.replace(/s$/, '') as WireStatus)

  if (wires.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card/30 p-16 flex flex-col items-center gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-heading">No wires yet.</h2>
        <p className="text-sm text-muted-foreground">Send a wire to your subscribers in seconds.</p>
        <Button onClick={onCompose} className="mt-2 gap-1.5">
          <Plus className="h-4 w-4" /> New Wire
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-mono">
          {filter === 'all' ? 'All wires' : filter.charAt(0).toUpperCase() + filter.slice(1)}
        </h2>
        <Button onClick={onCompose} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Wire
        </Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/50">
        {wires.map(wire => (
          <div
            key={wire.id}
            role="button"
            tabIndex={0}
            className="w-full flex items-start gap-3 p-4 hover:bg-accent/50 transition-colors text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
              {TYPE_ICON[wire.type]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm leading-snug line-clamp-2">
                {wire.type === 'poll' && <span className="font-semibold">{wire.pollQuestion}</span>}
                {wire.type === 'story-share' && (
                  <><span className="font-semibold">+ {wire.storyTitle}</span> — {wire.body}</>
                )}
                {wire.type === 'text' && wire.body}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="uppercase tracking-wider font-mono text-[10px]">{wire.visibility}</span>
                {wire.status === 'scheduled' && <span className="font-mono">→ {wire.scheduledFor}</span>}
                {wire.status === 'published' && (
                  <>
                    <span className="font-mono">{wire.reads?.toLocaleString()} reads</span>
                    {wire.replies !== undefined && <span className="font-mono">{wire.replies} replies</span>}
                    {wire.votes !== undefined && <span className="font-mono">{wire.votes} votes</span>}
                  </>
                )}
                <span className="ml-auto font-mono">{wire.createdAt}</span>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation() }}
              className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Composer Modal ───────────────────────────────────────────────────────────

interface WireComposerProps {
  open: boolean
  onClose: () => void
  authorName: string
  authorAvatar?: string | null
  authorRole?: string
}

const MOCK_STORIES = [
  { id: '1', tag: 'Business', title: 'The US economy is fine probably', img: 'https://images.unsplash.com/photo-1554224155-1696413565d3?w=400&h=400&fit=crop' },
  { id: '2', tag: 'Politics', title: 'Trump threatens to block new bridge to Canada', img: 'https://images.unsplash.com/photo-1605902711622-cfb43c4437b5?w=400&h=400&fit=crop' },
  { id: '3', tag: 'Climate', title: "EPA's new methane rule could reshape every gas bill", img: 'https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=400&h=400&fit=crop' },
]

export function WireComposer({ open, onClose, authorName, authorAvatar, authorRole }: WireComposerProps) {
  const [mode, setMode] = useState<WireType>('text')
  const [text, setText] = useState('')
  const [pollQ, setPollQ] = useState('')
  const [selectedStory, setSelectedStory] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<WireVisibility>('public')

  const canSend =
    (mode === 'text' && text.trim().length > 0) ||
    (mode === 'poll' && pollQ.trim().length > 0) ||
    (mode === 'story-share' && selectedStory && text.trim().length > 0)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">New wire</DialogTitle>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            {authorAvatar ? (
              <img src={authorAvatar} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                {authorName.charAt(0)}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{authorName}</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                {authorRole || 'Verified contributor'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1.5 p-3 border-b border-border">
          {(['text', 'poll', 'story-share'] as WireType[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 px-3 py-3 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition-colors',
                mode === m
                  ? 'bg-secondary text-secondary-foreground border-secondary'
                  : 'bg-transparent text-muted-foreground border-border hover:border-muted-foreground'
              )}
            >
              {m === 'text' && <FileText className="h-4 w-4" />}
              {m === 'poll' && <BarChart3 className="h-4 w-4" />}
              {m === 'story-share' && <Newspaper className="h-4 w-4" />}
              {m === 'text' ? 'Text' : m === 'poll' ? 'Poll' : 'Share story'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          {mode === 'text' && (
            <textarea
              autoFocus
              placeholder="What's the latest? Send a wire to your subscribers…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full min-h-[160px] resize-none bg-transparent border border-border rounded-xl p-3 text-base outline-none focus:border-secondary/50"
            />
          )}
          {mode === 'poll' && (
            <>
              <input
                autoFocus
                placeholder="Where do you stand?"
                value={pollQ}
                onChange={(e) => setPollQ(e.target.value)}
                className="w-full bg-transparent border border-border rounded-xl p-3 text-lg font-heading outline-none focus:border-secondary/50"
              />
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono px-1">
                5-point Likert · result groups: Friends, Contributors, Whole app
              </div>
              <div className="bg-muted/40 rounded-xl p-4 mt-2">
                <div className="relative h-6">
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-secondary" />
                  {[0, 25, 50, 75, 100].map(left => (
                    <div key={left} className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3.5 bg-secondary/55" style={{ left: `${left}%` }} />
                  ))}
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-6 bg-secondary rounded" style={{ left: '50%' }} />
                </div>
                <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-mono mt-2">
                  <span>Strongly disagree</span>
                  <span>Neutral</span>
                  <span>Strongly agree</span>
                </div>
              </div>
            </>
          )}
          {mode === 'story-share' && (
            <>
              <textarea
                autoFocus
                placeholder="Add a note about this story…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full min-h-[80px] resize-none bg-transparent border border-border rounded-xl p-3 text-base outline-none focus:border-secondary/50"
              />
              <div className="grid grid-cols-3 gap-2.5 max-h-[280px] overflow-y-auto">
                {MOCK_STORIES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStory(s.id)}
                    className={cn(
                      'border rounded-xl overflow-hidden text-left transition-colors',
                      selectedStory === s.id ? 'border-secondary' : 'border-border hover:border-muted-foreground'
                    )}
                  >
                    <img src={s.img} alt="" className="w-full aspect-square object-cover" />
                    <div className="p-2.5">
                      <div className="text-[9px] uppercase tracking-widest text-primary font-semibold mb-1 font-mono">{s.tag}</div>
                      <div className="text-xs leading-snug line-clamp-2">{s.title}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/20">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as WireVisibility)}
              className="text-xs bg-muted border border-border rounded-full px-3 py-1.5 cursor-pointer outline-none"
            >
              <option value="public">Public</option>
              <option value="subscribers">Subscribers</option>
              <option value="circle">Close circle</option>
            </select>
            <button className="inline-flex items-center gap-1.5 text-xs bg-muted border border-border rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground">
              <MessageSquare className="h-3 w-3" />
              Anyone can reply
            </button>
            <button className="inline-flex items-center gap-1.5 text-xs bg-muted border border-border rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground">
              <ImageIcon className="h-3 w-3" />
              Add image
            </button>
            <button className="inline-flex items-center gap-1.5 text-xs bg-muted border border-border rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground">
              <Calendar className="h-3 w-3" />
              Schedule
            </button>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="secondary" size="sm" disabled={!canSend}>Save draft</Button>
            <Button size="sm" disabled={!canSend} className="bg-primary hover:bg-primary/90 text-primary-foreground">Send wire</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
