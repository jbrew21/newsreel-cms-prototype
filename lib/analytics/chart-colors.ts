/**
 * Centralized chart color tokens.
 * These map semantic names to HSL values that work in BOTH light and dark themes.
 * Keep in sync with globals.css CSS variables.
 */

export const CHART_COLORS: Record<string, string> = {
  primary: 'hsl(9, 100%, 63%)', // Newsreel Red
  secondary: 'hsl(45, 84%, 52%)', // Newsreel Yellow
  success: 'hsl(119, 75%, 38%)', // Green
  destructive: 'hsl(0, 79%, 48%)', // Red
  blue: 'hsl(210, 100%, 56%)',
  purple: 'hsl(270, 70%, 60%)',
  cyan: 'hsl(185, 80%, 50%)',
  pink: 'hsl(330, 80%, 60%)',
  orange: 'hsl(30, 90%, 55%)',
  teal: 'hsl(175, 70%, 45%)',
  indigo: 'hsl(245, 65%, 58%)',
}

export type ChartColorKey = keyof typeof CHART_COLORS

/** Resolve a color token to its HSL value. Falls through if already HSL. */
export function resolveChartColor(token: string): string {
  return CHART_COLORS[token] ?? token
}

/** A pleasant rotating palette for series with unknown counts. */
export const CHART_PALETTE: string[] = [
  CHART_COLORS.primary,
  CHART_COLORS.blue,
  CHART_COLORS.success,
  CHART_COLORS.purple,
  CHART_COLORS.cyan,
  CHART_COLORS.secondary,
  CHART_COLORS.pink,
  CHART_COLORS.orange,
  CHART_COLORS.teal,
  CHART_COLORS.indigo,
]

/** Sequential ramp for heatmap / intensity visualizations (low → high). */
export function heatmapColor(intensity: number): string {
  // intensity 0..1
  const t = Math.max(0, Math.min(1, intensity))
  // blend from muted (transparent primary) to full primary
  const alpha = 0.05 + t * 0.85
  return `hsl(9, 100%, 63%, ${alpha.toFixed(3)})`
}
