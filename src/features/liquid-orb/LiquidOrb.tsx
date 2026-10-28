import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { createLiquidMaterial, referenceSettings, type OrbSettings } from './shader'

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
  const host = useRef<HTMLDivElement>(null)
  const [settings, setSettings] = useState({ ...referenceSettings })
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [error, setError] = useState('')
  const live = useRef({ settings, paused })
  const resetTime = useRef(false)
  useEffect(() => { live.current = { settings, paused } }, [settings, paused])
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const reduce = () => { if (media.matches) setPaused(true) }
    media.addEventListener('change', reduce)
    return () => media.removeEventListener('change', reduce)
  }, [])
  useEffect(() => {
    const container = host.current!
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false }) }
    catch {
      // Report failure of the external graphics system to the accessible UI.
      // oxlint-disable-next-line react/set-state-in-effect
      setError('WebGL is unavailable. This study needs a browser with WebGL enabled.')
      return
    }
    renderer.setClearColor(0x000000)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    container.append(renderer.domElement)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    const scene = new THREE.Scene()
    const camera = new THREE.Camera()
    const material = createLiquidMaterial()
    const geometry = new THREE.PlaneGeometry(2, 2)
    scene.add(new THREE.Mesh(geometry, material))
    let dirty = true
    const resize = new ResizeObserver(() => {
      const size = container.clientWidth
      renderer.setSize(size, size, false)
      dirty = true
    })
    resize.observe(container)
    let time = 3.5
    let previous = performance.now()
    let lastSettings: OrbSettings | undefined
    const contextLost = (event: Event) => {
      event.preventDefault()
      setError('The graphics context was lost. Reload this page to resume the study.')
      renderer.setAnimationLoop(null)
    }
    renderer.domElement.addEventListener('webglcontextlost', contextLost)
    renderer.setAnimationLoop((now) => {
      const delta = Math.min((now - previous) / 1000, .05)
      previous = now
      const current = live.current
      if (document.hidden) return
      if (resetTime.current) { time = 3.5; resetTime.current = false; dirty = true }
      if (current.settings !== lastSettings) {
        for (const [key, value] of Object.entries(current.settings)) {
          if (key === 'color') (material.uniforms.color.value as THREE.Color).set(value)
          else material.uniforms[key].value = value
        }
        lastSettings = current.settings
        dirty = true
      }
      if (!current.paused) { time += delta * current.settings.speed; dirty = true }
      if (dirty) {
        material.uniforms.uTime.value = time
        renderer.render(scene, camera)
        dirty = false
      }
    })
    return () => {
      renderer.setAnimationLoop(null)
      resize.disconnect()
      renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      geometry.dispose(); material.dispose(); renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])
  const button = 'min-h-11 rounded border border-white/20 px-3 text-xs hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-300'
  return <main className="fixed inset-0 overflow-auto bg-black font-ui text-slate-200">
    <div className="mx-auto flex min-h-full max-w-6xl flex-col p-5 md:p-8">
      <header className="flex items-start justify-between gap-4">
        <div><p className="text-[10px] uppercase tracking-[.2em] text-slate-400">Orchestra Atlas · Material study 01</p>
          <h1 className="mt-2 text-xl font-light">Liquid light</h1></div>
        <a href="/" className={button + ' flex items-center'}>Back to orchestra</a>
      </header>
      <div className="grid flex-1 items-center gap-6 py-6 md:grid-cols-[1fr_260px]">
        <section aria-label="Liquid light orb preview" className="flex min-w-0 flex-col items-center">
          <div ref={host} aria-hidden="true" className="aspect-square w-full max-w-[600px]" />
          <p className="max-w-sm text-center text-xs leading-relaxed text-slate-400">A dark sphere revealed by flowing cyan folds.<br />One procedural material, continuously evolving.</p>
          {error && <p role="alert" className="mt-4 max-w-sm text-sm text-amber-200">{error}</p>}
        </section>
        <section aria-label="Material controls" className="w-full rounded-xl border border-white/10 bg-white/[.025] p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <button className={button} onClick={() => setPaused(!paused)}>{paused ? 'Resume' : 'Pause'}</button>
            <button className={button} onClick={() => { setSettings({ ...referenceSettings }); resetTime.current = true }}>Reset to Reference</button>
          </div>
          <div className="grid gap-2">
            {controls.map(({ key, label, ...range }) => <label key={key} className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-x-2 text-xs text-slate-300">
              <span>{label}</span><output className="text-slate-400 tabular-nums">{settings[key]}</output>
              <input aria-label={label} type="range" {...range} value={settings[key]} className="col-span-2 w-full accent-cyan-300" onChange={event => setSettings(previous => ({ ...previous, [key]: Number(event.target.value) }))} />
            </label>)}
            <label className="mt-2 flex min-h-11 items-center justify-between text-xs">Orb color<input aria-label="Orb color" type="color" value={settings.color} onChange={event => setSettings(previous => ({ ...previous, color: event.target.value }))} className="h-9 w-12" /></label>
          </div>
        </section>
      </div>
    </div>
  </main>
}
