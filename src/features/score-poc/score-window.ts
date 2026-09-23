import type { ScoreScope } from './selection'

export type ScoreWindow = { startMeasure: number; endMeasure: number }
export type MeasureTime = { measure: number; startSeconds: number; endSeconds: number }

// Each window always renders exactly `count` measures — the adapter then
// scales that fixed chunk to fill the container on both axes (score-adapter.ts's
// applyFit), rather than rendering at natural size and scrolling through it.
// Tune per scope here: orchestra needs fewer, wider measures since its 19
// staves already eat most of the vertical scale budget; a single-instrument
// window can comfortably show more.
export function windowBudget(scope: ScoreScope) {
  return { behind: 2, count: scope.level === 'orchestra' ? 4 : scope.level === 'family' ? 6 : 8 }
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
// a window shift is triggered by ordinary forward playback (see
// score-adapter.ts), while deliberate actions like a seek or scope change
// keep some behind-context so the target measure isn't pinned to the
// window's very first (leftmost) column. It never changes the window's
// fixed `count`, only where that fixed span starts relative to `measure`.
export function resolveWindow(measure: number, scope: ScoreScope, total: number, behindOverride?: number): ScoreWindow {
  const { behind: scopeBehind, count: scopeCount } = windowBudget(scope)
  const behind = behindOverride ?? scopeBehind
  const count = Math.min(total, scopeCount)
  const startMeasure = Math.max(1, Math.min(measure - behind, total - count + 1))
  return { startMeasure, endMeasure: startMeasure + count - 1 }
}
export function sameWindow(a: ScoreWindow | undefined, b: ScoreWindow) {
  return a?.startMeasure === b.startMeasure && a.endMeasure === b.endMeasure
}
// Triggers only once the cursor reaches the window's true last measure, not
// before: with a small, fixed measure count per window (see windowBudget)
// and no more scrolling to smooth over, requesting the next window even one
// measure early made the page turn while measures the viewer hadn't reached
// yet were still sitting in the window. The previous window stays visible
// while the next one renders (score-adapter.ts), so this doesn't stall
// playback — it just means the swap can't happen before it's warranted.
export function needsWindow(measure: number, window: ScoreWindow | undefined, total: number) {
  if (!window || measure < window.startMeasure || measure > window.endMeasure) return true
  return window.endMeasure < total && measure >= window.endMeasure
}
