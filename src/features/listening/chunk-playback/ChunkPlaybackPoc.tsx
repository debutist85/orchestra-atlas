import { useEffect, useMemo, useRef, useState } from 'react'
import { currentExcerpt } from '../excerpt'
import { formatPlaybackTime } from '../playback'
import {
  chunkStemIdsForInstrument, defaultChunkFamily, familiesWithChunks, fetchChunkManifest, instrumentsWithChunks,
} from './assets'
import { createChunkPlaybackEngine, type ChunkPlaybackSnapshot } from './engine'
import type { ChunkManifest } from './transport'
import type { FamilyId } from '../../orchestra-map/utils/navigation'
import type { OrchestraInstrument } from '../../orchestra-map/config'

const empty: ChunkPlaybackSnapshot = {
  status: 'idle',
  playing: false,
  position: 0,
  duration: 0,
  chunkIndex: 0,
  chunkOffset: 0,
  stemCount: 0,
  stems: [],
  loadedChunks: [],
  scheduledChunks: [],
  bufferCount: 0,
  pcmBytes: 0,
  lastFetchMs: 0,
  lastDecodeMs: 0,
  lateSchedules: 0,
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const mb = bytes / 1024 / 1024
  return `${mb >= 10 ? mb.toFixed(1) : mb.toFixed(2)} MB`
}

export function ChunkPlaybackPoc() {
  const [engine] = useState(() => createChunkPlaybackEngine())
  const [snap, setSnap] = useState(empty)
  const [manifest, setManifest] = useState<ChunkManifest | null>(null)
  const [familyId, setFamilyId] = useState<FamilyId>('strings')
  const [instrumentId, setInstrumentId] = useState<OrchestraInstrument | null>(null)
  const [scrub, setScrub] = useState<number | null>(null)
  const dragging = useRef(false)
  const families = useMemo(
    () => manifest ? familiesWithChunks(currentExcerpt, manifest) : [],
    [manifest],
  )
  const instruments = useMemo(
    () => manifest ? instrumentsWithChunks(currentExcerpt, manifest) : [],
    [manifest],
  )

  useEffect(() => {
    const stop = engine.subscribe(() => setSnap(engine.snapshot()))
    void (async () => {
      const loaded = await fetchChunkManifest(currentExcerpt)
      setManifest(loaded)
      await engine.load(currentExcerpt)
      // Default to a single instrument, not a family — isolating one
      // instrument's chunks (no layering with anything else, same
      // buffering/preloading path as production) is the whole point of
      // this page.
      const cello = instrumentsWithChunks(currentExcerpt, loaded).find(id => id === 'cello')
      const initialInstrument = cello ?? instrumentsWithChunks(currentExcerpt, loaded)[0]
      if (initialInstrument) {
        setInstrumentId(initialInstrument)
        engine.setStems(chunkStemIdsForInstrument(currentExcerpt, initialInstrument, loaded))
      } else {
        const initial = defaultChunkFamily(currentExcerpt, loaded)
        if (initial) {
          setFamilyId(initial.id)
          engine.setStems(initial.stems)
        }
      }
    })()
    return () => {
      stop()
      engine.dispose()
    }
  }, [engine])

  const selected = instrumentId
    ? (manifest ? chunkStemIdsForInstrument(currentExcerpt, instrumentId, manifest) : snap.stems)
    : families.find(family => family.id === familyId)?.stems ?? snap.stems
  const displayTime = scrub ?? snap.position

  useEffect(() => {
    if (scrub === null || dragging.current) return
    if (Math.abs(snap.position - scrub) < 0.35) setScrub(null)
  }, [scrub, snap.position])

  const commitSeek = (next: number) => {
    setScrub(next)
    engine.seek(next)
  }

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 720 }}>
      <p><a href="/">Back to map</a></p>
      <h1>Chunked playback POC</h1>
      <p>
        {currentExcerpt.title}. Isolated from the production player — plays a
        stem's chunks straight to the output through the same scheduler/
        buffering/preloading code production uses, with no focus-bus boost,
        background bed, or limiter layered on top. Useful for A/B-ing
        against the raw WAV master to tell chunk-scheduling bugs apart from
        mixing/gain-riding ones.
      </p>
      {snap.status === 'error' ? <p>{snap.error}</p> : null}
      <p>
        <label>
          Instrument (solo, no layering)
          <select
            value={instrumentId ?? ''}
            onChange={event => {
              const id = event.target.value as OrchestraInstrument
              setInstrumentId(id)
              if (manifest) engine.setStems(chunkStemIdsForInstrument(currentExcerpt, id, manifest))
            }}
          >
            {instruments.map(instrument => (
              <option key={instrument} value={instrument}>{instrument}</option>
            ))}
          </select>
        </label>
      </p>
      <p>
        <label>
          Family
          <select
            value={familyId}
            onChange={event => {
              const id = event.target.value as FamilyId
              setFamilyId(id)
              setInstrumentId(null)
              const family = families.find(item => item.id === id)
              if (family) engine.setStems(family.stems)
            }}
          >
            {families.map(family => (
              <option key={family.id} value={family.id}>
                {family.id} ({family.stems.length})
              </option>
            ))}
          </select>
        </label>
      </p>
      <p>
        <button type="button" onClick={() => engine.play()} disabled={snap.status !== 'ready'}>Play</button>
        {' '}
        <button type="button" onClick={() => engine.pause()}>Pause</button>
      </p>
      <p>
        <label>
          Seek
          <input
            type="range"
            min={0}
            max={snap.duration || 1}
            step={0.01}
            value={displayTime}
            disabled={snap.status !== 'ready'}
            style={{ width: '100%', display: 'block', marginTop: 8 }}
            onPointerDown={event => {
              dragging.current = true
              event.currentTarget.setPointerCapture(event.pointerId)
              setScrub(snap.position)
            }}
            onInput={event => setScrub(Number(event.currentTarget.value))}
            onPointerUp={event => {
              dragging.current = false
              commitSeek(Number(event.currentTarget.value))
            }}
            onChange={event => {
              if (dragging.current) return
              commitSeek(Number(event.currentTarget.value))
            }}
          />
        </label>
        {formatPlaybackTime(displayTime)} / {formatPlaybackTime(snap.duration)}
      </p>
      <p>
        Jump
        {['0', '14.8', '15.2', '29.8', '44.8', '93.5', '430'].map(value => (
          <button key={value} type="button" onClick={() => engine.seek(Number(value))} style={{ marginLeft: 8 }}>
            {value}s
          </button>
        ))}
      </p>
      <pre>
        {JSON.stringify({
          playing: snap.playing,
          chunk: snap.chunkIndex,
          offset: Number(snap.chunkOffset.toFixed(3)),
          stems: selected.length,
          ids: selected,
          loaded: snap.loadedChunks,
          scheduled: snap.scheduledChunks,
          buffers: snap.bufferCount,
          pcm: formatBytes(snap.pcmBytes),
          fetchMs: Number(snap.lastFetchMs.toFixed(1)),
          decodeMs: Number(snap.lastDecodeMs.toFixed(1)),
          late: snap.lateSchedules,
        }, null, 2)}
      </pre>
    </main>
  )
}
