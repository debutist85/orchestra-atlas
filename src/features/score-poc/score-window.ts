import type { ScoreScope } from './selection'

export type ScoreWindow = { startMeasure: number; endMeasure: number }
export type MeasureTime = { measure: number; startSeconds: number; endSeconds: number }

// Page size is now driven by container width (score-adapter.ts's targetWidth,
// justified in score-runtime.worker.ts), not a fixed count — a wider or
// taller viewport shows more or fewer measures at a legible, height-filling
// scale instead of just scaling a fixed chunk up or down. `maxMeasures` is
// only a safety cap on how many bars the worker will ever try to fit onto
// one page, tuned generously per scope so it rarely binds in practice.
export function windowBudget(scope: ScoreScope) {
  return { behind: 2, maxMeasures: scope.level === 'orchestra' ? 16 : scope.level === 'family' ? 24 : 32 }
}
export function measureAt(seconds: number, timing: readonly MeasureTime[]): number {
  let lo = 0, hi = timing.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (timing[mid].startSeconds <= seconds) lo = mid + 1
    else hi = mid
  }
  return timing[Math.max(0, lo - 1)]?.measure ?? 1
}
// behindOverride lets a caller replace the scope's default look-back budget
// for a specific request — used to render zero already-passed measures when
// a page turn is triggered by ordinary forward playback (see
// score-adapter.ts), while deliberate actions like a seek or scope change
// keep some behind-context so the target measure isn't pinned to the page's
// very first (leftmost) column. The worker decides how many measures
// actually fit from this starting point (see score-runtime.worker.ts).
export function resolveStart(measure: number, scope: ScoreScope, total: number, behindOverride?: number): number {
  const { behind: scopeBehind } = windowBudget(scope)
  const behind = behindOverride ?? scopeBehind
  return Math.min(Math.max(1, measure - behind), total)
}
// Triggers only once the cursor reaches the page's true last measure, not
// before: requesting the next page even one measure early would turn the
// page while measures the viewer hadn't reached yet were still on screen.
// The previous page stays visible while the next one renders
// (score-adapter.ts), so this doesn't stall playback — it just means the
// swap can't happen before it's warranted.
export function needsWindow(measure: number, window: ScoreWindow | undefined, total: number) {
  if (!window || measure < window.startMeasure || measure > window.endMeasure) return true
  return window.endMeasure < total && measure >= window.endMeasure
}
