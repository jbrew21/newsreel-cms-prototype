import { supabase } from './client'

// ── Types ────────────────────────────────────────────────────────────────────

export interface OverviewStats {
  totalCompletions: number
  uniqueReaders: number
  quizAccuracy: number
  avgPollResponse: number
  totalQuizzes: number
  totalPolls: number
}

export interface TimeSeriesPoint {
  date: string
  completions: number
  quizCorrect: number
  quizTotal: number
}

export interface StoryStats {
  storyId: string
  headline: string
  completions: number
  quizCorrect: number
  quizTotal: number
  quizAccuracy: number
  pollResponses: number
  avgPollValue: number
}

export interface QuizBreakdown {
  question: string
  correct: number
  incorrect: number
  accuracy: number
  storyHeadline: string
}

export interface PollBreakdown {
  question: string
  responseCount: number
  avgValue: number
  storyHeadline: string
  pollQuestionId: string
}

// ── Fetch author's story IDs ─────────────────────────────────────────────────

export async function getAuthorStoryIds(authorId: string): Promise<string[]> {
  const { data } = await supabase
    .from('authors_stories_links')
    .select('story_id')
    .eq('author_id', authorId)

  return data?.map(link => link.story_id) || []
}

// ── Overview stats ───────────────────────────────────────────────────────────

export async function getOverviewStats(storyIds: string[]): Promise<OverviewStats> {
  if (storyIds.length === 0) {
    return { totalCompletions: 0, uniqueReaders: 0, quizAccuracy: 0, avgPollResponse: 0, totalQuizzes: 0, totalPolls: 0 }
  }

  const [completions, quizzes, polls] = await Promise.all([
    supabase
      .from('completed_stories')
      .select('user_id, quiz_correct')
      .in('story_id', storyIds),
    supabase
      .from('quiz_completions')
      .select('is_correct')
      .in('story_id', storyIds),
    supabase
      .from('poll_responses_content')
      .select('response_value')
      .in('story_id', storyIds),
  ])

  const completionRows = completions.data || []
  const quizRows = quizzes.data || []
  const pollRows = polls.data || []

  const uniqueUsers = new Set(completionRows.map(r => r.user_id))

  const quizCorrect = quizRows.filter(r => r.is_correct).length
  const quizAccuracy = quizRows.length > 0 ? (quizCorrect / quizRows.length) * 100 : 0

  const avgPoll = pollRows.length > 0
    ? pollRows.reduce((sum, r) => sum + (r.response_value || 0), 0) / pollRows.length
    : 0

  return {
    totalCompletions: completionRows.length,
    uniqueReaders: uniqueUsers.size,
    quizAccuracy: Math.round(quizAccuracy * 10) / 10,
    avgPollResponse: Math.round(avgPoll * 100) / 100,
    totalQuizzes: quizRows.length,
    totalPolls: pollRows.length,
  }
}

// ── Time series (daily completions + quiz data) ──────────────────────────────

export async function getTimeSeries(
  storyIds: string[],
  days: number = 30
): Promise<TimeSeriesPoint[]> {
  if (storyIds.length === 0) return []

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const startStr = startDate.toISOString().split('T')[0]

  const [completions, quizzes] = await Promise.all([
    supabase
      .from('completed_stories')
      .select('completed_local_date, quiz_correct')
      .in('story_id', storyIds)
      .gte('completed_local_date', startStr),
    supabase
      .from('quiz_completions')
      .select('newsreel_date, is_correct')
      .in('story_id', storyIds)
      .gte('newsreel_date', startStr),
  ])

  const completionRows = completions.data || []
  const quizRows = quizzes.data || []

  // Build map of date -> stats
  const dateMap = new Map<string, TimeSeriesPoint>()

  // Initialize all dates
  for (let i = 0; i <= days; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().split('T')[0]
    dateMap.set(key, { date: key, completions: 0, quizCorrect: 0, quizTotal: 0 })
  }

  for (const row of completionRows) {
    const key = row.completed_local_date
    if (key && dateMap.has(key)) {
      dateMap.get(key)!.completions++
    }
  }

  for (const row of quizRows) {
    const key = row.newsreel_date
    if (key && dateMap.has(key)) {
      dateMap.get(key)!.quizTotal++
      if (row.is_correct) dateMap.get(key)!.quizCorrect++
    }
  }

  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
}

// ── Per-story breakdown ──────────────────────────────────────────────────────

export async function getStoryBreakdown(storyIds: string[]): Promise<StoryStats[]> {
  if (storyIds.length === 0) return []

  const [stories, completions, quizzes, polls] = await Promise.all([
    supabase
      .from('stories')
      .select('id, story_headline')
      .in('id', storyIds),
    supabase
      .from('completed_stories')
      .select('story_id')
      .in('story_id', storyIds),
    supabase
      .from('quiz_completions')
      .select('story_id, is_correct')
      .in('story_id', storyIds),
    supabase
      .from('poll_responses_content')
      .select('story_id, response_value')
      .in('story_id', storyIds),
  ])

  const storyRows = stories.data || []
  const completionRows = completions.data || []
  const quizRows = quizzes.data || []
  const pollRows = polls.data || []

  return storyRows.map(story => {
    const sc = completionRows.filter(r => r.story_id === story.id)
    const sq = quizRows.filter(r => r.story_id === story.id)
    const sp = pollRows.filter(r => r.story_id === story.id)

    const quizCorrect = sq.filter(r => r.is_correct).length
    const quizAccuracy = sq.length > 0 ? (quizCorrect / sq.length) * 100 : 0
    const avgPoll = sp.length > 0
      ? sp.reduce((sum, r) => sum + (r.response_value || 0), 0) / sp.length
      : 0

    return {
      storyId: story.id,
      headline: story.story_headline || 'Untitled',
      completions: sc.length,
      quizCorrect,
      quizTotal: sq.length,
      quizAccuracy: Math.round(quizAccuracy * 10) / 10,
      pollResponses: sp.length,
      avgPollValue: Math.round(avgPoll * 100) / 100,
    }
  }).sort((a, b) => b.completions - a.completions)
}

// ── Quiz question breakdown ──────────────────────────────────────────────────

export async function getQuizBreakdown(storyIds: string[]): Promise<QuizBreakdown[]> {
  if (storyIds.length === 0) return []

  const { data } = await supabase
    .from('quiz_completions')
    .select('quiz_question, is_correct, story_headline')
    .in('story_id', storyIds)

  if (!data) return []

  const questionMap = new Map<string, { correct: number; total: number; headline: string }>()

  for (const row of data) {
    const key = row.quiz_question || 'Unknown'
    if (!questionMap.has(key)) {
      questionMap.set(key, { correct: 0, total: 0, headline: row.story_headline || 'Untitled' })
    }
    const entry = questionMap.get(key)!
    entry.total++
    if (row.is_correct) entry.correct++
  }

  return Array.from(questionMap.entries())
    .map(([question, stats]) => ({
      question,
      correct: stats.correct,
      incorrect: stats.total - stats.correct,
      accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 1000) / 10 : 0,
      storyHeadline: stats.headline,
    }))
    .sort((a, b) => a.accuracy - b.accuracy) // worst first
}

// ── Poll breakdown ───────────────────────────────────────────────────────────

export async function getPollBreakdown(storyIds: string[]): Promise<PollBreakdown[]> {
  if (storyIds.length === 0) return []

  const { data } = await supabase
    .from('poll_responses_content')
    .select('poll_question_document_id, response_value, story_headline')
    .in('story_id', storyIds)

  if (!data) return []

  const pollMap = new Map<string, { values: number[]; headline: string }>()

  for (const row of data) {
    const key = row.poll_question_document_id || 'unknown'
    if (!pollMap.has(key)) {
      pollMap.set(key, { values: [], headline: row.story_headline || 'Untitled' })
    }
    pollMap.get(key)!.values.push(row.response_value || 0)
  }

  return Array.from(pollMap.entries())
    .map(([id, stats]) => ({
      pollQuestionId: id,
      question: `Poll in "${stats.headline}"`,
      responseCount: stats.values.length,
      avgValue: Math.round((stats.values.reduce((a, b) => a + b, 0) / stats.values.length) * 100) / 100,
      storyHeadline: stats.headline,
    }))
    .sort((a, b) => b.responseCount - a.responseCount)
}
