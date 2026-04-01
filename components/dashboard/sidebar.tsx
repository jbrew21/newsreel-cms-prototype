'use client'

import { useRouter } from 'next/navigation'
import { Plus, LogOut, Users, Pencil, FileText, BarChart3, Wand2, ChevronDown } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

export type TabId = 'drafts' | 'published' | 'all' | 'analytics' | 'transform'

export interface NavItem {
  id: TabId
  label: string
  count?: number
  icon?: React.ReactNode
  visible?: boolean
}

interface SidebarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onNewStory: () => void
  onLogout: () => void
  navItems: NavItem[]
  authorId?: string | null
  authorName: string
  authorAvatar?: string | null
  authorInitials: string
  isOpen: boolean
  onClose: () => void
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({
  activeTab,
  onTabChange,
  onNewStory,
  onLogout,
  navItems,
  authorId,
  authorName,
  authorAvatar,
  authorInitials,
  isOpen,
  onClose,
}: SidebarProps) {
  const router = useRouter()

  const openProfile = () => {
    if (authorId) {
      router.push(`/author/${authorId}`)
      onClose()
    }
  }

  const openEditProfile = () => {
    router.push('/onboarding?edit=true')
    onClose()
  }

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          'md:hidden fixed inset-0 bg-black/60 z-40 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <aside
        className={cn(
          'w-[240px] bg-card border-r border-border flex flex-col flex-shrink-0',
          'fixed md:sticky top-0 h-screen z-50',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Logo + theme toggle */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <Logo width={64} height={64} />
          <ThemeToggle />
        </div>

        {/* New Story button */}
        <div className="px-4 py-4">
          <button
            onClick={onNewStory}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            New Story
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pt-1 space-y-1">
          {/* Stories — top-level tab with sub-tabs */}
          {(() => {
            const isStoriesActive = activeTab === 'drafts' || activeTab === 'published' || activeTab === 'all'
            const storySubItems = navItems.filter(item => item.id !== 'analytics' && item.id !== 'transform' && item.visible !== false)

            return (
              <div>
                <button
                  onClick={() => {
                    if (!isStoriesActive) {
                      onTabChange('drafts')
                      onClose()
                    }
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
                    isStoriesActive
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Stories
                  </span>
                  <ChevronDown className={cn(
                    'h-3 w-3 text-muted-foreground transition-transform duration-200',
                    isStoriesActive ? 'rotate-0' : '-rotate-90'
                  )} />
                </button>

                {/* Sub-tabs — visible when Stories is active */}
                <div className={cn(
                  'overflow-hidden transition-all duration-200',
                  isStoriesActive ? 'max-h-40 opacity-100 mt-0.5' : 'max-h-0 opacity-0'
                )}>
                  <div className="ml-3 pl-3 border-l border-border/50 space-y-0.5">
                    {storySubItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          onTabChange(item.id)
                          onClose()
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-all duration-200',
                          activeTab === item.id
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                        )}
                      >
                        <span>{item.label}</span>
                        {item.count !== undefined && item.count > 0 && (
                          <span className="text-xs text-muted-foreground">{item.count}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Analytics — top-level tab */}
          <button
            onClick={() => {
              onTabChange('analytics')
              onClose()
            }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
              activeTab === 'analytics'
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Analytics
          </button>

          {/* Transform — top-level tab */}
          <button
            onClick={() => {
              onTabChange('transform')
              onClose()
            }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
              activeTab === 'transform'
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
          >
            <Wand2 className="h-3.5 w-3.5" />
            Transform
          </button>
        </nav>

        {/* Bottom: Author + Sign out */}
        <div className="px-3 py-3 border-t border-border space-y-1">
          {/* Author row: avatar + name (click → profile), pencil (click → edit) */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg group">
            <button
              onClick={openProfile}
              className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity duration-200"
            >
              {authorAvatar ? (
                <img src={authorAvatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] text-primary font-medium flex-shrink-0">
                  {authorInitials}
                </div>
              )}
              <span className="text-sm text-foreground truncate">{authorName}</span>
            </button>
            <button
              onClick={openEditProfile}
              className="p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent/50 transition-all duration-200 flex-shrink-0"
              aria-label="Edit profile"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors duration-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}

// ── Mobile Header ────────────────────────────────────────────────────────────

export function MobileHeader({
  onToggleSidebar,
  onNewStory,
}: {
  onToggleSidebar: () => void
  onNewStory: () => void
}) {
  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
      <button
        onClick={onToggleSidebar}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Toggle menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>
      <Logo width={48} height={48} />
      <button
        onClick={onNewStory}
        className="text-primary text-sm font-medium"
      >
        + New
      </button>
    </div>
  )
}
