export type ScoreAnchor = { timeSeconds: number; x: number; y: number; height: number; systemId: number }
export type PlayheadPoint = Omit<ScoreAnchor, 'timeSeconds'>

// Duplicate times at a system boundary select the new system (never draw a diagonal).
export function playheadAt(seconds: number, anchors: readonly ScoreAnchor[]): PlayheadPoint | null {
  if (!anchors.length || seconds < anchors[0].timeSeconds || seconds > anchors[anchors.length - 1].timeSeconds) return null
  let lo = 0, hi = anchors.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (anchors[mid].timeSeconds <= seconds) lo = mid + 1
    else hi = mid
  }
  const a = anchors[Math.max(0, lo - 1)], b = anchors[lo] ?? a
  const fraction = b.timeSeconds > a.timeSeconds && a.systemId === b.systemId
    ? Math.max(0, Math.min(1, (seconds - a.timeSeconds) / (b.timeSeconds - a.timeSeconds))) : 0
  return { x: a.x + (b.x - a.x) * fraction, y: a.y, height: a.height, systemId: a.systemId }
}
