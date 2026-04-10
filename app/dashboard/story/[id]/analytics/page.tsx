import type { Metadata } from 'next'
import { StoryAnalyticsView } from '@/components/analytics/views/story-analytics-view'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return {
    title: 'Story Analytics · Newsreel',
    description: 'Detailed performance analytics for a Newsreel story',
    robots: { index: false, follow: false },
    other: { 'X-Story-Id': id },
  }
}

export default async function StoryAnalyticsPage({ params }: Props) {
  const { id } = await params
  return (
    <main className="min-h-screen bg-background">
      <StoryAnalyticsView storyId={id} />
    </main>
  )
}
