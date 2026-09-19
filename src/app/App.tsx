import { OrchestraMap } from '../features/orchestra-map'
import { ChunkPlaybackPoc } from '../features/listening/chunk-playback'

export function isChunkPlaybackPoc() {
  return new URLSearchParams(window.location.search).has('chunk-poc')
}

export function App() {
  return isChunkPlaybackPoc() ? <ChunkPlaybackPoc /> : <OrchestraMap />
}
