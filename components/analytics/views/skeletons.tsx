'use client'

/**
 * Skeleton loaders used while analytics bundles are loading.
 * Match the final layout so there's no layout shift.
 */

function Card({ height = 120 }: { height?: number }) {
  return (
    <div className="glass-card p-5">
      <div className="h-3 w-24 animate-shimmer rounded mb-3" />
      <div className="animate-shimmer rounded" style={{ height }} />
    </div>
  )
}

function Stat() {
  return (
    <div className="glass-card p-5">
      <div className="w-9 h-9 rounded-lg animate-shimmer mb-3" />
      <div className="h-7 w-20 animate-shimmer rounded mb-1" />
      <div className="h-3 w-28 animate-shimmer rounded" />
    </div>
  )
}

export function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => <Stat key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card height={260} />
        <div className="lg:col-span-2">
          <Card height={260} />
        </div>
      </div>
      <Card height={300} />
    </div>
  )
}

export function ContentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Stat key={i} />)}
      </div>
      <Card height={480} />
    </div>
  )
}

export function AudienceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card height={360} />
        <div className="space-y-4">
          <Card height={160} />
          <Card height={180} />
        </div>
      </div>
      <Card height={260} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card height={260} />
        <Card height={260} />
      </div>
    </div>
  )
}

export function StoryAnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <div className="flex gap-4">
          <div className="w-24 h-24 rounded-lg animate-shimmer flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-2/3 animate-shimmer rounded" />
            <div className="h-3 w-1/3 animate-shimmer rounded" />
            <div className="h-3 w-1/2 animate-shimmer rounded" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => <Stat key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card height={260} />
        <Card height={260} />
      </div>
      <Card height={240} />
    </div>
  )
}
