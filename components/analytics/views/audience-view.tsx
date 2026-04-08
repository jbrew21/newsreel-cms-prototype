'use client'

/**
 * Audience sub-view — demographics, geography, devices, loyalty, heatmap.
 */

import { WorldMap } from '../world-map'
import { DeviceBreakdown } from '../device-breakdown'
import { DomainBreakdown } from '../domain-breakdown'
import { LoyaltyHistogram } from '../loyalty-histogram'
import { HoursHeatmap } from '../hours-heatmap'
import type { AuthorAnalyticsBundle } from '@/lib/analytics/dashboard-types'
import { AudienceSkeleton } from './skeletons'

interface AudienceViewProps {
  bundle: AuthorAnalyticsBundle | null
  loading: boolean
}

export function AudienceView({ bundle, loading }: AudienceViewProps) {
  if (loading && !bundle) {
    return <AudienceSkeleton />
  }

  if (!bundle) return null

  return (
    <div className="space-y-6">
      <WorldMap data={bundle.countries} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DomainBreakdown data={bundle.domains} />
        <div className="space-y-4">
          <DeviceBreakdown data={bundle.devices} />
          <LoyaltyHistogram data={bundle.loyalty} />
        </div>
      </div>

      <HoursHeatmap cells={bundle.heatmap} />
    </div>
  )
}
