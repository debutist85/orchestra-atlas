import { useEffect, useRef, useState } from 'react'
import { OrchestraMap } from '../orchestra-map'
import { useNavigationStore } from '../../store/navigation-store'
import { usePlaybackStore } from '../../store/playback-store'
import { ScoreAdapter, type ScoreDiagnostics } from './score-adapter'
import { navigationScope, scopeName, type ScoreScope } from './selection'
import './score-poc.css'

const scopes: Record<string, ScoreScope> = {
  Orchestra: { level: 'orchestra' }, Strings: { level: 'family', familyId: 'strings' },
  Cello: { level: 'instrument', instrumentId: 'cello' },
}
export default function ScorePoc() {
  const host = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const adapter = useRef<ScoreAdapter | null>(null)
  const [manualScope, setManualScope] = useState('Orchestra')
  const [mirror, setMirror] = useState(false)
  const [offset, setOffset] = useState(0)
  const [follow, setFollow] = useState(true)
  const [data, setData] = useState<ScoreDiagnostics | null>(null)
  const [error, setError] = useState('')
  const [runtime, setRuntime] = useState({ fps: 0, longTasks: 0, longest: 0, heap: 0 })
  const navigation = useNavigationStore(state => state.navigation)
  const position = usePlaybackStore(state => state.position)
  const duration = usePlaybackStore(state => state.duration)
  const status = usePlaybackStore(state => state.status)
  const scope = mirror ? navigationScope(navigation) : scopes[manualScope]

  useEffect(() => {
    const abort = new AbortController()
    const score = new ScoreAdapter(host.current!, scroller.current!, setData,
      seconds => usePlaybackStore.getState().seek(seconds))
    adapter.current = score
    void score.initialize(abort.signal).then(() => score.setPosition(usePlaybackStore.getState().position)).catch(reason => {
      if (!abort.signal.aborted) setError(String(reason))
    })
    const unsubscribe = usePlaybackStore.subscribe(state => score.setPosition(state.position))
    return () => { abort.abort(); unsubscribe(); score.dispose(); adapter.current = null }
  }, [])
  useEffect(() => { adapter.current?.setScope(scope) }, [scope])
  useEffect(() => { adapter.current?.setOffset(offset) }, [offset])
  useEffect(() => { adapter.current?.setFollow(follow) }, [follow])
  useEffect(() => {
    let frames = 0, last = performance.now(), frame = 0, longTasks = 0, longest = 0
    const observer = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask')
      ? new PerformanceObserver(list => {
        for (const entry of list.getEntries()) { longTasks++; longest = Math.max(longest, entry.duration) }
      }) : null
    observer?.observe({ entryTypes: ['longtask'] })
    const tick = (now: number) => {
      frames++
      if (now - last >= 1000) {
        const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
        setRuntime({ fps: frames * 1000 / (now - last), longTasks, longest, heap: (memory?.usedJSHeapSize ?? 0) / 1048576 })
        const snapshot = adapter.current?.snapshot()
        if (snapshot) setData(snapshot)
        frames = 0; last = now
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); observer?.disconnect() }
  }, [])
  const ms = (value?: number) => value ? `${value.toFixed(1)} ms` : 'pending'
  return <div className="score-poc">
    <div className="score-poc__map"><OrchestraMap /></div>
    <section className="score-poc__panel" aria-label="Score evaluation">
      <h1>alphaTab score POC</h1>
      <p>Beethoven 7 II · SVG · external Atlas transport · evaluation only</p>
      <div className="score-poc__controls">
        {Object.keys(scopes).map(name => <button key={name} disabled={mirror} aria-pressed={!mirror && manualScope === name}
          onClick={() => setManualScope(name)}>{name}</button>)}
        <label><input type="checkbox" checked={mirror} onChange={e => setMirror(e.target.checked)} /> Mirror map navigation</label>
        <label><input type="checkbox" checked={follow} onChange={e => setFollow(e.target.checked)} /> Follow cursor</label>
        <label>Audio offset (seconds) <input type="number" step="0.1" value={offset} onChange={e => setOffset(Number(e.target.value) || 0)} /></label>
        <label>Atlas seek <input aria-label="Score POC transport seek" type="range" min="0" max={duration} step="0.1" value={position}
          onChange={e => usePlaybackStore.getState().seek(Number(e.target.value))} /></label>
      </div>
      <p role="status">{error || data?.status || 'Loading score adapter'} · scope: {scopeName(scope)} · {data?.tracks.length ?? 0}/{data?.totalTracks ?? 0} tracks</p>
      <p>Atlas {position.toFixed(2)} / {duration.toFixed(2)} s ({status}) · score {data?.scoreSeconds.toFixed(2) ?? '—'} / {data?.scoreDuration.toFixed(2) ?? '—'} s</p>
      <p>Projection delta: {data ? (Math.min(data.scoreDuration, Math.max(0, data.logicalSeconds - offset)) - data.scoreSeconds).toFixed(3) : '—'} s (sampled together once per second; not measured musical alignment).</p>
      <details>
        <summary>Measurements and rendered parts</summary>
        <dl><dt>alphaTab import</dt><dd>{ms(data?.moduleMs)}</dd><dt>XML fetch</dt><dd>{ms(data?.fetchMs)} · {data?.bytes} bytes</dd>
          <dt>First rendered fragment</dt><dd>{ms(data?.firstRenderMs)}</dd><dt>Initial layout complete</dt><dd>{ms(data?.fullRenderMs)}</dd>
          <dt>Rendering</dt><dd>{data?.bars} measures · {data?.svgCount} SVGs · {data?.domCount} DOM nodes (lazy pages)</dd>
          <dt>Frame sampling</dt><dd>{runtime.fps.toFixed(1)} FPS · {runtime.longTasks} long tasks · longest {runtime.longest.toFixed(1)} ms</dd>
          <dt>JS heap (if exposed)</dt><dd>{runtime.heap ? `${runtime.heap.toFixed(1)} MiB` : 'unavailable'}</dd></dl>
        <ul>{data?.tracks.map(track => <li key={track}>{track}</li>)}</ul>
        <ol>{data?.transitions.map((entry, index) => <li key={index}>{entry.from} → {entry.to}: {ms(entry.ms)}</li>)}</ol>
      </details>
      <p className="score-poc__note">Click a note/rest to seek to its measure’s first occurrence. Positive offset means audio starts later than notation. No automatic timing stretch. Full engraving accuracy and recording alignment require musical review.</p>
      <div className="score-poc__scroll" ref={scroller} tabIndex={0} aria-label="Scrollable score">
        <div className="score-poc__notation" ref={host} />
      </div>
    </section>
  </div>
}
