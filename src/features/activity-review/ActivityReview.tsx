import { useEffect, useRef, useState } from 'react'
import { analysisDefaults, type AnalysisParameters, type OnsetCandidate, type ReviewReport } from './analysis'
import { ReviewTimeline } from './ReviewTimeline'
import { ReviewPlayer } from './review-player'
import { currentExcerpt } from '../listening/excerpt'
import type { ActivityProfile } from '../listening/activity-profile'
import { localMediaUrl, mediaUrl } from '../../lib/media-url'
import { instrumentCatalog } from '../../store/catalog'

const button = 'min-h-11 rounded border border-white/20 px-3 text-xs enabled:hover:bg-white/10 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-cyan-300 focus-within:outline-2 focus-within:outline-cyan-300'
const input = 'min-h-11 rounded border border-white/20 bg-black px-3 text-xs'
const tracks = [
  { id: 'orchestra', name: 'Full orchestra', file: currentExcerpt.fullOrchestraFile! },
  ...Object.entries(currentExcerpt.stems).map(([id, file]) => ({ id, name: instrumentCatalog.find(group => group.instrument === id)?.name ?? id, file })),
]
const parameterControls: { key: keyof AnalysisParameters; label: string; min: number; max: number; step: number }[] = [
  { key: 'gateDb', label: 'Sounding threshold (dBFS)', min: -100, max: -20, step: 1 },
  { key: 'gateGapMs', label: 'Merge rests shorter than (ms)', min: 0, max: 300, step: 5 },
  { key: 'gateMinMs', label: 'Minimum sounding span (ms)', min: 0, max: 200, step: 5 },
  { key: 'onsetSensitivity', label: 'Onset threshold (higher = fewer)', min: .5, max: 10, step: .25 },
  { key: 'onsetMinGapMs', label: 'Minimum onset gap (ms)', min: 20, max: 500, step: 5 },
  { key: 'onsetFloorDb', label: 'Ignore attacks below (dBFS)', min: -100, max: -20, step: 1 },
]
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`

function download(report: ReviewReport) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report)], { type: 'application/json' }))
  const anchor = document.createElement('a'); anchor.href = url
  anchor.download = `${report.source.track || 'audio'}-analysis-review.json`; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function ActivityReview() {
  const [player] = useState(() => new ReviewPlayer())
  const worker = useRef<Worker | null>(null)
  const request = useRef(0)
  const [track, setTrack] = useState('cello')
  const [kind, setKind] = useState<ReviewReport['source']['kind']>('unknown')
  const [report, setReport] = useState<ReviewReport | null>(null)
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [audioHash, setAudioHash] = useState('')
  const [legacy, setLegacy] = useState<ActivityProfile | null>(null)
  const [legacyError, setLegacyError] = useState('')
  const [status, setStatus] = useState('Choose a local master or load a playback asset to begin.')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [start, setStart] = useState(0)
  const [span, setSpan] = useState(10)
  const [loop, setLoop] = useState(false)
  const [markers, setMarkers] = useState(true)
  const [markersOnly, setMarkersOnly] = useState(false)
  const [selected, setSelected] = useState('')
  const [offsetMs, setOffsetMs] = useState(0)
  const canPlay = !busy && !!buffer && !!report && audioHash === report.source.sha256
  const selectedOnset = report?.onsets.find(onset => onset.id === selected)
  const visibleOnsets = report?.onsets.filter(onset => onset.time >= start && onset.time <= start + span) ?? []

  useEffect(() => {
    const controller = new AbortController()
    fetch(localMediaUrl(currentExcerpt.activityOutput), { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Current profile is unavailable locally; raw analysis still works.')
      setLegacy(await response.json())
    }).catch(reason => { if (!controller.signal.aborted) setLegacyError(String(reason.message)) })
    // Cleanup must cancel the latest worker, including replacements started after this effect mounted.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    return () => { controller.abort(); request.current++; worker.current?.terminate(); player.dispose() }
  }, [player])
  useEffect(() => {
    let frame = 0, previous = 0
    const tick = (now: number) => {
      if (now - previous > 60) {
        previous = now
        setPosition(player.position); setPlaying(player.running)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [player])

  const pause = () => { player.pause(); setPlaying(false); setPosition(player.position) }
  const seek = (at: number) => { player.seek(Math.max(0, Math.min(report?.measurements.duration ?? 0, at))); setPosition(player.position); setPlaying(false) }
  const cancel = () => { request.current++; worker.current?.terminate(); worker.current = null; setBusy(false); setStatus('Analysis cancelled.') }

  const analyze = async (bytes: ArrayBuffer, name: string, sourceKind: ReviewReport['source']['kind'], sourceTrack: string, token: number) => {
    if (token !== request.current) return
    setStatus('Decoding audio…')
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
    const sha256 = [...new Uint8Array(hashBuffer)].map(value => value.toString(16).padStart(2, '0')).join('')
    const context = new AudioContext()
    let decoded: AudioBuffer
    try { decoded = await context.decodeAudioData(bytes.slice(0)) } finally { await context.close() }
    if (token !== request.current) return
    setBuffer(decoded); setAudioHash(sha256)
    if (report?.source.sha256 === sha256) {
      setBusy(false); setStatus('Matching source attached to imported report.'); return
    }
    setReport(null); setSelected(''); setStatus('Measuring RMS and spectral changes…')
    const source: ReviewReport['source'] = { name, sha256, bytes: bytes.byteLength, kind: sourceKind, track: sourceTrack }
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index).slice())
    const job = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })
    worker.current = job
    job.onmessage = event => {
      if (token !== request.current) return
      if ('progress' in event.data) { setStatus(`Analyzing… ${Math.round(event.data.progress * 100)}%`); return }
      if (event.data.error) { setError(event.data.error); setStatus('Analysis failed.'); setBusy(false); job.terminate(); return }
      player.seek(0); setReport(event.data.report); setBusy(false); setStart(0); setPosition(0); setOffsetMs(0)
      setStatus('Analysis ready. Onset candidates need listening review.'); job.terminate(); worker.current = null
    }
    job.onerror = event => { if (token === request.current) { setError(event.message); setStatus('Analysis failed.'); setBusy(false); job.terminate() } }
    job.postMessage({ channels, sampleRate: decoded.sampleRate, parameters: analysisDefaults, source }, channels.map(channel => channel.buffer))
  }
  const begin = () => { pause(); request.current++; worker.current?.terminate(); setBusy(true); setError(''); return request.current }
  const loadFile = async (file: File) => {
    const token = begin()
    try { await analyze(await file.arrayBuffer(), file.name, kind, track, token) }
    catch (reason) { if (token === request.current) { setError(String(reason)); setStatus('Source could not be loaded.'); setBusy(false) } }
  }
  const loadAsset = async () => {
    const token = begin(), item = tracks.find(item => item.id === track)!
    setStatus('Loading encoded playback asset…')
    try {
      const directory = currentExcerpt.opusDirectory!
      let name = item.file.replace(/\.wav$/i, '.m4a')
      const assetPath = `${directory}/${name}`
      let response = await fetch(localMediaUrl(assetPath))
      if (!response.ok || response.headers.get('content-type')?.includes('text/html')) response = await fetch(mediaUrl(assetPath))
      if (!response.ok) { name = item.file.replace(/\.wav$/i, '.opus'); response = await fetch(mediaUrl(`${directory}/${name}`)) }
      if (!response.ok) throw new Error(`Playback asset unavailable (${response.status}). Choose a local WAV or supported audio file.`)
      await analyze(await response.arrayBuffer(), name, 'derived', track, token)
    } catch (reason) { if (token === request.current) { setError(String(reason)); setStatus('Source could not be loaded.'); setBusy(false) } }
  }
  const importReport = async (file: File) => {
    pause()
    try {
      const { parseReviewReport } = await import('./report-validation')
      const parsed = parseReviewReport(JSON.parse(await file.text()))
      setReport(parsed); setStart(0); setPosition(0); player.seek(0); setSelected(''); setOffsetMs(0)
      setStatus(audioHash === parsed.source.sha256 ? 'Report loaded with matching audio.' : 'Report loaded. Attach its matching audio file for playback (SHA-256 checked).')
    } catch (reason) { setError(String(reason)) }
  }
  const changeParameters = (parameters: AnalysisParameters) => {
    if (!report) return
    const token = begin(), sourceHash = report.source.sha256
    setStatus('Re-detecting events…')
    const job = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })
    worker.current = job
    job.onmessage = event => {
      if (token !== request.current) return
      if (event.data.error) setError(event.data.error)
      else {
        setReport(previous => previous?.source.sha256 === sourceHash ? { ...previous, parameters, ...event.data.events } : previous)
        setSelected(''); setOffsetMs(0); setStatus('Detection updated. Candidates need review.')
      }
      setBusy(false); job.terminate(); worker.current = null
    }
    job.onerror = event => { if (token === request.current) { setError(event.message); setStatus('Analysis failed.'); setBusy(false); job.terminate() } }
    job.postMessage({ measurements: report.measurements, parameters })
  }
  const editOnset = (id: string, patch: Partial<OnsetCandidate>) => {
    pause()
    setReport(previous => previous && ({ ...previous, onsets: previous.onsets.map(onset => onset.id === id ? { ...onset, ...patch } : onset).sort((a, b) => a.time - b.time) }))
  }
  const play = async () => {
    if (!canPlay || !report || !buffer) return
    setError('')
    try {
      const events = report.onsets.filter(onset => onset.status !== 'rejected').map(onset => onset.time)
      await player.play(buffer, events, position >= buffer.duration ? 0 : position, loop ? [start, Math.min(buffer.duration, start + span)] : null, markers, markersOnly)
      setPlaying(player.running)
    } catch (reason) { setError(String(reason)) }
  }
  const addMarker = () => {
    if (!report) return
    pause()
    const onset: OnsetCandidate = { id: `manual-${crypto.randomUUID()}`, time: position, strength: 1, status: 'manual' }
    setReport({ ...report, onsets: [...report.onsets, onset].sort((a, b) => a.time - b.time) }); setSelected(onset.id)
  }
  return <main className="min-h-screen bg-[#05090f] p-5 font-ui text-slate-200 md:p-8">
    <div className="mx-auto max-w-6xl">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[10px] uppercase tracking-[.2em] text-slate-400">Orchestra Atlas · Audio laboratory</p>
          <h1 className="mt-2 text-2xl font-light">Activity analysis & review</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">Listen to the source, compare raw dynamics with the current profile, and inspect onset candidates. Review reports are separate from production activity data.</p></div>
        <a className={button + ' inline-flex items-center'} href="/dev/liquid-orb">Orb prototype</a>
      </header>
      <section aria-label="Audio source" className="mb-5 rounded-xl border border-white/15 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="grid gap-2 text-xs">Track / current profile
            <select className={input} value={track} disabled={busy} onChange={event => setTrack(event.target.value)}>{tracks.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          </label>
          <button className={button} disabled={busy} onClick={() => void loadAsset()}>Analyze playback asset</button>
          <label className="grid gap-2 text-xs">Local audio provenance
            <select className={input} value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="unknown">Unverified source</option><option value="master">Original master WAV</option><option value="derived">Derived / encoded audio</option></select>
          </label>
          <label className={button + ' inline-flex cursor-pointer items-center'}>Choose local audio<input aria-label="Choose local audio" className="sr-only" type="file" accept="audio/*,.wav,.m4a,.opus" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void loadFile(file); event.target.value = '' }} /></label>
          <label className={button + ' inline-flex cursor-pointer items-center'}>Import review JSON<input aria-label="Import review JSON" className="sr-only" type="file" accept=".json" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void importReport(file); event.target.value = '' }} /></label>
          {busy && <button className={button} onClick={cancel}>Cancel</button>}
        </div>
        <p role="status" className="mt-3 text-xs text-slate-400">{status}</p>
        {error && <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>}
        {legacyError && <p className="mt-2 text-xs text-slate-400">{legacyError}</p>}
      </section>
      {report && <>
        <p className="mb-4 break-words text-xs leading-relaxed text-slate-400">{report.source.name} · <strong className={report.source.kind === 'master' ? 'text-emerald-300' : 'text-amber-200'}>{report.source.kind === 'master' ? 'Master (declared source)' : report.source.kind === 'derived' ? 'Encoded playback asset' : 'Source provenance unverified'}</strong> · {time(report.measurements.duration)} · {report.measurements.sampleRate.toLocaleString()} Hz decoded · {report.measurements.channels} channels · {(report.measurements.hopSeconds * 1000).toFixed(2)} ms step / {(report.measurements.frameSize / report.measurements.sampleRate * 1000).toFixed(1)} ms centered window</p>
        <section aria-label="Review transport" className="mb-4 grid gap-4 rounded-xl border border-white/15 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <button className={button} disabled={!canPlay} onClick={() => playing ? pause() : void play()}>{playing ? 'Pause' : 'Play source'}</button>
            <output className="text-sm tabular-nums">{time(position)} / {time(report.measurements.duration)}</output>
            <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={markers} onChange={event => { pause(); setMarkers(event.target.checked); if (!event.target.checked) setMarkersOnly(false) }} />Onset clicks</label>
            <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={markersOnly} onChange={event => { pause(); setMarkersOnly(event.target.checked); if (event.target.checked) setMarkers(true) }} />Clicks only</label>
            <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={loop} onChange={event => { pause(); setLoop(event.target.checked) }} />Loop visible region</label>
            <button className={button} onClick={() => { pause(); setStart(Math.max(0, Math.min(report.measurements.duration - Math.min(span, report.measurements.duration), position - span / 2))) }}>Center on playhead</button>
          </div>
          <label className="grid gap-2 text-xs">Seek source<input aria-label="Seek source" type="range" min="0" max={report.measurements.duration} step=".001" value={position} onChange={event => seek(Number(event.target.value))} /></label>
          {!canPlay && <p className="text-xs text-amber-200">Load the audio file matching this report to enable playback.</p>}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs">Visible seconds<select className={input} value={span} onChange={event => { pause(); setSpan(Number(event.target.value)); setStart(0) }}>{[2, 5, 10, 30, 60].map(value => <option key={value}>{value}</option>)}</select></label>
            <label className="grid min-w-40 flex-1 gap-2 text-xs">Timeline start · {time(start)}<input aria-label="Timeline start" type="range" min="0" max={Math.max(0, report.measurements.duration - Math.min(span, report.measurements.duration))} step=".1" value={start} onChange={event => { pause(); setStart(Number(event.target.value)) }} /></label>
          </div>
        </section>
        <ReviewTimeline report={report} legacy={legacy} start={start} span={Math.min(span, report.measurements.duration)} position={position} onSeek={seek} />
        <details className="my-5 rounded-xl border border-white/15 p-4">
          <summary className="min-h-11 cursor-pointer text-sm">Detection settings · changing these replaces onset edits</summary>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{parameterControls.map(({ key, label, ...range }) => <label key={key} className="grid gap-2 text-xs">{label} · {report.parameters[key]}<input aria-label={label} type="range" {...range} value={report.parameters[key]} onChange={event => changeParameters({ ...report.parameters, [key]: Number(event.target.value) })} /></label>)}</div>
          <p className="mt-3 text-xs text-slate-400">RMS and peak measurements remain raw. The sounding detector uses 3 dB hysteresis. Onsets use positive log-spectral flux with adjacent-bin suppression and adaptive median/MAD peak picking; these are candidates, not verified note events.</p>
        </details>
        <section aria-label="Onset review" className="my-5 rounded-xl border border-white/15 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm">Onset candidates · {report.onsets.length} total / {report.onsets.filter(onset => onset.status === 'unreviewed').length} unreviewed</h2><button className={button} onClick={addMarker}>Add onset at playhead</button></div>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="grid gap-2 text-xs">Candidate in visible region<select aria-label="Candidate in visible region" className={input} value={selected} onChange={event => { setSelected(event.target.value); const onset = report.onsets.find(onset => onset.id === event.target.value); if (onset) seek(onset.time) }}><option value="">Choose a candidate</option>{visibleOnsets.map(onset => <option key={onset.id} value={onset.id}>{time(onset.time)} · {onset.status}</option>)}</select></label>
            {selectedOnset && <>
              <label className="grid gap-2 text-xs">Onset time (seconds)<input aria-label="Onset time (seconds)" type="number" className={input + ' w-32'} min="0" max={report.measurements.duration} step=".005" value={selectedOnset.time} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= 0 && value <= report.measurements.duration) editOnset(selectedOnset.id, { time: value }) }} /></label>
              <button className={button} onClick={() => editOnset(selectedOnset.id, { status: 'accepted' })}>Accept</button><button className={button} onClick={() => editOnset(selectedOnset.id, { status: 'rejected' })}>Reject</button>
              <button className={button} onClick={() => { seek(Math.max(0, selectedOnset.time - .5)); setStart(Math.max(0, selectedOnset.time - span / 2)) }}>Listen from before onset</button>
            </>}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3"><label className="grid gap-2 text-xs">Shift all candidates (ms)<input aria-label="Shift all candidates (ms)" className={input + ' w-32'} type="number" min="-500" max="500" step="5" value={offsetMs} onChange={event => setOffsetMs(Number(event.target.value))} /></label><button className={button} onClick={() => { if (!Number.isFinite(offsetMs) || Math.abs(offsetMs) > 500) return; pause(); setReport({ ...report, onsets: report.onsets.map(onset => ({ ...onset, time: Math.max(0, Math.min(report.measurements.duration, onset.time + offsetMs / 1000)) })) }); setOffsetMs(0) }}>Apply timing correction</button></div>
          <p className="mt-3 text-xs text-slate-400">Clicks include all non-rejected candidates. Check quiet entries, repeated notes, sustained tones and accents. Add misses and reject false positives; do not correct timing by ear across unrelated recordings.</p>
        </section>
        <label className="grid gap-2 text-sm">Review notes<textarea className="min-h-24 rounded-lg border border-white/20 bg-black p-3 text-sm" value={report.notes} onChange={event => setReport({ ...report, notes: event.target.value })} placeholder="Passages checked, missed entries, false positives, source alignment observations…" /></label>
        <div className="my-5 flex flex-wrap items-center gap-4"><button className={button} onClick={() => download(report)}>Export analysis + review JSON</button><p className="text-xs text-slate-400">Includes source SHA-256, parameters, raw measurements and edits. Does not replace production activity.json.</p></div>
      </>}
    </div>
  </main>
}
