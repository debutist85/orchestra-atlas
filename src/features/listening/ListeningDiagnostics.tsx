import { useEffect, useState } from 'react'
import { listeningEngine, type ListeningDiagnostics as Snapshot } from './listening-engine'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const mb = bytes / 1024 / 1024
  return `${mb >= 10 ? mb.toFixed(1) : mb.toFixed(2)} MB`
}

export function ListeningDiagnostics() {
  const [snap, setSnap] = useState<Snapshot | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setSnap(listeningEngine.diagnostics()), 250)
    return () => window.clearInterval(id)
  }, [])

  if (!snap) return null
  return (
    <pre className="listening-diagnostics">
      {JSON.stringify({
        focus: snap.focusMode,
        preparing: snap.preparing,
        ready: snap.focusReady,
        transition: snap.transition,
        time: Number(snap.transportTime.toFixed(3)),
        media: Number(snap.mediaTime.toFixed(3)),
        drift: Number(snap.mediaDrift.toFixed(3)),
        intensity: Number(snap.selectedIntensity.toFixed(3)),
        average: Number(snap.orchestraAverage.toFixed(3)),
        background: Number(snap.backgroundGain.toFixed(3)),
        focusGain: Number(snap.dynamicFocusGain.toFixed(3)),
        chunk: snap.chunkIndex,
        offset: Number(snap.chunkOffset.toFixed(3)),
        stems: snap.stemCount,
        ids: snap.stems,
        loaded: snap.loadedChunks,
        scheduled: snap.scheduledChunks,
        buffers: snap.bufferCount,
        pcm: formatBytes(snap.pcmBytes),
        fetchMs: Number(snap.lastFetchMs.toFixed(1)),
        decodeMs: Number(snap.lastDecodeMs.toFixed(1)),
        late: snap.lateSchedules,
        failure: snap.lastFailure,
      }, null, 2)}
    </pre>
  )
}
