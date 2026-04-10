'use client'

import { useMemo, useState } from 'react'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompact } from '@/lib/formatters'
import { countryFlag, countryName } from '@/lib/formatters'
import type { CountryStat } from '@/lib/analytics/dashboard-types'

interface WorldMapProps {
  data: CountryStat[]
  title?: string
  subtitle?: string
  className?: string
}

// Approximate (lat, lon) centroids for the most common countries.
// Used to place activity dots on the world map. This is lightweight
// (≈60 entries, ~2KB) compared to pulling in a full geojson library.
// Coordinates are in standard lat/lon degrees.
const COUNTRY_COORDS: Record<string, { lat: number; lon: number }> = {
  US: { lat: 39.5, lon: -98.35 },
  CA: { lat: 56.13, lon: -106.35 },
  MX: { lat: 23.63, lon: -102.55 },
  BR: { lat: -14.24, lon: -51.92 },
  AR: { lat: -38.42, lon: -63.62 },
  CL: { lat: -35.68, lon: -71.54 },
  PE: { lat: -9.19, lon: -75.02 },
  CO: { lat: 4.57, lon: -74.3 },
  VE: { lat: 6.42, lon: -66.59 },
  GB: { lat: 55.38, lon: -3.44 },
  IE: { lat: 53.14, lon: -7.69 },
  FR: { lat: 46.23, lon: 2.21 },
  ES: { lat: 40.46, lon: -3.75 },
  PT: { lat: 39.4, lon: -8.22 },
  DE: { lat: 51.17, lon: 10.45 },
  IT: { lat: 41.87, lon: 12.57 },
  NL: { lat: 52.13, lon: 5.29 },
  BE: { lat: 50.5, lon: 4.47 },
  CH: { lat: 46.82, lon: 8.23 },
  AT: { lat: 47.52, lon: 14.55 },
  SE: { lat: 60.13, lon: 18.64 },
  NO: { lat: 60.47, lon: 8.47 },
  FI: { lat: 61.92, lon: 25.75 },
  DK: { lat: 56.26, lon: 9.5 },
  IS: { lat: 64.96, lon: -19.02 },
  PL: { lat: 51.92, lon: 19.15 },
  CZ: { lat: 49.82, lon: 15.47 },
  RO: { lat: 45.94, lon: 24.97 },
  GR: { lat: 39.07, lon: 21.82 },
  TR: { lat: 38.96, lon: 35.24 },
  RU: { lat: 61.52, lon: 105.32 },
  UA: { lat: 48.38, lon: 31.17 },
  EG: { lat: 26.82, lon: 30.8 },
  MA: { lat: 31.79, lon: -7.09 },
  ZA: { lat: -30.56, lon: 22.94 },
  NG: { lat: 9.08, lon: 8.68 },
  KE: { lat: -0.02, lon: 37.91 },
  ET: { lat: 9.15, lon: 40.49 },
  SA: { lat: 23.89, lon: 45.08 },
  AE: { lat: 23.42, lon: 53.85 },
  IL: { lat: 31.05, lon: 34.85 },
  IR: { lat: 32.43, lon: 53.69 },
  PK: { lat: 30.38, lon: 69.35 },
  IN: { lat: 20.59, lon: 78.96 },
  BD: { lat: 23.68, lon: 90.36 },
  LK: { lat: 7.87, lon: 80.77 },
  CN: { lat: 35.86, lon: 104.2 },
  JP: { lat: 36.2, lon: 138.25 },
  KR: { lat: 35.91, lon: 127.77 },
  KP: { lat: 40.34, lon: 127.51 },
  TH: { lat: 15.87, lon: 100.99 },
  VN: { lat: 14.06, lon: 108.28 },
  MY: { lat: 4.21, lon: 101.98 },
  SG: { lat: 1.35, lon: 103.82 },
  ID: { lat: -0.79, lon: 113.92 },
  PH: { lat: 12.88, lon: 121.77 },
  AU: { lat: -25.27, lon: 133.78 },
  NZ: { lat: -40.9, lon: 174.89 },
}

// Simple equirectangular projection (lon -180..180 → 0..W, lat 90..-90 → 0..H)
function project(lat: number, lon: number, w: number, h: number): { x: number; y: number } {
  const x = ((lon + 180) / 360) * w
  const y = ((90 - lat) / 180) * h
  return { x, y }
}

/**
 * Stylized world map using a continent dot-grid pattern + live data dots.
 * The base layer is a pre-computed grid of dots that forms the shape of
 * continents. The top layer overlays colored markers proportional to
 * country view counts.
 */

// Pre-computed continent dot pattern (simplified silhouette using a 80x40 grid)
// Each string represents a row — '#' = land, ' ' = ocean
const CONTINENT_GRID: string[] = [
  '                                                                                ',
  '            ########  ######      #####    #####                               ',
  '         ##############  #####    ##############  #####                        ',
  '      #################### ######  #################### ######                 ',
  '    ##########################  #####################                          ',
  '     #######################   #####################  ##                       ',
  '      ####################    #########  ############                          ',
  '        ####### ##########      ######    ##############                       ',
  '           ###   #########       #####     #############                       ',
  '                   ########      ######     ############ ##                    ',
  '                    #######      #####       ##########   ##                   ',
  '                     ######      #####        ########     #                   ',
  '                     ######      ####          ######                          ',
  '                      #####      ####           #####                          ',
  '                       ####      ####            ####                          ',
  '                       ####       ###             ###                          ',
  '                       ####       ###              ##                          ',
  '                        ###       ##                #                          ',
  '                        ###       ##                                           ',
  '                         ##       #                                            ',
  '                         ##       #                                            ',
  '                          #                                                    ',
  '                          #                                                    ',
  '                                                                                ',
  '                                                                                ',
]

export function WorldMap({
  data,
  title = 'Where your readers come from',
  subtitle = 'Geographic distribution of story opens',
  className,
}: WorldMapProps) {
  const [hovered, setHovered] = useState<CountryStat | null>(null)

  const { placed, unmapped, totalViews } = useMemo(() => {
    const placed: (CountryStat & { x: number; y: number })[] = []
    const unmapped: CountryStat[] = []
    let totalViews = 0
    for (const d of data) {
      totalViews += d.views
      const coords = COUNTRY_COORDS[d.country?.toUpperCase()]
      if (coords) {
        const { x, y } = project(coords.lat, coords.lon, 800, 400)
        placed.push({ ...d, x, y })
      } else {
        unmapped.push(d)
      }
    }
    return { placed, unmapped, totalViews }
  }, [data])

  const maxViews = Math.max(...data.map((d) => d.views), 1)

  // Generate the continent background dots once
  const backgroundDots = useMemo(() => {
    const dots: { x: number; y: number }[] = []
    const rows = CONTINENT_GRID.length
    const cols = Math.max(...CONTINENT_GRID.map((r) => r.length))
    const cellW = 800 / cols
    const cellH = 400 / rows
    for (let r = 0; r < rows; r++) {
      const row = CONTINENT_GRID[r]
      for (let c = 0; c < row.length; c++) {
        if (row[c] === '#') {
          dots.push({ x: c * cellW + cellW / 2, y: r * cellH + cellH / 2 })
        }
      }
    }
    return dots
  }, [])

  return (
    <div className={cn('glass-card p-5 animate-chart-in', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            {title}
          </h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {data.length} {data.length === 1 ? 'country' : 'countries'}
          </p>
          <p className="text-xs font-medium text-foreground tabular-nums">
            {formatCompact(totalViews)} views
          </p>
        </div>
      </div>

      {totalViews === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          No location data for this period yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,200px] gap-4">
          {/* Map */}
          <div className="relative">
            <div className="aspect-[2/1] w-full rounded-lg bg-muted/20 overflow-hidden border border-border/30">
              <svg viewBox="0 0 800 400" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                {/* Continent background dots */}
                {backgroundDots.map((dot, i) => (
                  <circle
                    key={i}
                    cx={dot.x}
                    cy={dot.y}
                    r={1.4}
                    fill="hsl(0, 0%, 50%)"
                    fillOpacity={0.22}
                  />
                ))}

                {/* Data markers */}
                {placed.map((p, i) => {
                  const intensity = p.views / maxViews
                  const radius = 4 + intensity * 14
                  const isHovered = hovered?.country === p.country
                  return (
                    <g
                      key={i}
                      className="cursor-pointer"
                      onMouseEnter={() => setHovered(p)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={radius + 6}
                        fill="hsl(9, 100%, 63%)"
                        fillOpacity={isHovered ? 0.35 : 0.18}
                        className="transition-all duration-200"
                      />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={radius}
                        fill="hsl(9, 100%, 63%)"
                        fillOpacity={isHovered ? 1 : 0.85}
                        stroke="hsl(var(--card))"
                        strokeWidth={1.5}
                        className="transition-all duration-200"
                      />
                    </g>
                  )
                })}
              </svg>

              {/* Hover tooltip */}
              {hovered && (
                <div className="absolute top-2 left-2 glass-card px-3 py-2 !border-border/40 shadow-lg pointer-events-none">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{countryFlag(hovered.country)}</span>
                    <div>
                      <p className="text-xs font-medium text-foreground">{countryName(hovered.country)}</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {formatCompact(hovered.views)} views ·{' '}
                        {formatCompact(hovered.uniqueViewers)} readers
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top countries list */}
          <div className="space-y-1.5 overflow-y-auto max-h-[200px] lg:max-h-none">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Top countries
            </p>
            {data.slice(0, 8).map((country) => {
              const pct = country.views / maxViews
              return (
                <div
                  key={country.country}
                  className="flex items-center gap-2 group cursor-pointer"
                  onMouseEnter={() => setHovered(country)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span className="text-sm w-5 flex-shrink-0" aria-hidden>
                    {countryFlag(country.country)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-foreground truncate group-hover:text-primary transition-colors">
                        {countryName(country.country)}
                      </span>
                      <span className="tabular-nums text-muted-foreground font-medium">
                        {formatCompact(country.views)}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-muted/50 mt-1 overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full transition-all duration-700"
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
            {unmapped.length > 0 && (
              <p className="text-[9px] text-muted-foreground/60 pt-2 mt-2 border-t border-border/30">
                +{unmapped.length} other {unmapped.length === 1 ? 'country' : 'countries'} not shown on map
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
