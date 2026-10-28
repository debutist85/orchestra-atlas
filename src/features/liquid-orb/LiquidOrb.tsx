import { useEffect, useState } from 'react'
import { liquidOrbConfig, type FilledNodeSettings, type BrightnessResponseSettings, type OrbRimSettings, type OrbSize } from './config'
import { orbStates, type OrbState } from './orb-states'
import { orbSizePresets } from './size-presets'
import { referenceSettings } from './shader'
import { OrbPreview, type ActivityTrack, type IntensitySource } from './OrbPreview'
import { listeningEngine } from '../listening/listening-engine'
import { PlaybackControls } from '../listening/PlaybackControls'
import { currentExcerpt } from '../listening/excerpt'
import { fetchActivityProfile, type ActivityProfile } from '../listening/activity-profile'
import { localMediaUrl } from '../../lib/media-url'
import { useListeningLoadStore } from '../../store/listening-load-store'
import { usePlaybackStore } from '../../store/playback-store'
import { instrumentCatalog } from '../../store/catalog'
import { orchestraSceneConfig } from '../orchestra-map/config'

const instrumentColors = instrumentCatalog.flatMap(group => [
  { id: group.instrument, label: group.name, color: group.color ?? orchestraSceneConfig.sections[group.sectionId].color },
  ...(group.colorBands ?? []).map(band => ({
    id: `${group.instrument}:${band.id}`,
    label: `${group.name} ${band.id.replace(group.instrument, '').trim()}`,
    color: band.color,
  })),
])

const filledControls: { key: keyof FilledNodeSettings; label: string; min: number; max: number; step: number }[] = [
  { key: 'brightness', label: 'Fill brightness', min: 0, max: 3, step: .01 },
  { key: 'activeBrightness', label: 'Active brightness boost', min: 0, max: 8, step: .1 },
  { key: 'musicBrightness', label: 'Music brightness response', min: 0, max: 8, step: .1 },
  { key: 'musicBloomBoost', label: 'Music bloom response', min: 0, max: 1, step: .01 },
  { key: 'bloomStrength', label: 'Bloom strength', min: 0, max: 3, step: .01 },
  { key: 'highlightBloomBoost', label: 'Highlight bloom boost', min: 0, max: 1, step: .01 },
  { key: 'bloomRadius', label: 'Bloom radius', min: 0, max: 1, step: .01 },
  { key: 'bloomThreshold', label: 'Bloom threshold', min: 0, max: 3, step: .01 },

]

const rimControls: { key: keyof OrbRimSettings; label: string; min: number; max: number; step: number }[] = [
  { key: 'minThickness', label: 'Quiet rim thickness', min: .001, max: .03, step: .001 },
  { key: 'maxThickness', label: 'Loud rim thickness', min: .01, max: .12, step: .002 },
  { key: 'brightness', label: 'Rim shine', min: 0, max: 4, step: .05 },
  { key: 'glow', label: 'Rim glow', min: 0, max: .5, step: .01 },
]

const responseControls: { key: keyof BrightnessResponseSettings; label: string; min: number; max: number; step: number }[] = [
  { key: 'leadMs', label: 'Visual lead (ms)', min: 0, max: 200, step: 5 },
  { key: 'contrast', label: 'Dynamics curve (<1 lifts quiet)', min: .25, max: 4, step: .1 },
  { key: 'pulseStrength', label: 'Attack pulse strength', min: 0, max: 2, step: .05 },
  { key: 'riseMs', label: 'Brightness rise (ms)', min: 5, max: 200, step: 5 },
  { key: 'fallMs', label: 'Brightness release (ms)', min: 20, max: 500, step: 10 },
  { key: 'pulseFallMs', label: 'Pulse decay (ms)', min: 30, max: 400, step: 10 },
]

export default function LiquidOrb() {
  const [colorPreset, setColorPreset] = useState('custom')
  const [rim, setRim] = useState({ ...liquidOrbConfig.prototype.rim })
  const [response, setResponse] = useState({ ...liquidOrbConfig.prototype.brightnessResponse })
  const [filled, setFilled] = useState({ ...liquidOrbConfig.prototype.filled })
  const [settings, setSettings] = useState({ ...referenceSettings })
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [source, setSource] = useState<IntensitySource>('music')
  const [track, setTrack] = useState<ActivityTrack>('orchestra')
  const loadStatus = useListeningLoadStore(state => state.status)
  const [profile, setProfile] = useState<ActivityProfile | null>(null)
  const [profileError, setProfileError] = useState('')
  const [intensity, setIntensity] = useState(.5)
  const [state, setState] = useState<OrbState>('idle')
  const [size, setSize] = useState<OrbSize>('medium')
  const [zoom, setZoom] = useState(liquidOrbConfig.prototype.zoom.default)
  const [reset, setReset] = useState(0)
  useEffect(() => {
    listeningEngine.setPreviewSelection(track === 'orchestra'
      ? { selectedInstrumentIds: [], effectiveListeningMode: 'normal' }
      : { selectedInstrumentIds: [track], effectiveListeningMode: 'highlight', isolated: true })
  }, [track])
  useEffect(() => () => listeningEngine.setPreviewSelection(null), [])
  useEffect(() => {
    const controller = new AbortController()
    const url = localMediaUrl(currentExcerpt.activityOutput.replace(/\.json$/, '.revised.json'))
    fetchActivityProfile(url, controller.signal).then(value => {
      if (value.excerptId !== currentExcerpt.id) throw new Error('Revised profile belongs to a different recording')
      setProfile(value)
    }).catch(error => { if (!controller.signal.aborted) setProfileError(String(error.message)) })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const reduce = () => { if (media.matches) setPaused(true) }
    media.addEventListener('change', reduce)
    return () => media.removeEventListener('change', reduce)
  }, [])
  const button = 'min-h-11 rounded border border-white/20 px-3 text-xs hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-300'
  return <main className="fixed inset-0 overflow-auto bg-black font-ui text-slate-200">
    <div className="mx-auto flex min-h-full max-w-[1600px] flex-col p-5 md:p-8">
      <header className="flex items-start justify-between gap-4">
        <div><p className="text-[10px] uppercase tracking-[.2em] text-slate-400">Orchestra Atlas · Material study 01</p>
          <h1 className="mt-2 text-xl font-light">Liquid light · Filled nodes</h1>
          <p className="mt-3 max-w-xl text-xs leading-relaxed text-slate-400">One material across focus, activity, and rest. Apply a state to the orb, then adjust its material below.</p></div>
        <a href="/" className={button + ' flex shrink-0 items-center'}>Back to orchestra</a>
      </header>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
      <label className="flex min-h-11 flex-wrap items-center gap-3 text-xs">Orb state
        <select value={state} onChange={event => setState(event.target.value as OrbState)} className="min-h-11 rounded border border-white/20 bg-black px-3">
          {orbStates.map(state => <option key={state.id} value={state.id}>{state.label}</option>)}
        </select>
      </label>
      <label className="flex min-h-11 flex-wrap items-center gap-3 text-xs">Orb size
        <select value={size} onChange={event => setSize(event.target.value as OrbSize)} className="min-h-11 rounded border border-white/20 bg-black px-3">
          {orbSizePresets.map(size => <option key={size.id} value={size.id}>{size.label}</option>)}
        </select>
      </label>
      <label className="flex min-h-11 flex-wrap items-center gap-3 text-xs">Instrument color
        <select value={colorPreset} onChange={event => {
          const id = event.target.value
          setColorPreset(id)
          const preset = instrumentColors.find(preset => preset.id === id)
          if (preset) setSettings(previous => ({ ...previous, color: preset.color }))
        }} className="min-h-11 max-w-full rounded border border-white/20 bg-black px-3">
          <option value="custom">Custom color</option>
          {instrumentColors.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
        </select>
        <span aria-hidden="true" className="size-5 rounded-full border border-white/30" style={{ backgroundColor: settings.color }} />
      </label>
      <label className="grid min-h-11 w-full max-w-60 grid-cols-[1fr_auto] items-center gap-x-3 text-xs">
        <span>Zoom</span><output className="tabular-nums text-slate-400">{zoom.toFixed(2)}×</output>
        <input aria-label="Zoom" type="range" min={liquidOrbConfig.prototype.zoom.min} max={liquidOrbConfig.prototype.zoom.max} step={liquidOrbConfig.prototype.zoom.step} value={zoom} onChange={event => setZoom(Number(event.target.value))} className="col-span-2 w-full accent-cyan-300" />
      </label>
      </div>
      <section aria-label="Orb preview" className="py-6 md:py-10">
        <OrbPreview rim={rim} profile={profile} response={response} filled={filled} settings={settings} paused={paused} source={source} track={track} intensity={intensity} state={state} size={size} zoom={zoom} reset={reset} />
      </section>
      <section aria-label="Interaction controls" className="mb-6 grid gap-6 rounded-xl border border-white/10 p-4 md:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="mb-3 text-sm">Preview interactions</h2>
          <div className="flex flex-wrap gap-2">
            <button className={button} onClick={() => setPaused(!paused)}>{paused ? 'Resume animation' : 'Pause animation'}</button>
            <button className={button} onClick={() => {
              setRim({ ...liquidOrbConfig.prototype.rim }); setResponse({ ...liquidOrbConfig.prototype.brightnessResponse }); setColorPreset('custom'); setFilled({ ...liquidOrbConfig.prototype.filled }); setSettings({ ...referenceSettings }); setSource('music'); setTrack('orchestra'); setIntensity(.5)
              setState('reference'); setSize('medium'); setZoom(liquidOrbConfig.prototype.zoom.default); setReset(value => value + 1)
            }}>Reset to Reference</button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">Choose Highlighted to apply the boosted glow, or Playing to follow music intensity. Switching states preserves the animation phase and material settings.</p>
        </div>
        <div>
          <h2 className="mb-3 text-sm">Music intensity</h2>
          <a href="/dev/activity-review" className="mb-3 inline-block text-xs text-cyan-200 underline">Review audio analysis</a>
          <label className="mb-3 flex min-h-11 flex-wrap items-center justify-between gap-3 text-xs">Intensity source
            <select value={source} onChange={event => {
              const next = event.target.value as IntensitySource
              if (next !== 'music') usePlaybackStore.getState().pause()
              setSource(next)
            }} className="min-h-11 rounded border border-white/20 bg-black px-3">
              <option value="music">Music activity profile</option>
              <option value="automatic">Automatic demo envelope</option>
              <option value="manual">Manual intensity</option>
            </select>
          </label>
          {source === 'music' ? <>
            <p className="mb-3 text-xs text-slate-300">{currentExcerpt.title}</p>
            <label className="mb-3 flex min-h-11 flex-wrap items-center justify-between gap-3 text-xs">Activity to visualize
              <select value={track} onChange={event => setTrack(event.target.value as ActivityTrack)} className="min-h-11 rounded border border-white/20 bg-black px-3">
                <option value="orchestra">Full orchestra</option>
                {instrumentCatalog.filter(group => profile?.instruments[group.instrument]).map(group => <option key={group.instrument} value={group.instrument}>{group.name}</option>)}
              </select>
            </label>
            {loadStatus === 'loading' && <p role="status" className="mb-3 text-xs text-slate-400">Loading recording and activity profile…</p>}
            {!profile && !profileError && <p role="status" className="mb-3 text-xs text-slate-400">Loading revised activity profile…</p>}
            {profileError && <p role="alert" className="mb-3 text-xs text-amber-200">Revised profile unavailable: {profileError}. Run npm run audio:profile-all to generate it.</p>}
            {profile && <p className="mb-3 text-xs text-cyan-200">Revised offline profile · {Math.round(profile.sampleInterval * 1000)} ms dynamics · spectral onset candidates</p>}
            {profile && track === 'orchestra' && !profile.orchestra?.length && <p role="alert" className="mb-3 text-xs text-amber-200">The full-orchestra envelope is missing. Choose an instrument profile.</p>}
            <PlaybackControls />
            <p className="mt-3 text-xs leading-relaxed text-slate-400">The selected instrument stem plays solo while its profile drives the orb. Full orchestra restores the complete mix. Switching instruments keeps the playback position. Animation pause freezes the visual frame independently of playback.</p>
          </> : <>
            {source === 'manual' && <label className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-x-3 text-xs">
              <span>Manual intensity</span><output>{Math.round(intensity * 100)}%</output>
              <input aria-label="Manual intensity" type="range" min="0" max="1" step="0.01" value={intensity} onChange={event => setIntensity(Number(event.target.value))} className="col-span-2 w-full accent-cyan-300" />
            </label>}
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{source === 'automatic' ? 'An illustrative envelope, without audio.' : 'Hold an intensity for inspection.'} Intensity thickens the white rim, with a restrained fill-brightness response. Use Music bloom response to optionally add glow.</p>
          </>}
        </div>
      </section>
      <section aria-label="Activity rim controls" className="mb-6 rounded-xl border border-white/10 p-4">
        <h2 className="text-sm">White activity rim</h2>
        <p className="mt-2 text-xs text-slate-400">In Playing, a white corona shines from behind the disc and grows outward with intensity. The disc stays in front of the glow.</p>
        <div className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {rimControls.map(({ key, label, ...range }) => <label key={key} className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-x-2 text-xs text-slate-300">
            <span>{label}</span><output className="text-slate-400 tabular-nums">{rim[key]}</output>
            <input aria-label={label} type="range" {...range} value={rim[key]} className="col-span-2 w-full accent-cyan-300" onChange={event => setRim(previous => ({ ...previous, [key]: Number(event.target.value) }))} />
          </label>)}
        </div>
      </section>
      <section aria-label="Music response controls" className="mb-6 rounded-xl border border-white/10 p-4">
        <h2 className="text-sm">Musical response · Dynamics and accents</h2>
        <p className="mt-2 text-xs text-slate-400">Visual lead brings the light ahead of the recording. The dynamics curve lifts quiet playing; attacks add controlled accents within the same visual range.</p>
        <div className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {responseControls.map(({ key, label, ...range }) => <label key={key} className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-x-2 text-xs text-slate-300">
            <span>{label}</span><output className="text-slate-400 tabular-nums">{response[key]}</output>
            <input aria-label={label} type="range" {...range} value={response[key]} className="col-span-2 w-full accent-cyan-300" onChange={event => setResponse(previous => ({ ...previous, [key]: Number(event.target.value) }))} />
          </label>)}
        </div>
      </section>
      <section aria-label="Filled node controls" className="mb-6 rounded-xl border border-white/10 bg-white/[.025] p-4">
        <h2 className="text-sm">Filled node · Brightness and bloom</h2>
        <p className="mt-2 text-xs text-slate-400">Tune the base fill, then choose Highlighted, Selected (2× brightness), or Playing to inspect its active light. Music intensity drives the white rim in Playing; optional bloom response starts at zero.</p>
        <div className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filledControls.map(({ key, label, ...range }) => <label key={key} className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-x-2 text-xs text-slate-300">
            <span>{label}</span><output className="text-slate-400 tabular-nums">{filled[key]}</output>
            <input aria-label={label} type="range" {...range} value={filled[key]} className="col-span-2 w-full accent-cyan-300" onChange={event => setFilled(previous => ({ ...previous, [key]: Number(event.target.value) }))} />
          </label>)}
          <label className="flex min-h-11 items-center justify-between text-xs">Orb color<input aria-label="Orb color" type="color" value={settings.color} onChange={event => { setColorPreset('custom'); setSettings(previous => ({ ...previous, color: event.target.value })) }} className="h-9 w-12" /></label>
        </div>
      </section>
    </div>
  </main>
}
