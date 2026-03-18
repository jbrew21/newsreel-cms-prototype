'use client'

import { cn } from '@/lib/utils'
import { BookOpen, Target, MessageSquare, TrendingUp } from 'lucide-react'
import type { StoryStats } from '@/lib/supabase/analytics'

interface StoryTableProps {
  stories: StoryStats[]
  title: string
  subtitle?: string
}

export function StoryTable({ stories, title, subtitle }: StoryTableProps) {
  if (stories.length === 0) return null

  return (
    <div className="glass-card p-5 animate-chart-in">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Story</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">
                <span className="flex items-center justify-end gap-1"><BookOpen className="h-3 w-3" /> Reads</span>
              </th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">
                <span className="flex items-center justify-end gap-1"><Target className="h-3 w-3" /> Quiz %</span>
              </th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">
                <span className="flex items-center justify-end gap-1"><MessageSquare className="h-3 w-3" /> Polls</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {stories.map((story, i) => {
              const maxCompletions = Math.max(...stories.map(s => s.completions), 1)
              const barWidth = (story.completions / maxCompletions) * 100

              return (
                <tr key={story.storyId} className="border-b border-border/20 last:border-0 group">
                  <td className="py-3 pr-4">
                    <div className="max-w-[260px]">
                      <p className="text-foreground font-medium truncate group-hover:text-primary transition-colors">
                        {story.headline}
                      </p>
                      <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all duration-700"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-3 px-3">
                    <span className="text-foreground font-medium">{story.completions.toLocaleString()}</span>
                  </td>
                  <td className="text-right py-3 px-3">
                    {story.quizTotal > 0 ? (
                      <span className={cn(
                        'font-medium',
                        story.quizAccuracy >= 70 ? 'text-success' :
                        story.quizAccuracy >= 40 ? 'text-secondary' : 'text-destructive'
                      )}>
                        {story.quizAccuracy}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="text-right py-3 px-3">
                    {story.pollResponses > 0 ? (
                      <span className="text-foreground font-medium">{story.pollResponses}</span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
