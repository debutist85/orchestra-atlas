import { useEffect, useState } from 'react'
import { liquidOrbConfig, type FilledNodeSettings, type OrbSize } from './config'
import { orbStates, type OrbState } from './orb-states'
import { orbSizePresets } from './size-presets'
import { referenceSettings, type OrbSettings } from './shader'
import { OrbPreview, type ActivityTrack, type IntensitySource } from './OrbPreview'
import { PlaybackControls } from '../listening/PlaybackControls'
import { currentExcerpt } from '../listening/excerpt'
import { listeningEngine } from '../listening/listening-engine'
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

const controls: { key: Exclude<keyof OrbSettings, 'color'>; label: string; min: number; max: number; step: number }[] = [
  { key: 'speed', label: 'Animation speed', min: 0, max: 2, step: .05 },
  { key: 'complexity', label: 'Flow complexity', min: .4, max: 2, step: .05 },
  { key: 'distortion', label: 'Flow distortion', min: 0, max: 2, step: .05 },
  { key: 'strands', label: 'Strand density', min: 1, max: liquidOrbConfig.rendering.maxStrands, step: 1 },
  { key: 'thickness', label: 'Strand thickness', min: .3, max: 3, step: .05 },
  { key: 'brightness', label: 'Strand brightness', min: 0, max: 3, step: .05 },
  { key: 'folds', label: 'Internal folds', min: 0, max: 1, step: .01 },
  { key: 'ambient', label: 'Interior brightness', min: 0, max: 2, step: .01 },
  { key: 'highlights', label: 'Highlight concentration', min: .5, max: 5, step: .1 },
  { key: 'glow', label: 'Glow intensity', min: 0, max: 2, step: .05 },
  { key: 'glowRadius', label: 'Glow radius', min: .25, max: 2, step: .05 },
  { key: 'opacity', label: 'Orb opacity', min: 0, max: 1, step: .01 },
]

const filledControls: { key: keyof FilledNodeSettings; label: string; min: number; max: number; step: number }[] = [
  { key: 'brightness', label: 'Fill brightness', min: 0, max: 3, step: .01 },
  { key: 'activeBrightness', label: 'Active brightness boost', min: 0, max: 8, step: .1 },
  { key: 'musicBrightness', label: 'Music brightness response', min: 0, max: 8, step: .1 },
  { key: 'bloomStrength', label: 'Bloom strength', min: 0, max: 3, step: .01 },
  { key: 'highlightBloomBoost', label: 'Highlight bloom boost', min: 0, max: 1, step: .01 },
  { key: 'bloomRadius', label: 'Bloom radius', min: 0, max: 1, step: .01 },
  { key: 'bloomThreshold', label: 'Bloom threshold', min: 0, max: 3, step: .01 },
  { key: 'musicThickness', label: 'Music strand thickness', min: 0, max: 3, step: .05 },
  { key: 'musicStrandBrightness', label: 'Music strand brightness', min: 0, max: 3, step: .05 },
  { key: 'attackThickness', label: 'Attack thickness boost', min: 0, max: 3, step: .05 },
  { key: 'attackBrightness', label: 'Attack brightness boost', min: 0, max: 3, step: .05 },
  { key: 'strands', label: 'Strand visibility', min: 0, max: 1, step: .01 },
]

export default function LiquidOrb() {
  const [colorPreset, setColorPreset] = useState('custom')
  const [filled, setFilled] = useState({ ...liquidOrbConfig.prototype.filled })
  const [settings, setSettings] = useState({ ...referenceSettings })
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [source, setSource] = useState<IntensitySource>('music')
  const [track, setTrack] = useState<ActivityTrack>('orchestra')
  const loadStatus = useListeningLoadStore(state => state.status)
  const profile = loadStatus !== 'loading' ? listeningEngine.activityProfile() : null
  const [intensity, setIntensity] = useState(.5)
  const [attackEnabled, setAttackEnabled] = useState(liquidOrbConfig.attack.enabled)
  const [attackStrength, setAttackStrength] = useState(liquidOrbConfig.attack.strength)
  const [state, setState] = useState<OrbState>('idle')
  const [size, setSize] = useState<OrbSize>('medium')
  const [zoom, setZoom] = useState(liquidOrbConfig.prototype.zoom.default)
  const [reset, setReset] = useState(0)
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
          <h1 className="mt-2 text-xl font-light">Liquid light · States</h1>
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
        <OrbPreview filled={filled} settings={settings} paused={paused} source={source} track={track} intensity={intensity} attackEnabled={attackEnabled} attackStrength={attackStrength} state={state} size={size} zoom={zoom} reset={reset} />
      </section>
      <section aria-label="Interaction controls" className="mb-6 grid gap-6 rounded-xl border border-white/10 p-4 md:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="mb-3 text-sm">Preview interactions</h2>
          <div className="flex flex-wrap gap-2">
            <button className={button} onClick={() => setPaused(!paused)}>{paused ? 'Resume animation' : 'Pause animation'}</button>
            <button className={button} onClick={() => {
              setColorPreset('custom'); setFilled({ ...liquidOrbConfig.prototype.filled }); setSettings({ ...referenceSettings }); setSource('music'); setTrack('orchestra'); setIntensity(.5)
              setState('reference'); setSize('medium'); setZoom(liquidOrbConfig.prototype.zoom.default); setAttackEnabled(liquidOrbConfig.attack.enabled); setAttackStrength(liquidOrbConfig.attack.strength); setReset(value => value + 1)
            }}>Reset to Reference</button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">Choose Highlighted to apply the boosted glow, or Playing to follow music intensity. Switching states preserves the animation phase and material settings.</p>
        </div>
        <div>
          <h2 className="mb-3 text-sm">Music intensity</h2>
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
          <div className="mb-4 border-t border-white/10 pt-3">
            <label className="flex min-h-11 items-center gap-3 text-xs"><input type="checkbox" checked={attackEnabled} onChange={event => setAttackEnabled(event.target.checked)} className="size-4 accent-cyan-300" />Attack response</label>
            <label className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-x-3 text-xs">
              <span>Rhythm response strength</span><output>{attackStrength.toFixed(2)}×</output>
              <input aria-label="Rhythm response strength" type="range" min="0" max={liquidOrbConfig.attack.maxStrength} step="0.05" value={attackStrength} disabled={!attackEnabled} onChange={event => setAttackStrength(Number(event.target.value))} className="col-span-2 w-full accent-cyan-300 disabled:opacity-40" />
            </label>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">Musical attacks briefly thicken and brighten the strands, then let them settle.</p>
          </div>
          {source === 'music' ? <>
            <p className="mb-3 text-xs text-slate-300">{currentExcerpt.title}</p>
            <label className="mb-3 flex min-h-11 flex-wrap items-center justify-between gap-3 text-xs">Activity to visualize
              <select value={track} onChange={event => setTrack(event.target.value as ActivityTrack)} className="min-h-11 rounded border border-white/20 bg-black px-3">
                <option value="orchestra">Full orchestra</option>
                {instrumentCatalog.filter(group => profile?.instruments[group.instrument]).map(group => <option key={group.instrument} value={group.instrument}>{group.name}</option>)}
              </select>
            </label>
            {loadStatus === 'loading' && <p role="status" className="mb-3 text-xs text-slate-400">Loading recording and activity profile…</p>}
            {loadStatus !== 'loading' && !profile && <p role="alert" className="mb-3 text-xs text-amber-200">Activity profile unavailable. Restore the excerpt’s local activity JSON to visualize the music.</p>}
            {profile && track === 'orchestra' && !profile.orchestra?.length && <p role="alert" className="mb-3 text-xs text-amber-200">The full-orchestra envelope is missing. Choose an instrument profile.</p>}
            <PlaybackControls />
            <p className="mt-3 text-xs leading-relaxed text-slate-400">The full recording plays while the chosen profile drives the orb. Instrument rests return it to idle. Animation pause freezes the visual frame independently of playback.</p>
          </> : <>
            {source === 'manual' && <label className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-x-3 text-xs">
              <span>Manual intensity</span><output>{Math.round(intensity * 100)}%</output>
              <input aria-label="Manual intensity" type="range" min="0" max="1" step="0.01" value={intensity} onChange={event => setIntensity(Number(event.target.value))} className="col-span-2 w-full accent-cyan-300" />
            </label>}
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{source === 'automatic' ? 'An illustrative envelope, without audio.' : 'Hold an intensity for inspection.'} Intensity changes speed, strand count, thickness, and brightness. Attacks add brief thickness and light accents.</p>
          </>}
        </div>
      </section>
      <section aria-label="Filled node controls" className="mb-6 rounded-xl border border-white/10 bg-white/[.025] p-4">
        <h2 className="text-sm">Filled node · Brightness and bloom</h2>
        <p className="mt-2 text-xs text-slate-400">Tune the base fill, then choose Highlighted, Selected (2× brightness), or Playing to inspect its active light. Strands follow musical dynamics and attacks in Playing.</p>
        <div className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filledControls.map(({ key, label, ...range }) => <label key={key} className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-x-2 text-xs text-slate-300">
            <span>{label}</span><output className="text-slate-400 tabular-nums">{filled[key]}</output>
            <input aria-label={label} type="range" {...range} value={filled[key]} className="col-span-2 w-full accent-cyan-300" onChange={event => setFilled(previous => ({ ...previous, [key]: Number(event.target.value) }))} />
          </label>)}
          <label className="flex min-h-11 items-center justify-between text-xs">Orb color<input aria-label="Orb color" type="color" value={settings.color} onChange={event => { setColorPreset('custom'); setSettings(previous => ({ ...previous, color: event.target.value })) }} className="h-9 w-12" /></label>
        </div>
      </section>
      <details className="rounded-xl border border-white/10 bg-white/[.025] p-4">
        <summary className="min-h-11 cursor-pointer text-sm">Strand material controls</summary>
        <div className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {controls.map(({ key, label, ...range }) => <label key={key} className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-x-2 text-xs text-slate-300">
            <span>{label}</span><output className="text-slate-400 tabular-nums">{settings[key]}</output>
            <input aria-label={label} type="range" {...range} value={settings[key]} className="col-span-2 w-full accent-cyan-300" onChange={event => setSettings(previous => ({ ...previous, [key]: Number(event.target.value) }))} />
          </label>)}
        </div>
      </details>
    </div>
  </main>
}
