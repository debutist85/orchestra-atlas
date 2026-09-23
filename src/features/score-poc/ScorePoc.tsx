import { useEffect, useRef, useState } from 'react'
import { OrchestraMap } from '../orchestra-map'
import { useNavigationStore } from '../../store/navigation-store'
import { usePlaybackStore } from '../../store/playback-store'
import { ScoreAdapter, type ScoreDiagnostics } from './score-adapter'
import { navigationScope, scopeName } from './selection'
import './score-poc.css'

type LongTask = { at: number; ms: number; phase: string }
export default function ScorePoc() {
  const host = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const adapter = useRef<ScoreAdapter | null>(null)
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<ScoreDiagnostics | null>(null)
  const [runtime, setRuntime] = useState({ fps: 0, heap: 0, longTasks: [] as LongTask[], longTaskCount: 0, longest: 0 })
  const navigation = useNavigationStore(state => state.navigation)
  const duration = usePlaybackStore(state => state.duration)
  const status = usePlaybackStore(state => state.status)
  const scope = navigationScope(navigation)

  useEffect(() => {
    const score = new ScoreAdapter(host.current!, scroller.current!,
      seconds => usePlaybackStore.getState().seek(seconds), usePlaybackStore.getState)
    adapter.current = score
    const state = usePlaybackStore.getState()
    score.setPosition(state.position, state.epoch)
    score.setScope(navigationScope(useNavigationStore.getState().navigation))
    void score.initialize()
    const unsubscribe = usePlaybackStore.subscribe(state => score.setPosition(state.position, state.epoch))
    return () => { unsubscribe(); score.dispose(); adapter.current = null }
  }, [])
  useEffect(() => { adapter.current?.setScope(scope) }, [scope])
  useEffect(() => { adapter.current?.setOffset(offset) }, [offset])
  useEffect(() => {
    let frames = 0, last = performance.now(), frame = 0, count = 0, longest = 0
    const longTasks: LongTask[] = []
    const observer = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask')
      ? new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          count++; longest = Math.max(longest, entry.duration)
          longTasks.push({ at: entry.startTime, ms: entry.duration, phase: adapter.current?.phaseAt(entry.startTime) ?? 'initial' })
          if (longTasks.length > 30) longTasks.shift()
        }
      }) : null
    observer?.observe({ entryTypes: ['longtask'] })
    const tick = (now: number) => {
      frames++
      if (now - last >= 1000) {
        const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
        setRuntime({ fps: frames * 1000 / (now - last), heap: (memory?.usedJSHeapSize ?? 0) / 1048576,
          longTasks: [...longTasks], longTaskCount: count, longest })
        const snapshot = adapter.current?.snapshot()
        if (snapshot) setData(snapshot)
        frames = 0; last = now
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); observer?.disconnect() }
  }, [])
  const ms = (value?: number) => value === undefined || value === 0 ? 'pending' : `${value.toFixed(2)} ms`
  const formatWindow = (window: ScoreDiagnostics['window']) => window ? `${window.startMeasure}–${window.endMeasure}` : 'pending'
  const actions = useNavigationStore.getState()
  return <div className="score-poc">
    <div className="score-poc__map"><OrchestraMap /></div>
    <section className="score-poc__panel" aria-label="Score evaluation">
      <h1>alphaTab worker/window POC</h1>
      <p>SVG · worker model/layout · Atlas transport · continuous playhead</p>
      <div className="score-poc__controls">
        <button aria-pressed={navigation.level === 'orchestra'} onClick={actions.resetToOrchestra}>Orchestra</button>
        <button aria-pressed={navigation.level === 'family' && navigation.familyId === 'strings'} onClick={() => actions.enterFamily('strings')}>Strings</button>
        <button aria-pressed={navigation.level === 'instrument' && navigation.instrumentId === 'cello'} onClick={() => actions.enterInstrument('cello')}>Cello</button>
        <label>Audio offset (seconds) <input type="number" step="0.1" value={offset} onChange={e => setOffset(Number(e.target.value) || 0)} /></label>
        <label>Atlas seek <input aria-label="Score POC transport seek" type="range" min="0" max={duration} step="0.1" value={data?.logicalSeconds ?? 0}
          onChange={e => {
            usePlaybackStore.getState().seek(Number(e.target.value))
            setData(current => current ? { ...current, logicalSeconds: usePlaybackStore.getState().position } : current)
          }} /></label>
      </div>
      <p role="status">{data?.status ?? 'Starting score worker'} · navigation: {scopeName(scope)} · {data?.tracks.length ?? 0}/{data?.totalTracks ?? 19} displayed tracks</p>
      <p>Window {formatWindow(data?.window)} · requested {formatWindow(data?.requestedWindow)} · {data?.staves ?? 0} staves · {data?.anchors ?? 0} anchors</p>
      <p>Atlas {data?.logicalSeconds.toFixed(2) ?? '0.00'} / {duration.toFixed(2)} s ({status}) · score end {data?.scoreDuration.toFixed(2) ?? '—'} s</p>
      <details>
        <summary>Measurements and rendered parts</summary>
        <dl><dt>alphaTab import (worker)</dt><dd>{ms(data?.moduleMs)}</dd>
          <dt>XML fetch (worker)</dt><dd>{ms(data?.fetchMs)} · {data?.bytes} bytes</dd>
          <dt>Parse/model (worker)</dt><dd>{ms(data?.parseMs)}</dd><dt>Timing/renderer setup (worker)</dt><dd>{ms(data?.timingMs)}</dd>
          <dt>First window presented</dt><dd>{ms(data?.firstWindowMs)}</dd>
          <dt>Thread / model</dt><dd>{data?.thread} · {data?.bars} source measures</dd>
          <dt>Request / committed / discarded</dt><dd>{data?.generation} / {data?.committedGeneration} / {data?.staleResults}</dd>
          <dt>Window requests sent</dt><dd>{data?.workerMessages}</dd>
          <dt>Rendering</dt><dd>{data?.svgCount} SVGs · {data?.domCount} descendants</dd>
          <dt>Playhead frame CPU (mean / max)</dt><dd>{ms(data?.playheadFrameMs)} / {ms(data?.playheadMaxMs)} · {data?.playheadFrames} frames</dd>
          <dt>Playhead x / system</dt><dd>{data?.playheadX?.toFixed(2) ?? 'outside window'} / {data?.playheadSystem ?? '—'}</dd>
          <dt>Frame sampling</dt><dd>{runtime.fps.toFixed(1)} FPS · {runtime.longTaskCount} long tasks · longest {runtime.longest.toFixed(1)} ms</dd>
          <dt>Main-realm JS heap (not worker memory)</dt><dd>{runtime.heap ? `${runtime.heap.toFixed(1)} MiB` : 'unavailable'}</dd></dl>
        <ul>{data?.tracks.map(track => <li key={track}>{track}</li>)}</ul>
        <div className="score-poc__table"><table><caption>Last 30 committed windows (milliseconds)</caption>
          <thead><tr><th>Generation / scope / reason</th><th>Bars / staves</th><th>Worker render / anchors / total</th><th>Round trip</th><th>DOM commit</th><th>To visible frame</th></tr></thead>
          <tbody>{data?.transitions.map(entry => <tr key={entry.generation}>
            <td>{entry.generation} / {entry.scope} / {entry.reason}</td><td>{entry.window.startMeasure}–{entry.window.endMeasure} ({entry.measures}) / {entry.staves}</td>
            <td>{entry.renderMs.toFixed(2)} / {entry.anchorsMs.toFixed(2)} / {entry.workerMs.toFixed(2)}</td>
            <td>{entry.roundTripMs.toFixed(2)}</td><td>{entry.commitMs.toFixed(2)}</td><td>{entry.visibleMs.toFixed(2)}</td>
          </tr>)}</tbody></table></div>
        <p>Window failures (previous score retained):</p>
        <ul>{data?.failures.map(entry => <li key={entry.generation}>{entry.generation} / {formatWindow(entry.window)}<pre>{entry.message}</pre></li>)}</ul>
        <p>Long tasks by overlapping request phase (correlation, not attribution):</p>
        <ul>{runtime.longTasks.map((task, index) => <li key={index}>{task.at.toFixed(0)} ms: {task.phase}, {task.ms.toFixed(1)} ms</li>)}</ul>
      </details>
      <p className="score-poc__note">Score scopes mirror map navigation. Click a measure to seek Atlas; the keyboard-accessible slider also seeks. Previous notation stays visible during preparation. Positive offset places audio later than notation. Diagnostics refresh once per second.</p>
      <div className="score-poc__scroll" ref={scroller} tabIndex={0} aria-label="Score">
        <div className="score-poc__notation" ref={host} />
      </div>
    </section>
  </div>
}
