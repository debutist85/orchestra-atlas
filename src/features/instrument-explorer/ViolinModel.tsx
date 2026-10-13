import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { collectAnchors, instantiateInstrumentModel } from './instrument-model-resource'
import { anatomyLabel, anatomyPositionCorrection, isAnchorIntentionallyHidden } from './instrument-anatomy'
import { isOccluded, projectToScreen } from './anchor-projection'
import { instrumentExplorerConfig } from './config'

type Props = {
  url: string
  onReady: () => void
  onError: () => void
}

type AnchorLabel = { id: string; label: string; x: number; y: number }

export function ViolinModel({ url, onReady, onError }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [anchorLabels, setAnchorLabels] = useState<AnchorLabel[]>([])
  // All anchors ripple together until the visitor clicks any one of them —
  // then none do, permanently (no per-anchor cycling to track).
  const [ripplesActive, setRipplesActive] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  // Clicking an anchor selects it (bright + label stays visible) until a
  // different one is clicked — hover/focus give the same bright+label
  // treatment but only while the pointer/focus stays there.
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(instrumentExplorerConfig.camera.fov, 1, 0.01, 100)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.domElement.setAttribute('aria-hidden', 'true')
    // OrbitControls owns drag/pinch gestures on this element; without this the
    // browser's own touch scroll/zoom competes with it on touch devices.
    renderer.domElement.style.touchAction = 'none'
    host.append(renderer.domElement)
    scene.add(new THREE.HemisphereLight(0xf1eadb, 0x171b22, 2.2))
    const key = new THREE.DirectionalLight(0xffe3bd, 3.5)
    key.position.set(4, 6, 5)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x8ea9d8, 2.2)
    rim.position.set(-4, 1, -3)
    scene.add(rim)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = instrumentExplorerConfig.controls.dampingFactor
    controls.enablePan = false
    controls.enableZoom = instrumentExplorerConfig.controls.enableZoom
    controls.minPolarAngle = THREE.MathUtils.degToRad(instrumentExplorerConfig.controls.minPolarAngleDeg)
    controls.maxPolarAngle = THREE.MathUtils.degToRad(instrumentExplorerConfig.controls.maxPolarAngleDeg)

    let model: THREE.Object3D | undefined
    let ready = false
    let anchors: { id: string; label: string; object: THREE.Object3D }[] = []
    // An anchor sits essentially ON the surface it marks, so a full-length ray
    // to it would almost always report an "intersection" with that same
    // adjacent surface. Stopping the ray just short excludes that
    // self-intersection and only catches genuinely closer, occluding geometry
    // (e.g. the body blocking an anchor rotated to the back). Scaled to the
    // model's own size once it loads, below.
    let occlusionEpsilon = 0.01
    const raycaster = new THREE.Raycaster()
    const worldPosition = new THREE.Vector3()

    const updateAnchors = () => {
      if (!model || !anchors.length) return
      const width = host.clientWidth
      const height = host.clientHeight
      if (!width || !height) return
      const obstacle = model
      // The camera is never parented, so its own position is already world-space.
      const next = anchors.flatMap(({ id, label, object }) => {
        object.getWorldPosition(worldPosition)
        if (isOccluded(camera.position, worldPosition, obstacle, occlusionEpsilon, raycaster)) return []
        return [{ id, label, ...projectToScreen(worldPosition, camera, { width, height }) }]
      })
      setAnchorLabels(next)
    }

    const render = () => renderer.render(scene, camera)
    let frame = 0
    // Damped OrbitControls keep reporting a change for a few frames after a
    // drag ends (the coast-to-stop), then settle back to false — the loop
    // itself is cheap to leave running, but a render/reprojection only
    // happens on a frame that actually changed something.
    let forceRender = true
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const moved = controls.update()
      if (!moved && !forceRender) return
      forceRender = false
      render()
      updateAnchors()
    }
    frame = requestAnimationFrame(tick)

    // Always sized relative to viewport HEIGHT alone, regardless of aspect
    // ratio — a width-based fallback was tried (to avoid ever cropping a
    // very narrow/portrait viewport) and reverted twice: comparing against
    // the model's own width made the result depend on how wide the
    // violin+bow pair happens to be relative to the viewport, which swung
    // from "too small on a wide desktop window" to "cropped top and bottom"
    // to "too small on a narrow phone" depending on which axis won. Pure
    // height-based sizing is simple and predictable, at the accepted cost of
    // letting the sides extend past the frame on an unusually narrow
    // viewport. Centering is automatic: the camera always looks straight at
    // the model's own (already re-centered) origin. Which fraction applies
    // (instrumentExplorerConfig.framing) depends on orientation, re-read on
    // every resize so rotating a device switches it immediately.
    let modelSize: THREE.Vector3 | undefined
    const frameModel = () => {
      if (!modelSize) return
      const { targetHeightFractionPortrait, targetHeightFractionLandscape } = instrumentExplorerConfig.framing
      const fraction = host.clientWidth < host.clientHeight ? targetHeightFractionPortrait : targetHeightFractionLandscape
      const verticalFov = THREE.MathUtils.degToRad(camera.fov * 0.5)
      const distance = Math.max(modelSize.y / (2 * fraction * Math.tan(verticalFov)), 0.5)
      camera.position.set(0, 0, distance)
      camera.lookAt(0, 0, 0)
      controls.target.set(0, 0, 0)
      controls.update()
    }

    const resize = () => {
      const width = host.clientWidth
      const height = host.clientHeight
      if (!width || !height) return
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      // Aspect just changed above, so re-frame against it every time, not
      // only once at load — otherwise a resize that changes the aspect a lot
      // (e.g. a phone rotating between portrait and landscape) could leave
      // the model cropped or oddly small instead of re-fit to 70%.
      frameModel()
      forceRender = true
      if (model && !ready) {
        ready = true
        onReady()
      }
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    void instantiateInstrumentModel(url).then(loadedModel => {
      if (disposed) return
      model = loadedModel
      // The asset lies on its side in its authored pose. Rotate its front plane
      // square to the camera without adding a perspective turn around Y or Z.
      model.rotation.set(Math.PI / 2, 0, 0)
      model.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(model)
      const center = bounds.getCenter(new THREE.Vector3())
      const size = bounds.getSize(new THREE.Vector3())
      model.position.sub(center)
      scene.add(model)
      modelSize = size
      occlusionEpsilon = Math.max(Math.max(size.x, size.y, size.z) * 0.02, 0.001)
      anchors = collectAnchors(model).flatMap(object => {
        const label = anatomyLabel(object.name)
        if (!label) {
          if (import.meta.env.DEV && !isAnchorIntentionallyHidden(object.name)) console.warn(`Unlabeled instrument anchor: ${object.name}`)
          return []
        }
        const correction = anatomyPositionCorrection(object.name)
        if (correction) object.position.add(new THREE.Vector3(...correction))
        return [{ id: object.name, label, object }]
      })
      setStatus('ready')
      resize()
    }).catch(() => {
      if (!disposed) {
        setStatus('error')
        onError()
      }
    })

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      model?.removeFromParent()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [onError, onReady, url])

  return <div ref={hostRef} className="instrument-explore__model-canvas">
    {status === 'loading' && <output className="instrument-explore__status">Loading violin model</output>}
    {status === 'error' && <p className="instrument-explore__status" role="alert">Violin model unavailable</p>}
    {anchorLabels.length > 0 && (
      <div className={`instrument-anchors${ripplesActive ? ' instrument-anchors--rippling' : ''}`}>
        {anchorLabels.map(anchor => (
          <button
            key={anchor.id}
            type="button"
            className={`instrument-anchor${anchor.id === selectedAnchorId ? ' instrument-anchor--selected' : ''}`}
            style={{ transform: `translate3d(${anchor.x}px, ${anchor.y}px, 0) translate(-50%, -50%)` }}
            onClick={() => {
              setRipplesActive(false)
              setSelectedAnchorId(anchor.id)
            }}
          >
            <span className="instrument-anchor__dot" aria-hidden="true" />
            <span className="instrument-anchor__label">{anchor.label}</span>
          </button>
        ))}
      </div>
    )}
  </div>
}
