import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { liquidOrbConfig, type FilledNodeSettings, type OrbSize } from './config'
import { orbSizeScale } from './size-presets'
import { applyFlowResponse } from './flow-response'
import { createLiquidMaterial, referenceSettings, type OrbSettings } from './shader'
import { easeAttack, profileAttackAt, risingAttack } from './attack-response'
import { listeningEngine } from '../listening/listening-engine'
import { usePlaybackStore } from '../../store/playback-store'
import type { OrchestraInstrument } from '../orchestra-map/config'
import { applyOrbState, demoIntensity, orbStates, smoothResponse, type OrbState } from './orb-states'

export type IntensitySource = 'music' | 'automatic' | 'manual'
export type ActivityTrack = 'orchestra' | OrchestraInstrument

export type PreviewSettings = {
  filled: FilledNodeSettings
  settings: OrbSettings
  paused: boolean
  source: IntensitySource
  track: ActivityTrack
  intensity: number
  attackEnabled: boolean
  attackStrength: number
  state: OrbState
  zoom: number
  size: OrbSize
  reset: number
}

export function OrbPreview(props: PreviewSettings) {
  const host = useRef<HTMLDivElement>(null)
  const live = useRef(props)
  const meter = useRef<HTMLOutputElement>(null)
  const [error, setError] = useState('')
  useEffect(() => { live.current = props }, [props])

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
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    const canvas = renderer.domElement
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' })
    canvas.setAttribute('aria-hidden', 'true')
    container.prepend(canvas)
    const geometry = new THREE.PlaneGeometry(2, 2)
    const camera = new THREE.Camera()
    const material = createLiquidMaterial()
    material.defines.PROTOTYPE_FILLED = 1
    material.uniforms.fillBrightness = { value: 0 }
    material.uniforms.strandVisibility = { value: 0 }
    const scene = new THREE.Scene()
    scene.add(new THREE.Mesh(geometry, material))
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType })
    const composer = new EffectComposer(renderer, target)
    const renderPass = new RenderPass(scene, camera)
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .8, .55, .8)
    bloom.materialHighPassFilter.fragmentShader = bloom.materialHighPassFilter.fragmentShader.replace(
      'float v = luminance( texel.xyz );', 'float v = max( texel.r, max( texel.g, texel.b ) );',
    )
    const output = new OutputPass()
    composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(output)
    const settings = { ...referenceSettings }
    let time = liquidOrbConfig.rendering.initialTime
    let size = 0
    let dirty = true
    const resize = new ResizeObserver(() => {
      const outer = container.getBoundingClientRect()
      renderer.setSize(outer.width, outer.height, false)
      composer.setSize(outer.width, outer.height)
      size = outer.width
      dirty = true
    })
    resize.observe(container)
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
      if (document.hidden || size <= 0) return
      const current = live.current
      const reset = lastProps.reset !== current.reset
      const sourceChanged = lastProps.source !== current.source || lastProps.track !== current.track
      const resumed = lastProps.paused && !current.paused
      const intensityChanged = lastProps.source !== current.source || lastProps.track !== current.track || lastProps.intensity !== current.intensity
      if (reset) {
        seconds = 0; intensity = 0; highlight = 0; attack = 0
        time = liquidOrbConfig.rendering.initialTime
      }
      const targetHighlight = current.state === 'highlighted'
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
          targetAttack = risingAttack(demoIntensity(seconds), demoIntensity(Math.max(0, seconds - liquidOrbConfig.attack.lookbackSeconds)))
        }
        attack = easeAttack(attack, targetAttack, delta)
      }
      // Pausing freezes the animation clock; static controls still update immediately.
      if (!current.paused) intensity = smoothResponse(intensity, targetIntensity, delta)
      else if (reset || intensityChanged) intensity = targetIntensity
      highlight = current.paused ? Number(targetHighlight) : smoothResponse(highlight, Number(targetHighlight), delta)
      const reading = `${Math.round(intensity * 100)}%`
      if (meter.current && reading !== lastMeter) { meter.current.value = reading; lastMeter = reading }
      applyOrbState(settings, current.settings, current.state, highlight, intensity, attack, current.attackStrength)
      if (current.state === 'playing') {
        applyFlowResponse(settings, current.settings, intensity, attack, current.attackStrength, current.filled)
      }
      if (!current.paused) time += delta * settings.speed
      for (const key in settings) {
        const name = key as keyof OrbSettings
        if (name === 'color') (material.uniforms.color.value as THREE.Color).set(settings.color)
        else material.uniforms[name].value = settings[name]
      }
      material.uniforms.uTime.value = time
      const filled = current.filled
      const active = current.state === 'highlighted' ? highlight : 0
      const musical = current.state === 'playing' ? intensity : 0
      const selection = current.state === 'selected' ? liquidOrbConfig.states.selected.brightnessMultiplier : 1
      material.uniforms.fillBrightness.value = filled.brightness * selection * (1 + active * filled.activeBrightness + musical * filled.musicBrightness)
      material.uniforms.strandVisibility.value = filled.strands
      // Scale the projected quad, keeping bloom in the full fixed stage so its halo has room.
      material.uniforms.halfExtent.value = liquidOrbConfig.rendering.halfExtent / (orbSizeScale(current.size) * current.zoom)
      bloom.strength = filled.bloomStrength + active * filled.highlightBloomBoost
      bloom.radius = filled.bloomRadius
      bloom.threshold = filled.bloomThreshold
      composer.render(0)
      dirty = false
    })
    return () => {
      renderer.setAnimationLoop(null)
      resize.disconnect()
      canvas.removeEventListener('webglcontextlost', contextLost)
      bloom.dispose(); output.dispose(); renderPass.dispose(); composer.dispose()
      material.dispose()
      geometry.dispose(); renderer.dispose(); canvas.remove()
    }
  }, [])

  const state = orbStates.find(state => state.id === props.state)!
  return <>
    <div ref={host} aria-label={`${liquidOrbConfig.prototype.sizes[props.size].label}, ${state.label} orb preview`} className="relative mx-auto aspect-square w-full max-w-[520px]" />
    <h2 className="mt-2 text-center text-sm">{state.label}</h2>
    <p className="mx-auto mt-2 max-w-72 text-center text-xs leading-relaxed text-slate-400">{props.state === 'highlighted' ? 'Boosted glow and brightness while highlighted.' : state.description}</p>
    <p className="mt-6 text-center text-xs text-slate-400">Intensity: <output ref={meter} aria-live="off" className="tabular-nums">0%</output> · {props.paused ? 'Paused' : 'Running'} · {props.source === 'music' ? 'Music activity profile' : props.source === 'automatic' ? 'Automatic demo envelope' : 'Manual control'}</p>
    {error && <p role="alert" className="mt-4 text-sm text-amber-200">{error}</p>}
  </>
}
