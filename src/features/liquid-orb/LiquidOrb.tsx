import { useEffect, useState } from 'react'
import { referenceSettings, type OrbSettings } from './shader'
import { OrbComparison } from './OrbComparison'

const controls: { key: Exclude<keyof OrbSettings, 'color'>; label: string; min: number; max: number; step: number }[] = [
  { key: 'speed', label: 'Animation speed', min: 0, max: 2, step: .05 },
  { key: 'complexity', label: 'Flow complexity', min: .4, max: 2, step: .05 },
  { key: 'distortion', label: 'Flow distortion', min: 0, max: 2, step: .05 },
  { key: 'strands', label: 'Strand density', min: 1, max: 8, step: 1 },
  { key: 'thickness', label: 'Strand thickness', min: .3, max: 3, step: .05 },
  { key: 'brightness', label: 'Strand brightness', min: 0, max: 3, step: .05 },
  { key: 'folds', label: 'Internal folds', min: 0, max: 1, step: .01 },
  { key: 'ambient', label: 'Interior ambient', min: 0, max: .2, step: .005 },
  { key: 'highlights', label: 'Highlight concentration', min: .5, max: 5, step: .1 },
  { key: 'glow', label: 'Glow intensity', min: 0, max: 2, step: .05 },
  { key: 'glowRadius', label: 'Glow radius', min: .25, max: 2, step: .05 },
  { key: 'opacity', label: 'Orb opacity', min: 0, max: 1, step: .01 },
]

export default function LiquidOrb() {
  const [settings, setSettings] = useState({ ...referenceSettings })
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [automatic, setAutomatic] = useState(true)
  const [intensity, setIntensity] = useState(.5)
  const [active, setActive] = useState(false)
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
          <p className="mt-3 max-w-xl text-xs leading-relaxed text-slate-400">One material across focus, activity, and rest. Compare the states, then adjust their shared base below.</p></div>
        <a href="/" className={button + ' flex shrink-0 items-center'}>Back to orchestra</a>
      </header>
      <section aria-label="Orb state comparison" className="py-6 md:py-10">
        <OrbComparison settings={settings} paused={paused} automatic={automatic} intensity={intensity} active={active} reset={reset} onToggleActive={() => setActive(value => !value)} />
      </section>
      <section aria-label="Interaction controls" className="mb-6 grid gap-6 rounded-xl border border-white/10 p-4 md:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="mb-3 text-sm">Preview interactions</h2>
          <div className="flex flex-wrap gap-2">
            <button className={button} onClick={() => setPaused(!paused)}>{paused ? 'Resume' : 'Pause'}</button>
            <button className={button} onClick={() => {
              setSettings({ ...referenceSettings }); setAutomatic(true); setIntensity(.5)
              setActive(false); setReset(value => value + 1)
            }}>Reset to Reference</button>
            <button aria-pressed={active} className={button + (active ? ' bg-cyan-300/15' : '')} onClick={() => setActive(!active)}>Highlighted: {active ? 'Active' : 'Hover / focus'}</button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">Hover or focus the highlighted orb to preview its glow. Click or tap to keep it active.</p>
        </div>
        <div>
          <h2 className="mb-2 text-sm">Music intensity · demo</h2>
          <label className="flex min-h-11 items-center gap-3 text-xs"><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} className="size-4 accent-cyan-300" />Automatic envelope</label>
          <label className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-x-3 text-xs">
            <span>Manual intensity</span><output>{Math.round(intensity * 100)}%</output>
            <input aria-label="Manual intensity" type="range" min="0" max="1" step="0.01" value={intensity} onChange={event => { setIntensity(Number(event.target.value)); setAutomatic(false) }} className="col-span-2 w-full accent-cyan-300" />
          </label>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">An illustrative envelope, without audio. Intensity changes flow speed, distortion, complexity, and strand density.</p>
        </div>
      </section>
      <details open className="rounded-xl border border-white/10 bg-white/[.025] p-4">
        <summary className="min-h-11 cursor-pointer text-sm">Shared material controls</summary>
        <div className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {controls.map(({ key, label, ...range }) => <label key={key} className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-x-2 text-xs text-slate-300">
            <span>{label}</span><output className="text-slate-400 tabular-nums">{settings[key]}</output>
            <input aria-label={label} type="range" {...range} value={settings[key]} className="col-span-2 w-full accent-cyan-300" onChange={event => setSettings(previous => ({ ...previous, [key]: Number(event.target.value) }))} />
          </label>)}
          <label className="flex min-h-11 items-center justify-between text-xs">Orb color<input aria-label="Orb color" type="color" value={settings.color} onChange={event => setSettings(previous => ({ ...previous, color: event.target.value }))} className="h-9 w-12" /></label>
        </div>
      </details>
    </div>
  </main>
}
