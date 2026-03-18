'use client'

import { useEffect, useState, useMemo } from 'react'
import { BookOpen, Users, Target, MessageSquare, TrendingUp, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatCard } from './stat-card'
import { AnalyticsAreaChart } from './area-chart'
import { AnalyticsBarChart } from './bar-chart'
import { AnalyticsDonutChart } from './donut-chart'
import { StoryTable } from './story-table'
import {
  getAuthorStoryIds,
  getOverviewStats,
  getTimeSeries,
  getStoryBreakdown,
  getQuizBreakdown,
  getPollBreakdown,
  type OverviewStats,
  type TimeSeriesPoint,
  type StoryStats,
  type QuizBreakdown,
  type PollBreakdown,
} from '@/lib/supabase/analytics'

// ── Types ────────────────────────────────────────────────────────────────────

type TimeRange = '7d' | '30d' | '90d' | 'all'

interface AnalyticsDashboardProps {
  authorId: string
  authorName: string
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="glass-card p-5">
      <div className="w-9 h-9 rounded-lg animate-shimmer mb-3" />
      <div className="h-7 w-20 animate-shimmer rounded mb-1" />
      <div className="h-3 w-28 animate-shimmer rounded" />
    </div>
  )
}

function SkeletonChart() {
  return (
    <div className="glass-card p-5">
      <div className="h-4 w-32 animate-shimmer rounded mb-1" />
      <div className="h-3 w-48 animate-shimmer rounded mb-4" />
      <div className="h-[280px] animate-shimmer rounded" />
    </div>
  )
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export function AnalyticsDashboard({ authorId, authorName }: AnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([])
  const [storyStats, setStoryStats] = useState<StoryStats[]>([])
  const [quizData, setQuizData] = useState<QuizBreakdown[]>([])
  const [pollData, setPollData] = useState<PollBreakdown[]>([])
  const [storyIds, setStoryIds] = useState<string[]>([])

  // ── Initial load ───────────────────────────────────────────────────

  useEffect(() => {
    loadData()
  }, [authorId])

  useEffect(() => {
    if (storyIds.length > 0) {
      loadTimeSeries()
    }
  }, [timeRange, storyIds])

  const loadData = async () => {
    setLoading(true)
    try {
      const ids = await getAuthorStoryIds(authorId)
      setStoryIds(ids)

      if (ids.length === 0) {
        setLoading(false)
        return
      }

      const [overviewData, timeData, stories, quizzes, polls] = await Promise.all([
        getOverviewStats(ids),
        getTimeSeries(ids, getDays(timeRange)),
        getStoryBreakdown(ids),
        getQuizBreakdown(ids),
        getPollBreakdown(ids),
      ])

      setOverview(overviewData)
      setTimeSeries(timeData)
      setStoryStats(stories)
      setQuizData(quizzes)
      setPollData(polls)
    } catch (err) {
      console.error('Analytics load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadTimeSeries = async () => {
    try {
      const data = await getTimeSeries(storyIds, getDays(timeRange))
      setTimeSeries(data)
    } catch (err) {
      console.error('Time series load error:', err)
    }
  }

  // ── Derived data ───────────────────────────────────────────────────

  const quizDonutData = useMemo(() => {
    if (!overview) return []
    const correct = overview.totalQuizzes > 0
      ? Math.round(overview.totalQuizzes * (overview.quizAccuracy / 100))
      : 0
    const incorrect = overview.totalQuizzes - correct
    return [
      { name: 'Correct', value: correct, color: 'success' },
      { name: 'Incorrect', value: incorrect, color: 'primary' },
    ]
  }, [overview])

  const topStoriesBar = useMemo(() => {
    return storyStats.slice(0, 8).map(s => ({
      name: s.headline.length > 25 ? s.headline.slice(0, 25) + '...' : s.headline,
      value: s.completions,
      label: 'completions',
    }))
  }, [storyStats])

  const quizAccuracyBar = useMemo(() => {
    return quizData.slice(0, 6).map(q => ({
      name: q.question.length > 30 ? q.question.slice(0, 30) + '...' : q.question,
      value: q.accuracy,
      label: 'accuracy %',
    }))
  }, [quizData])

  // ── Empty state ────────────────────────────────────────────────────

  if (!loading && storyIds.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-heading text-foreground mb-2">No analytics yet</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Publish your first story to start seeing reader engagement data here.
        </p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header with time range selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-base font-medium">Analytics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Performance across {storyIds.length} {storyIds.length === 1 ? 'story' : 'stories'}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border/50">
          {(['7d', '30d', '90d', 'all'] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
                timeRange === range
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {range === 'all' ? 'All' : range}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Completions"
            value={overview.totalCompletions}
            icon={<BookOpen className="h-4 w-4" />}
            color="primary"
            delay={0}
          />
          <StatCard
            label="Unique Readers"
            value={overview.uniqueReaders}
            icon={<Users className="h-4 w-4" />}
            color="accent"
            delay={100}
          />
          <StatCard
            label="Quiz Accuracy"
            value={overview.quizAccuracy}
            suffix="%"
            icon={<Target className="h-4 w-4" />}
            color="success"
            delay={200}
          />
          <StatCard
            label="Poll Responses"
            value={overview.totalPolls}
            icon={<MessageSquare className="h-4 w-4" />}
            color="secondary"
            delay={300}
          />
        </div>
      )}

      {/* Time series chart */}
      {loading ? (
        <SkeletonChart />
      ) : timeSeries.length > 0 && (
        <AnalyticsAreaChart
          data={timeSeries}
          xKey="date"
          yKeys={[
            { key: 'completions', label: 'Completions', color: 'primary' },
            { key: 'quizCorrect', label: 'Quiz Correct', color: 'success' },
          ]}
          title="Reader Activity"
          subtitle={`Daily completions & quiz performance — ${timeRangeLabel(timeRange)}`}
        />
      )}

      {/* Middle row: Top stories bar + Quiz donut */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            {topStoriesBar.length > 0 && (
              <AnalyticsBarChart
                data={topStoriesBar}
                title="Top Stories"
                subtitle="Ranked by total completions"
                color="primary"
                layout="vertical"
                height={Math.max(200, topStoriesBar.length * 40)}
              />
            )}
          </div>

          <div>
            {quizDonutData.length > 0 && overview && overview.totalQuizzes > 0 && (
              <AnalyticsDonutChart
                data={quizDonutData}
                title="Quiz Results"
                subtitle={`${overview.totalQuizzes.toLocaleString()} total attempts`}
                centerValue={`${overview.quizAccuracy}%`}
                centerLabel="accuracy"
              />
            )}
          </div>
        </div>
      )}

      {/* Quiz accuracy breakdown */}
      {!loading && quizAccuracyBar.length > 0 && (
        <AnalyticsBarChart
          data={quizAccuracyBar}
          title="Quiz Question Accuracy"
          subtitle="Hardest questions first — where readers struggle most"
          color="secondary"
          height={220}
        />
      )}

      {/* Story breakdown table */}
      {!loading && storyStats.length > 0 && (
        <StoryTable
          stories={storyStats}
          title="Story Performance"
          subtitle="Detailed breakdown of each story's engagement"
        />
      )}

      {/* Poll breakdown */}
      {!loading && pollData.length > 0 && (
        <div className="glass-card p-5 animate-chart-in">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-foreground">Poll Engagement</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Response distribution across your polls</p>
          </div>

          <div className="space-y-3">
            {pollData.map((poll, i) => (
              <div key={poll.pollQuestionId} className="flex items-center gap-4 py-2 border-b border-border/20 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground font-medium truncate">{poll.question}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {poll.responseCount} {poll.responseCount === 1 ? 'response' : 'responses'}
                  </p>
                </div>

                <div className="w-32 flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-secondary transition-all duration-700"
                      style={{ width: `${poll.avgValue * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-foreground w-10 text-right">
                    {Math.round(poll.avgValue * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDays(range: TimeRange): number {
  switch (range) {
    case '7d': return 7
    case '30d': return 30
    case '90d': return 90
    case 'all': return 365
  }
}

function timeRangeLabel(range: TimeRange): string {
  switch (range) {
    case '7d': return 'last 7 days'
    case '30d': return 'last 30 days'
    case '90d': return 'last 90 days'
    case 'all': return 'all time'
  }
}
