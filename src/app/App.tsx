import { lazy, Suspense } from 'react'
import { OrchestraMap } from '../features/orchestra-map'
import { ChunkPlaybackPoc } from '../features/listening/chunk-playback'

const ScorePoc = lazy(() => import('../features/score-poc/ScorePoc'))

export function isChunkPlaybackPoc() {
  return new URLSearchParams(window.location.search).has('chunk-poc')
}

export function App() {
  if (new URLSearchParams(window.location.search).has('score-poc')) {
    return <Suspense fallback={<p role="status">Loading score evaluation…</p>}><ScorePoc /></Suspense>
  }
  return isChunkPlaybackPoc() ? <ChunkPlaybackPoc /> : <OrchestraMap />
}
