import type { Metadata } from 'next'
import { MobileSlidePreview } from '@/components/preview/mobile-slide-preview'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return {
    title: 'Newsreel Story Preview',
    description: 'Interactive mobile story preview powered by Newsreel',
    robots: { index: false, follow: false },
    other: {
      'X-Story-Id': id,
    },
  }
}

export default async function StoryEmbedPage({ params }: Props) {
  const { id } = await params

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <MobileSlidePreview storyId={id} />
    </div>
  )
}
