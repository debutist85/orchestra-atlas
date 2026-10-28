import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { createLiquidMaterial, referenceSettings, type OrbSettings } from './shader'
import { easeAttack, profileAttackAt, risingAttack } from './attack-response'
import { listeningEngine } from '../listening/listening-engine'
import { usePlaybackStore } from '../../store/playback-store'
import type { OrchestraInstrument } from '../orchestra-map/config'
import { applyOrbState, demoIntensity, orbStates, smoothResponse } from './orb-states'

export type IntensitySource = 'music' | 'automatic' | 'manual'
export type ActivityTrack = 'orchestra' | OrchestraInstrument

export type ComparisonSettings = {
  settings: OrbSettings
  paused: boolean
  source: IntensitySource
  track: ActivityTrack
  intensity: number
  attackEnabled: boolean
  attackStrength: number
  active: boolean
  reset: number
  onToggleActive: () => void
}

export function OrbComparison(props: ComparisonSettings) {
  const host = useRef<HTMLDivElement>(null)
  const tiles = useRef<(HTMLDivElement | null)[]>([])
  const live = useRef(props)
  const highlighted = useRef(false)
  const meter = useRef<HTMLOutputElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { live.current = props }, [props])
  useEffect(() => { highlighted.current = hovered || focused }, [hovered, focused])

  useEffect(() => {
    const container = host.current!
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: false }) }
    catch {
      // An external graphics failure must be exposed in the semantic interface.
      // oxlint-disable-next-line react/set-state-in-effect
      setError('WebGL is unavailable. Enable WebGL to view this material study.')
      return
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setClearColor(0x000000)
    renderer.autoClear = false
    const canvas = renderer.domElement
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' })
    canvas.setAttribute('aria-hidden', 'true')
    container.prepend(canvas)
    const geometry = new THREE.PlaneGeometry(2, 2)
    const camera = new THREE.Camera()
    const views = orbStates.map(state => {
      const material = createLiquidMaterial()
      const scene = new THREE.Scene()
      scene.add(new THREE.Mesh(geometry, material))
      return { state: state.id, material, scene, settings: { ...referenceSettings }, time: 3.5 }
    })
    let bounds: { x: number; y: number; size: number }[] = []
    let dirty = true
    const resize = new ResizeObserver(() => {
      const outer = container.getBoundingClientRect()
      renderer.setSize(outer.width, outer.height, false)
      bounds = tiles.current.map(tile => {
        const rect = tile!.getBoundingClientRect()
        return { x: rect.left - outer.left, y: outer.bottom - rect.bottom, size: rect.width }
      })
      dirty = true
    })
    resize.observe(container)
    for (const tile of tiles.current) if (tile) resize.observe(tile)
    let previous = performance.now()
    let seconds = 0
    let intensity = 0
    let highlight = 0
    let attack = 0
    let lastProps = live.current
    let lastHighlight = false
    let lastMeter = ''
    let lastEpoch = usePlaybackStore.getState().epoch
    const contextLost = (event: Event) => {
      event.preventDefault()
      setError('The graphics context was lost. Reload the page to resume.')
      renderer.setAnimationLoop(null)
    }
    canvas.addEventListener('webglcontextlost', contextLost)
    renderer.setAnimationLoop(now => {
      const elapsed = (now - previous) / 1000
      const delta = Math.min(elapsed, .05)
      previous = now
      if (document.hidden || bounds.length !== views.length) return
      const current = live.current
      const reset = lastProps.reset !== current.reset
      const sourceChanged = lastProps.source !== current.source || lastProps.track !== current.track
      const resumed = lastProps.paused && !current.paused
      const intensityChanged = lastProps.source !== current.source || lastProps.track !== current.track || lastProps.intensity !== current.intensity
      if (reset) {
        seconds = 0; intensity = 0; highlight = 0; attack = 0
        for (const view of views) view.time = 3.5
      }
      const targetHighlight = highlighted.current || current.active
      dirty ||= lastProps !== current || lastHighlight !== targetHighlight || !current.paused
      lastProps = current
      lastHighlight = targetHighlight
      if (!dirty) return
      if (!current.paused) seconds += delta
      const epoch = usePlaybackStore.getState().epoch
      let targetIntensity = current.source === 'automatic' ? demoIntensity(seconds) : current.intensity
      if (current.source === 'music') {
        if (current.track === 'orchestra') targetIntensity = listeningEngine.orchestraIntensity()
        else {
          const activity = listeningEngine.instrumentActivity().get(current.track)
          targetIntensity = activity?.active ? activity.intensity : 0
        }
      }
      const seeked = current.source === 'music' && epoch !== lastEpoch
      if (seeked && !current.paused) intensity = targetIntensity
      lastEpoch = epoch
      const discontinuity = reset || sourceChanged || seeked || resumed || elapsed > .25
      if (!current.attackEnabled || discontinuity) attack = 0
      else if (!current.paused) {
        let targetAttack = 0
        if (current.source === 'music' && targetIntensity > 0) {
          targetAttack = profileAttackAt(listeningEngine.activityProfile(), current.track, listeningEngine.activityPosition())
        } else if (current.source === 'automatic') {
          targetAttack = risingAttack(demoIntensity(seconds), demoIntensity(Math.max(0, seconds - .08)))
        }
        attack = easeAttack(attack, targetAttack, delta)
      }
      // Pausing freezes the animation clock; static controls still update immediately.
      if (!current.paused) intensity = smoothResponse(intensity, targetIntensity, delta)
      else if (reset || intensityChanged) intensity = targetIntensity
      highlight = current.paused ? Number(targetHighlight) : smoothResponse(highlight, Number(targetHighlight), delta)
      const reading = `${Math.round(intensity * 100)}%`
      if (meter.current && reading !== lastMeter) { meter.current.value = reading; lastMeter = reading }
      renderer.setScissorTest(false)
      renderer.clear()
      renderer.setScissorTest(true)
      views.forEach((view, index) => {
        applyOrbState(view.settings, current.settings, view.state, highlight, intensity, attack, current.attackStrength)
        if (!current.paused) view.time += delta * view.settings.speed
        for (const key in view.settings) {
          const name = key as keyof OrbSettings
          if (name === 'color') (view.material.uniforms.color.value as THREE.Color).set(view.settings.color)
          else view.material.uniforms[name].value = view.settings[name]
        }
        view.material.uniforms.uTime.value = view.time
        const { x, y, size } = bounds[index]
        renderer.setViewport(x, y, size, size)
        renderer.setScissor(x, y, size, size)
        renderer.render(view.scene, camera)
      })
      dirty = false
    })
    return () => {
      renderer.setAnimationLoop(null)
      resize.disconnect()
      canvas.removeEventListener('webglcontextlost', contextLost)
      for (const view of views) view.material.dispose()
      geometry.dispose(); renderer.dispose(); canvas.remove()
    }
  }, [])

  return <>
    <div ref={host} className="relative grid grid-cols-1 gap-x-3 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {orbStates.map((state, index) => <section key={state.id} aria-label={state.label} className="relative min-w-0">
        {state.id === 'highlighted'
          ? <div className="relative aspect-square w-full"><div ref={element => { tiles.current[index] = element }} className="absolute inset-0" aria-hidden="true" />
            <button type="button" aria-label="Preview highlighted glow" aria-pressed={props.active} className="absolute inset-4 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-cyan-300" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onClick={props.onToggleActive} />
          </div>
          : <div ref={element => { tiles.current[index] = element }} aria-hidden="true" className="aspect-square w-full" />}
        <h2 className="relative text-center text-sm">{state.label}</h2>
        <p className="relative mx-auto mt-2 max-w-56 text-center text-xs leading-relaxed text-slate-400">{state.description}</p>
      </section>)}
    </div>
    <p className="mt-6 text-center text-xs text-slate-400">Intensity: <output ref={meter} aria-live="off" className="tabular-nums">0%</output> · {props.paused ? 'Paused' : 'Running'} · {props.source === 'music' ? 'Music activity profile' : props.source === 'automatic' ? 'Automatic demo envelope' : 'Manual control'}</p>
    {error && <p role="alert" className="mt-4 text-sm text-amber-200">{error}</p>}
  </>
}
