// Opt-in counters only: timings describe CPU submission, never GPU duration.
export function createExplorationDiagnostics() {
  const counters = {
    renders: 0, resizeCallbacks: 0, bufferResizes: 0,
    anchorPasses: 0, raycasts: 0, anchorPublications: 0,
    cpuRenderMs: 0, lastDrawCalls: 0, lastTriangles: 0,
    geometries: 0, textures: 0,
  }
  const frames: number[] = []
  let lastFrame: number | undefined
  let wasActive = false
  return {
    counters,
    frame(now: number, active: boolean) {
      // Exclude idle gaps and the first frame after work resumes.
      if (active && wasActive && lastFrame !== undefined) {
        frames.push(now - lastFrame)
        if (frames.length > 600) frames.shift()
      }
      lastFrame = now
      wasActive = active
    },
    snapshot() {
      const sorted = [...frames].sort((a, b) => a - b)
      const percentile = (p: number) => sorted.length ? sorted[Math.ceil(sorted.length * p) - 1] : null
      return { ...counters, activeFrameSamples: sorted.length, p95FrameMs: percentile(0.95), p99FrameMs: percentile(0.99) }
    },
  }
}
