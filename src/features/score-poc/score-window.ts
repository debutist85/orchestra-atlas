import type { ScoreScope } from './selection'

export type ScoreWindow = { startMeasure: number; endMeasure: number }
export type MeasureTime = { measure: number; startSeconds: number; endSeconds: number }

// Experimental horizons, in measures. Keep policy independent of engraving types.
export function windowBudget(scope: ScoreScope) {
  return { behind: 2, ahead: scope.level === 'orchestra' ? 3 : scope.level === 'family' ? 5 : 9 }
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
export function resolveWindow(measure: number, scope: ScoreScope, total: number): ScoreWindow {
  const { behind, ahead } = windowBudget(scope)
  const count = Math.min(total, behind + 1 + ahead)
  const startMeasure = Math.max(1, Math.min(measure - behind, total - count + 1))
  return { startMeasure, endMeasure: startMeasure + count - 1 }
}
export function sameWindow(a: ScoreWindow | undefined, b: ScoreWindow) {
  return a?.startMeasure === b.startMeasure && a.endMeasure === b.endMeasure
}
export function needsWindow(measure: number, window: ScoreWindow | undefined, total: number) {
  return !window || measure < window.startMeasure || measure > window.endMeasure ||
    (window.endMeasure < total && measure >= window.endMeasure - 1)
}
