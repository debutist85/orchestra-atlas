import * as THREE from 'three'
import { gsap } from 'gsap'
import { labelCornerFor, layoutEntities, pickEntityNearMarks, union, type EntityLayout } from '../utils/entity-layout'
import { layoutOrchestraFamilyLabels } from '../utils/orchestra-family-label-layout'
import { NavigationMotion, type MotionUI, type MotionValue } from './navigation-motion'
import { familySelection, highlightedInstrumentIds } from '../../../store/catalog'
import { frameOutsideCaption } from './caption-framing'
import { cameraFocus, contextualOverviewFocus, projectedNodeBounds } from './camera-focus'
import { acceptCanvasNavigation, clickDestination, familySections, mapLabels, sectionFamily, travelingTargetId, type FamilyId, type NavigationState } from '../utils/navigation'
import { placeCaption, resolveCaptionGap } from '../utils/caption-placement'
import { identityCaptionPlacement } from '../identity-layout'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js'

import type { OrchestraSceneConfig, OrchestraSectionId, OrchestraInstrument } from '../config'
import { createOrchestraVisualState, type OrchestraVisualState, type SectionVisualState } from './visual-state'
import { createOrchestraPositions, ringPoint } from './seating'
import { createNodeMaterial, nodeSeed } from './node-material'
import { sectionNodeColors } from './section-palette'
import { idleAppearance } from './idle-animation'
import { ghostFocusFor, ghostLiveWeight, ghostPresentFor } from './ghost-idle'
import { createNodeGhosts } from './node-ghost'
import { createAudioHighlight } from './audio-highlight'
import type { OrchestraPosition } from './seating'
import { createOrchestraFloor } from './floor'

type PaletteGroup = {
  nodes: OrchestraPosition[]
  geometry: THREE.BufferGeometry
  colors: THREE.Color[]
  mesh: THREE.InstancedMesh
  idleAmount: number
  idleWeights: number[]
}

const conductorColor = new THREE.Color('#50555a')

// Adaptive render quality: nothing else in this scene detects device/GPU
// capability, so a weak-but-not-ancient GPU (older laptop integrated
// graphics, especially) gets the exact same bloom + FXAA + pixel-ratio
// workload as a flagship phone — even though bloom's multi-pass full-screen
// blur is disproportionately expensive on exactly that kind of hardware
// relative to modern mobile GPUs, which are comparatively well-suited to
// this fill-rate-bound workload. These thresholds are a first pass, not
// tuned against real struggling hardware — retune after a real-world test.
// Bloom isn't just decorative here: node-material.ts's emphasis is a pure
// brightness multiplier, and the whole highlight/neutral distinction relies
// on crossing the bloom threshold (see interaction.*Intensity in config.ts's
// comment "reserve HDR headroom for highlighting") — so step 1 keeps bloom
// on but shrinks its internal working resolution (cheap: still a real glow,
// just a smaller/softer one), and only step 2 removes it outright, at which
// point #animateFrame compensates with an emphasis-driven scale boost so
// highlighted nodes stay visually distinct without relying on glow at all.
const ADAPTIVE_WARMUP_FRAMES = 15 // shader-compile/pipeline warm-up frames to ignore
const ADAPTIVE_WINDOW_FRAMES = 60 // processed frames between step-down checks
const ADAPTIVE_SLOW_FACTOR = 1.4 // sustained avg frame time vs target before stepping down
const ADAPTIVE_MAX_STEP = 2
const ADAPTIVE_BLOOM_RESOLUTION_SCALE = 0.5 // step 1: bloom's internal working resolution
const ADAPTIVE_EMPHASIS_SCALE_BOOST = 0.18 // step 2: extra size at full emphasis, compensating for no glow
// Orchestra-level hover only ever nudges brightness a little (interaction.
// hoveredIntensity sits close to neutralIntensity), so without bloom's glow
// neither that brightness nudge nor the scale boost above is enough to read.
// At step 2 the hovered section itself is pushed toward full emphasis
// instead, for a stronger brightness jump and a bigger scale boost.
const ADAPTIVE_HOVER_EMPHASIS = 0.55

export class OrchestraScene {
  readonly #container: HTMLElement
  readonly #scene = new THREE.Scene()
  readonly #camera = new THREE.PerspectiveCamera()
  readonly #renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
  readonly #composer: EffectComposer
  readonly #scenePass: RenderPass
  readonly #bloomPass: UnrealBloomPass
  readonly #outputPass: OutputPass
  readonly #antialiasPass: ShaderPass
  readonly #resizeObserver: ResizeObserver
  #multisampleCounts: number[] | null = null
  #group = new THREE.Group()
  #controls: OrbitControls | null = null
  #config: OrchestraSceneConfig
  #debug: boolean
  readonly #onHoveredSectionsChange?: (sections: OrchestraSectionId[], instrument?: OrchestraInstrument) => void
  readonly #onNavigate?: (state: NavigationState) => void
  readonly #onLabelPosition?: (id: string, x: number, y: number) => void
  readonly #onConductorPosition?: (x: number, y: number, diameter: number) => void
  readonly #onQualityStep?: (step: 0 | 1 | 2) => void
  #annotationResize: ResizeObserver | undefined
  #annotationMutation: MutationObserver | undefined
  #annotationUI: MotionUI | undefined
  #entityLayouts: EntityLayout[] = []
  readonly #motion = new NavigationMotion()
  #experienceCameraTimeline: gsap.core.Timeline | undefined
  #experienceOverview = false
  // Ghost twins' visibility for the Explore miniature: eased 1 → 0 as the
  // map shrinks into it and back as it returns, on the same timeline as the
  // camera, instead of switching off in one frame.
  #ghostOverviewVisibility = { value: 1 }
  #active = true
  #contextualQuality = false
  #navigationFocus = new Map<string, { value: number }>()
  #initializedNavigation = false
  #navigation: NavigationState = { level: 'orchestra' }
  // Holds the navigation ghost intensity levels are computed from, one travel
  // behind #navigation: it only catches up once the camera has actually
  // arrived (see the `handoff` callback in setNavigation), so a group that
  // stays present across the whole trip — the family/instrument being zoomed
  // into or out of — keeps its pre-travel look throughout, in either
  // direction. Fades (outgoing dimming, incoming fade-ins for groups that
  // were not present before) are unaffected and stay immediate.
  #ghostFocusNavigation: NavigationState = { level: 'orchestra' }
  #labelNavigation: NavigationState = { level: 'orchestra' }
  #travelingTargetId: string | undefined
  #labelsFollowTravel = false
  // #render()'s label reflow (mapLabels/project/layoutEntities plus a forced
  // getBoundingClientRect layout pass) only needs to rerun when something it
  // reads has actually changed — camera travel, navigation, container/label
  // resize — not on every frame idle material animation keeps rendering.
  // Seeded true so the first frame always computes positions.
  #labelLayoutDirty = true
  #cameraCenter = new THREE.Vector3()
  #cameraDestination = new THREE.Vector3()
  #centerDestination = new THREE.Vector3()
  #positions: OrchestraPosition[] = []
  #labels: { element: HTMLSpanElement; position: THREE.Vector3 }[] = []
  readonly #motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  // Mirrors the CSS `@media (orientation: portrait)` breakpoint that used to
  // pick which set of identity-layout CSS variables applied; read on demand
  // (not listened to) since positionIdentity() already reruns every frame
  // while travel/resize keeps #render() scheduled.
  readonly #orientationQuery = window.matchMedia('(orientation: portrait)')
  #animationFrame: number | null = null
  #materialTime = 0
  #lastFrameTime: number | null = null
  // See ADAPTIVE_* constants above. #qualityStep only ever increases within a
  // session (reset on reload) — forceQuality lets any device preview a step
  // without a real struggling machine to measure on.
  #qualityStep: 0 | 1 | 2 = (() => {
    const forced = Number(new URLSearchParams(window.location.search).get('forceQuality'))
    return forced === 1 || forced === 2 ? forced : 0
  })()
  #adaptiveFrameMs = 0
  #adaptiveFrameCount = 0
  readonly #pointerClient = new THREE.Vector2()
  readonly #pointerNdc = new THREE.Vector2()
  readonly #pointerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1))
  readonly #pointerWorld = new THREE.Vector3()
  readonly #pointerPoint = new THREE.Vector2()
  #pointerDirty = false
  #pointerStartedOnCanvas = false
  #pointerOrigin = new THREE.Vector2()
  #pointerDragged = false
  #navigationBlocked = false
  #floor: ReturnType<typeof createOrchestraFloor> | null = null
  #state: OrchestraVisualState
  #targetState: OrchestraVisualState
  #mapHoveredInstrument: OrchestraInstrument | undefined
  // What clicking the selected instrument's own lights does at instrument
  // depth (entering Explore); null where there is nothing to open.
  #selectionAction: (() => void) | null = null
  #labelHoveredInstrument: OrchestraInstrument | undefined
  #mapHoveredSection: OrchestraSectionId | null = null
  #navigationHoveredSections = new Set<OrchestraSectionId>()
  #hoveredSections = new Set<OrchestraSectionId>()
  #hoveredInstrument: OrchestraInstrument | undefined
  // One entry per real, visible node (never a hand-drawn/convex-hull polygon
  // per section or instrument): hover/click always targets whichever real
  // node is nearest, within `padding` of its own edge — so hovering empty
  // space between sparse/non-convex node clusters (e.g. the gap inside a
  // section's own curved seating arc) never claims a section or instrument
  // that isn't actually there, at any navigation depth.
  #sectionHoverNodes: { sectionId: OrchestraSectionId; point: THREE.Vector2; radius: number }[] = []
  #instrumentHoverNodes: { id: string; sectionId: OrchestraSectionId; instrument: OrchestraInstrument; point: THREE.Vector2; radius: number }[] = []
  #sectionMaterials = new Map<OrchestraSectionId, ReturnType<typeof createNodeMaterial>>()
  #pickable: THREE.InstancedMesh[] = []
  #paletteGroups: PaletteGroup[] = []
  #ghosts = new Map<OrchestraSectionId, ReturnType<typeof createNodeGhosts>>()
  #audioHighlights = new Map<OrchestraSectionId, ReturnType<typeof createAudioHighlight>>()
  // Which instrument(s) are genuinely audible right now (0–1 per instrument),
  // pushed in from outside via setAudibleActivity; empty until playback starts.
  #audibleActivity: ReadonlyMap<OrchestraInstrument, number> = new Map()
  #idleHighlightFamily: FamilyId | null = null
  #idleHighlightInstrument: OrchestraInstrument | null = null
  readonly #raycaster = new THREE.Raycaster()
  readonly #nodeMatrix = new THREE.Matrix4()
  readonly #projectScratch = new THREE.Vector3()

  constructor(
    container: HTMLElement,
    config: OrchestraSceneConfig,
    debug: boolean,
    onHoveredSectionsChange?: (sections: OrchestraSectionId[], instrument?: OrchestraInstrument) => void,
    onNavigate?: (state: NavigationState) => void,
    onLabelPosition?: (id: string, x: number, y: number) => void,
    onConductorPosition?: (x: number, y: number, diameter: number) => void,
    onQualityStep?: (step: 0 | 1 | 2) => void,
  ) {
    this.#container = container
    this.#config = config
    this.#debug = debug
    this.#onHoveredSectionsChange = onHoveredSectionsChange
    this.#onNavigate = onNavigate
    this.#onLabelPosition = onLabelPosition
    this.#onConductorPosition = onConductorPosition
    this.#onQualityStep = onQualityStep
    if (this.#qualityStep > 0) onQualityStep?.(this.#qualityStep)
    this.#state = createOrchestraVisualState(config.sections)
    this.#targetState = createOrchestraVisualState(config.sections)
    // Empty canvas pixels stay transparent so the orchestra photograph can sit behind the lights.
    this.#scene.background = null
    this.#renderer.setClearColor(0x000000, 0)
    this.#renderer.setPixelRatio(1)
    this.#renderer.outputColorSpace = THREE.SRGBColorSpace
    this.#renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.#renderer.toneMappingExposure = config.visuals.exposure
    // Keep linear HDR values until bloom has extracted the bright surfaces.
    // OutputPass applies tone mapping and the display color conversion once.
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType })
    target.samples = 0
    this.#composer = new EffectComposer(this.#renderer, target)
    this.#scenePass = new RenderPass(this.#scene, this.#camera)
    this.#bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0, 0, 1)
    // Peak-channel extraction avoids preferential bloom on yellow/green nodes.
    this.#bloomPass.materialHighPassFilter.fragmentShader =
      this.#bloomPass.materialHighPassFilter.fragmentShader.replace(
        'float v = luminance( texel.xyz );',
        'float v = max( texel.r, max( texel.g, texel.b ) );',
      )
    this.#outputPass = new OutputPass()
    this.#composer.addPass(this.#scenePass)
    this.#composer.addPass(this.#bloomPass)
    this.#composer.addPass(this.#outputPass)
    // Display-space fallback for hardware without multisampled HDR support.
    this.#antialiasPass = new ShaderPass(FXAAShader)
    this.#composer.addPass(this.#antialiasPass)
    this.#renderer.domElement.setAttribute('aria-hidden', 'true')
    container.append(this.#renderer.domElement)

    container.addEventListener('click', this.#handleClick)
    container.addEventListener('pointermove', this.#handlePointerMove)
    container.addEventListener('pointerleave', this.#handlePointerLeave)
    document.addEventListener('pointerdown', this.#handlePointerDown, true)
    this.#motionPreference.addEventListener('change', this.#handleMotionPreference)
    document.addEventListener('visibilitychange', this.#handleVisibility)

    this.#scene.add(new THREE.HemisphereLight(0xc5d0de, 0x16131a, 0.65))
    const light = new THREE.DirectionalLight(0xffffff, 2)
    light.position.set(-8, 12, 5)
    this.#scene.add(light)
    this.#rebuild()
    this.#resizeObserver = new ResizeObserver(this.#resize)
    this.#resizeObserver.observe(container)
    this.#resize()
  }

  update(config: OrchestraSceneConfig, debug: boolean) {
    this.#config = config
    this.#debug = debug
    this.#rebuild()
    this.#resize()
  }

  setSectionVisualState(section: OrchestraSectionId, patch: Partial<SectionVisualState>) {
    const target = this.#targetState[section]
    for (const key of ['opacity', 'emphasis', 'activity'] as const) {
      const value = patch[key]
      if (value !== undefined && Number.isFinite(value)) {
        target[key] = THREE.MathUtils.clamp(value, key === 'emphasis' ? -1 : 0, 1)
      }
    }
    this.#scheduleFrame()
  }

  setSelectionAction(action: (() => void) | null) {
    this.#selectionAction = action
    if (!action && this.#navigation.level === 'instrument') this.#renderer.domElement.style.cursor = ''
  }

  setHoveredSection(section: OrchestraSectionId | null) {
    this.setHoveredSections(section ? [section] : [])
  }

  setHoveredTarget(target: NavigationState | null) {
    this.#labelHoveredInstrument = target?.level === 'instrument' ? target.instrumentId : undefined
    this.setHoveredSections(target && target.level !== 'orchestra' ? familySections(target.familyId) : [])
    this.#scheduleFrame()
  }

  setHoveredSections(sections: OrchestraSectionId[]) {
    this.#navigationHoveredSections = new Set(sections)
    this.#applyHoveredSections()
  }

  #setMapHoveredSection(section: OrchestraSectionId | null) {
    this.#mapHoveredSection = section
    this.#applyHoveredSections()
  }

  #applyHoveredSections() {
    const next = this.#navigationHoveredSections.size
      ? new Set(this.#navigationHoveredSections)
      : new Set(this.#mapHoveredSection ? [this.#mapHoveredSection] : [])
    const instrument = this.#labelHoveredInstrument ?? this.#mapHoveredInstrument
    if (next.size === this.#hoveredSections.size
      && [...next].every(section => this.#hoveredSections.has(section))
      && instrument === this.#hoveredInstrument) return
    this.#hoveredSections = next
    this.#hoveredInstrument = instrument
    this.#renderer.domElement.style.cursor = this.#navigation.level !== 'instrument' && [...next].some(id => sectionFamily(id)) ? 'pointer' : ''
    this.#onHoveredSectionsChange?.([...next], instrument)
    this.#scheduleFrame()
  }

  // Client coordinates in, semantic IDs out; navigation remains application state.
  pickNode(clientX: number, clientY: number): { nodeId: string; sectionId: OrchestraSectionId } | null {
    return this.#preparePointerRay(clientX, clientY) ? this.#pickNodeFromRay() : null
  }

  #preparePointerRay(clientX: number, clientY: number) {
    const bounds = this.#container.getBoundingClientRect()
    if (!bounds.width || !bounds.height || clientX < bounds.left || clientX > bounds.right
      || clientY < bounds.top || clientY > bounds.bottom) return false
    this.#camera.updateMatrixWorld()
    this.#group.updateMatrixWorld(true)
    this.#pointerNdc.set(
      (clientX - bounds.left) / bounds.width * 2 - 1,
      1 - (clientY - bounds.top) / bounds.height * 2,
    )
    this.#raycaster.setFromCamera(this.#pointerNdc, this.#camera)
    return true
  }

  #pickNodeFromRay(): { nodeId: string; sectionId: OrchestraSectionId } | null {
    for (const hit of this.#raycaster.intersectObjects(this.#pickable, false)) {
      const sectionId = hit.object.userData.sectionId as OrchestraSectionId
      if (hit.instanceId === undefined || this.#state[sectionId].opacity < 0.01) continue
      return { nodeId: hit.object.userData.nodeIds[hit.instanceId], sectionId }
    }
    return null
  }

  dispose() {
    this.#annotationResize?.disconnect()
    this.#annotationMutation?.disconnect()
    this.#motion.dispose()
    this.#experienceCameraTimeline?.kill()
    this.#resizeObserver.disconnect()
    this.#container.removeEventListener('click', this.#handleClick)
    this.#container.removeEventListener('pointermove', this.#handlePointerMove)
    this.#container.removeEventListener('pointerleave', this.#handlePointerLeave)
    document.removeEventListener('pointerdown', this.#handlePointerDown, true)
    this.#motionPreference.removeEventListener('change', this.#handleMotionPreference)
    document.removeEventListener('visibilitychange', this.#handleVisibility)
    if (this.#animationFrame !== null) cancelAnimationFrame(this.#animationFrame)
    this.#controls?.dispose()
    this.#clear()
    this.#scenePass.dispose()
    this.#bloomPass.dispose()
    this.#outputPass.dispose()
    this.#antialiasPass.dispose()
    this.#composer.dispose()
    this.#renderer.dispose()
    this.#renderer.domElement.remove()
  }

  #clear() {
    this.#floor?.dispose()
    this.#floor = null
    if (this.#animationFrame !== null) cancelAnimationFrame(this.#animationFrame)
    this.#animationFrame = null
    this.#lastFrameTime = null
    this.#sectionMaterials.clear()
    this.#pickable = []
    this.#paletteGroups = []
    this.#pointerDirty = false
    this.#sectionHoverNodes = []
    this.#ghosts.clear()
    this.#audioHighlights.clear()
    this.#labels.forEach(({ element }) => element.remove())
    this.#labels = []
    this.#group.removeFromParent()
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    this.#group.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Sprite) {
        geometries.add(object.geometry)
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
      }
    })
    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((material) => material.dispose())
  }

  #rebuild() {
    this.#motion.finish()
    this.#experienceCameraTimeline?.kill()
    this.#controls?.dispose()
    this.#controls = null
    this.#clear()
    this.#group = new THREE.Group()
    this.#scene.add(this.#group)
    const config = this.#config
    this.#renderer.toneMappingExposure = config.visuals.exposure
    this.#bloomPass.enabled = config.visuals.glow.enabled && !this.#debug && this.#qualityStep < 2
    this.#bloomPass.strength = config.visuals.glow.strength
    this.#bloomPass.radius = config.visuals.glow.radius
    this.#bloomPass.threshold = config.visuals.glow.threshold
    const positions = createOrchestraPositions(config)
    this.#pointerPlane.constant = -config.conductorOrigin[2]
    if (config.sectionHoverRegions.enabled) {
      this.#sectionHoverNodes = positions
        .filter(node => node.visible !== false && node.sectionId !== 'conductor')
        .map(node => ({
          sectionId: node.sectionId,
          point: new THREE.Vector2(node.position[0], node.position[1]),
          radius: node.radius,
        }))
    }
    this.#instrumentHoverNodes = Object.entries(config.instrumentGroups).flatMap(([sectionId, groups]) =>
      groups.flatMap(group => positions
        .filter(node => node.visible !== false && group.nodeIds.includes(node.id))
        .map(node => ({
          id: node.id,
          sectionId: sectionId as OrchestraSectionId,
          instrument: group.instrument,
          point: new THREE.Vector2(node.position[0], node.position[1]),
          radius: node.radius,
        }))),
    )
    this.#positions = positions
    this.#navigationFocus = new Map(positions.map(node => [node.id, this.#navigationFocus.get(node.id) ?? { value: 1 }]))
    if (config.visuals.floor.enabled) {
      this.#floor = createOrchestraFloor(config, positions)
      this.#floor.setVisible(!this.#experienceOverview)
      this.#group.add(this.#floor.group)
    }
    if (config.showNodeNumbers) {
      // Number in stable polar-grid order, independent of camera position or preset scale.
      positions.forEach((node, index) => {
        if (node.visible === false) return
        const element = document.createElement('span')
        element.className = 'absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none text-[11px] leading-none font-semibold text-white tabular-nums [text-shadow:0_1px_2px_#000,0_0_3px_#000]'
        element.textContent = String(index + 1)
        element.dataset.nodeId = node.id
        element.setAttribute('aria-label', `Node ${index + 1}: ${node.sectionName}, ${node.id}`)
        this.#container.append(element)
        this.#labels.push({ element, position: new THREE.Vector3(...node.position) })
      })
    }
    const groups = [...new Set(positions.map((node) => node.sectionId))]
    for (const group of groups) {
      if (!config.showConductor && group === 'conductor') continue
      const nodes = positions.filter((node) => node.sectionId === group && node.visible !== false)
      if (nodes.length === 0) continue
      // The upright formation faces +Z. Thin cylinders keep visible edges
      // during camera tilt and retain a back face for reflections/inspection.
      const geometry = config.visuals.nodes.shape === 'disk'
        ? new THREE.CylinderGeometry(1, 1, Math.max(0.01, config.visuals.nodes.diskThickness), 64, 1)
          .rotateX(Math.PI / 2)
        : new THREE.SphereGeometry(1, 24, 16)
      const color = config.sections[group].color
      geometry.setAttribute('nodeSeed', new THREE.InstancedBufferAttribute(
        new Float32Array(nodes.map((node) => nodeSeed(node.id))), 1,
      ))
      const palette = this.#sectionPalette(nodes)
      if (config.visuals.nodes.ghost.enabled) {
        const ghosts = createNodeGhosts(nodes, config, palette)
        this.#ghosts.set(group, ghosts)
        this.#group.add(ghosts.mesh)
      }
      if (config.visuals.nodes.audioHighlight.enabled) {
        const audioHighlight = createAudioHighlight(nodes, config, geometry)
        this.#audioHighlights.set(group, audioHighlight)
        this.#group.add(audioHighlight.mesh)
      }
      geometry.setAttribute('nodeFocus', new THREE.InstancedBufferAttribute(
        new Float32Array(nodes.length).fill(1), 1,
      ))
      geometry.setAttribute('nodePalette', new THREE.InstancedBufferAttribute(
        new Float32Array(palette.flatMap(color => color.toArray())), 3,
      ))
      geometry.setAttribute('nodeIdle', new THREE.InstancedBufferAttribute(
        new Float32Array(nodes.length).fill(1), 1,
      ))
      const appearance = createNodeMaterial('#ffffff', config.visuals, group !== 'conductor')
      appearance.setState(this.#state[group])
      this.#floor?.setSectionState(group, this.#state[group])
      this.#sectionMaterials.set(group, appearance)
      appearance.setTime(this.#materialTime)
      const material = appearance.material
      const mesh = new THREE.InstancedMesh(geometry, material, nodes.length)
      nodes.forEach((node, index) => {
        mesh.setMatrixAt(index, new THREE.Matrix4()
          .makeScale(node.radius, node.radius, node.radius)
          .setPosition(...node.position))
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.userData.sectionId = group
      mesh.userData.nodeIds = nodes.map(node => node.id)
      this.#paletteGroups.push({
        nodes, geometry, colors: palette, mesh, idleAmount: 0, idleWeights: nodes.map(() => 0),
      })
      this.#pickable.push(mesh)
      this.#group.add(mesh)
      if (this.#debug) {
        const bounds = new THREE.Box3()
        nodes.forEach((node) => {
          const center = new THREE.Vector3(...node.position)
          bounds.expandByPoint(center.clone().addScalar(node.radius))
          bounds.expandByPoint(center.clone().addScalar(-node.radius))
        })
        this.#group.add(new THREE.Box3Helper(bounds, new THREE.Color(color)))
        const element = document.createElement('span')
        element.className = 'absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none whitespace-nowrap text-[clamp(8px,1.1vw,12px)] tracking-[0.16em] text-[#c5c6c9] uppercase'
        element.textContent = nodes[0].sectionName
        this.#container.append(element)
        const position = bounds.getCenter(new THREE.Vector3())
        position.y = bounds.max.y + 0.35
        this.#labels.push({ element, position })
      }
    }
    if (this.#debug) {
      if (config.polarGrid.showGuides) {
        const grid = config.polarGrid
        const outer = grid.innerRadius + (grid.ringCount - 1) * grid.radialSpacing
        const material = new THREE.LineBasicMaterial({ color: '#84909c', transparent: true, opacity: 0.35, depthWrite: false })
        for (let spoke = 0; spoke < grid.spokeCount; spoke++) {
          const angle = THREE.MathUtils.degToRad(grid.fanStartAngle
            + (grid.fanEndAngle - grid.fanStartAngle) * spoke / (grid.spokeCount - 1))
          const points = [new THREE.Vector3(...config.conductorOrigin), new THREE.Vector3(...ringPoint(config, outer, angle))]
          this.#group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material))
        }
        for (let ring = 0; ring < grid.ringCount; ring++) {
          const radius = grid.innerRadius + ring * grid.radialSpacing
          const points = Array.from({ length: 129 }, (_, index) => new THREE.Vector3(...ringPoint(
            config, radius, THREE.MathUtils.degToRad(grid.fanStartAngle + (grid.fanEndAngle - grid.fanStartAngle) * index / 128),
          )))
          this.#group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material))
        }
      }
      const grid = new THREE.GridHelper(36, 36, 0x565b54, 0x24282a)
      const axes = new THREE.AxesHelper(2)
      grid.position.set(...config.conductorOrigin)
      axes.position.set(...config.conductorOrigin)
      const origin = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 8),
        new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      )
      origin.position.set(...config.conductorOrigin)
      this.#group.add(grid, axes, origin)
    }
    this.#updateNodeSemanticStates()
    const bounds = new THREE.Box3().setFromPoints(positions.map((node) => new THREE.Vector3(...node.position)))
    const target = new THREE.Vector3(
      config.conductorOrigin[0],
      (bounds.max.y + config.conductorOrigin[1]) / 2,
      config.conductorOrigin[2],
    ).add(new THREE.Vector3(...config.camera.target))
    this.#camera.fov = config.camera.fov
    this.#camera.near = 0.1
    this.#camera.far = 200
    this.#camera.position.copy(target).add(new THREE.Vector3(...config.camera.position))
    this.#camera.up.set(0, 1, 0)
    this.#camera.lookAt(target)
    if (this.#debug) {
      this.#controls = new OrbitControls(this.#camera, this.#renderer.domElement)
      this.#controls.target.copy(target)
      this.#controls.enableDamping = false
      this.#controls.addEventListener('change', () => {
        this.#labelLayoutDirty = true
        this.#render()
      })
      this.#controls.update()
    }
    this.#applyGhostActivity()
    this.#scheduleFrame()
  }

  // Pixel ratio / MSAA samples / FXAA-enabled, kept separate from #resize()
  // so #applyAdaptiveQuality() can reapply quality alone — #resize() also
  // calls #motion.finish() and repositions the camera, which would snap an
  // in-progress navigation-travel animation if run mid-zoom purely to react
  // to a quality step-down.
  #applyRenderQuality(width: number, height: number) {
    const quality = this.#config.visuals.performance
    // Canvas antialiasing does not cover EffectComposer's offscreen targets.
    // Intersect color/depth support instead of assuming MAX_SAMPLES applies to HDR.
    if (!this.#multisampleCounts) {
      const gl = this.#renderer.getContext() as WebGL2RenderingContext
      const colorSamples = Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES) as Int32Array)
      const depthSamples = Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, gl.SAMPLES) as Int32Array)
      this.#multisampleCounts = colorSamples.filter(n => n > 1 && depthSamples.includes(n))
    }
    const samples = quality.antialias && this.#qualityStep < 2 && !this.#contextualQuality
      ? Math.max(0, ...this.#multisampleCounts.filter(n => n <= quality.antialiasSamples)) : 0
    for (const target of [this.#composer.renderTarget1, this.#composer.renderTarget2]) {
      if (target.samples !== samples) {
        target.dispose()
        target.samples = samples
      }
    }
    const maxPixelRatio = this.#qualityStep < 2 ? quality.maxPixelRatio : Math.min(1, quality.maxPixelRatio)
    const activeRatio = Math.min(window.devicePixelRatio, Math.max(0.5, maxPixelRatio),
      Math.sqrt(Math.max(1, quality.maxRenderPixels) / (width * height)))
    const ratio = this.#contextualQuality ? Math.min(0.5, activeRatio) : activeRatio
    this.#renderer.setPixelRatio(ratio)
    this.#composer.setPixelRatio(ratio)
    this.#renderer.setSize(width, height, false)
    this.#composer.setSize(width, height)
    // EffectComposer.setSize() above just reset bloomPass back to its full
    // working resolution (it propagates to every pass that implements
    // setSize) — override it at step 1 to shrink bloom's own downsample/blur
    // chain. Its composite step already upsamples back onto the full-size
    // scene regardless of this resolution (that's how the mip chain always
    // works), so this only costs blur quality, not presence.
    if (this.#qualityStep === 1) {
      this.#bloomPass.setSize(
        Math.max(1, Math.round(width * ADAPTIVE_BLOOM_RESOLUTION_SCALE)),
        Math.max(1, Math.round(height * ADAPTIVE_BLOOM_RESOLUTION_SCALE)),
      )
    }
    // Never force this off at qualityStep 2: it's the composer's last pass,
    // and EffectComposer assigns "render to screen" by array position, not by
    // which pass is actually enabled — disabling the last pass outright left
    // nothing rendering to the canvas at all. Dropping MSAA (samples above)
    // already saves the more expensive resource; FXAA staying on as the
    // fallback AA here is cheap and keeps the pass chain valid.
    this.#antialiasPass.enabled = quality.antialias && samples === 0
    this.#antialiasPass.uniforms.resolution.value.set(
      1 / this.#composer.readBuffer.width, 1 / this.#composer.readBuffer.height,
    )
  }

  #resize = () => {
    const width = this.#container.clientWidth
    const height = this.#container.clientHeight
    if (!width || !height) return
    this.#labelLayoutDirty = true
    this.#motion.finish()
    this.#experienceCameraTimeline?.kill()
    this.#floor?.setVisible(!this.#experienceOverview)
    this.#applyRenderQuality(width, height)
    this.#camera.aspect = width / height
    this.#camera.fov = this.#config.camera.fov
    this.#camera.clearViewOffset()
    this.#camera.updateProjectionMatrix()
    this.#updateCameraFocus()
    const presentationFocus = this.#experienceOverview
      ? contextualOverviewFocus(
        this.#positions,
        this.#camera.aspect,
        this.#camera.fov,
        width,
        height,
        this.#config.camera.desktopOccupancy,
      )
      : { position: this.#cameraDestination, center: this.#centerDestination }
    this.#camera.position.copy(presentationFocus.position)
    this.#cameraCenter.copy(presentationFocus.center)
    this.#camera.lookAt(this.#cameraCenter)
    this.#renderScene(true)
  }

  // Per-instance metadata exposes focus and the zoom-derived mix without
  // treating luminosity as the audio source of truth.
  #updateNodeSemanticStates() {
    const highlighted = highlightedInstrumentIds(this.#navigation)
    for (const mesh of this.#pickable) {
      mesh.userData.nodeStates = (mesh.userData.nodeIds as string[]).map(id => {
        const node = this.#positions.find(position => position.id === id)!
        const family = sectionFamily(node.sectionId)
        return {
          nodeId: id, instrumentId: node.instrument,
          focused: this.#navigation.level !== 'orchestra' && family === this.#navigation.familyId
            && (this.#navigation.level !== 'instrument' || node.instrument === this.#navigation.instrumentId),
          selectedForListening: !!node.instrument && highlighted.includes(node.instrument),
          familySelection: family ? familySelection(family, highlighted) : 'none',
        }
      })
    }
  }

  bindMotionUI(ui: MotionUI) {
    this.#annotationUI = ui
    this.#motion.bind({ ...ui, settled: () => {
      this.#labelLayoutDirty = true
      this.#scheduleFrame()
      ui.settled()
    } })
    this.#annotationResize?.disconnect()
    this.#annotationMutation?.disconnect()
    this.#annotationResize = new ResizeObserver(() => {
      if (!this.#experienceOverview && !this.#experienceCameraTimeline?.isActive() && !ui.identity.dataset.traveling) {
        this.#updateCameraFocus()
        this.#camera.position.copy(this.#cameraDestination)
        this.#cameraCenter.copy(this.#centerDestination)
        this.#camera.lookAt(this.#cameraCenter)
      }
      this.#labelLayoutDirty = true
      this.#scheduleFrame()
    })
    this.#annotationResize.observe(ui.identity.querySelector('.map-identity-content') ?? ui.identity)
    if (ui.actions.parentElement) this.#annotationResize.observe(ui.actions.parentElement)
    // Ignore GSAP/style changes; observe semantic label content only so
    // reduced motion still relayouts when captions change.
    this.#annotationMutation = new MutationObserver(() => {
      this.#labelLayoutDirty = true
      this.#scheduleFrame()
    })
    this.#annotationMutation.observe(ui.labels, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['data-label-corner'],
    })
  }

  // Pulled in every frame from the audio engine (see OrchestraMap.tsx's
  // bridging effect); read by #animateFrame to drive the audio-highlight rims.
  setAudibleActivity(activity: ReadonlyMap<OrchestraInstrument, number>) {
    if (!this.#active) return
    this.#audibleActivity = activity
  }

  #sectionPalette(nodes: OrchestraPosition[], seconds = 0, idleAmount = 0) {
    const colors = sectionNodeColors(nodes, this.#config, seconds, idleAmount)
    if (nodes[0]?.sectionId === 'conductor') {
      colors[0] = conductorColor.clone()
    }
    return colors
  }

  setIdleHighlightFamily(family: FamilyId | null) {
    if (this.#idleHighlightFamily === family) return
    this.#idleHighlightFamily = family
    this.#scheduleFrame()
  }

  setIdleHighlightInstrument(instrument: OrchestraInstrument | null) {
    if (this.#idleHighlightInstrument === instrument) return
    this.#idleHighlightInstrument = instrument
    this.#scheduleFrame()
  }

  // The contextual map is a static navigation aid. Keep one lower-resolution
  // frame in GPU memory, then stop its animation and interaction work until
  // the full map becomes active again.
  setActive(active: boolean) {
    if (active === this.#active) return
    this.#active = active
    this.#contextualQuality = !active
    this.#pointerDirty = false
    this.#lastFrameTime = null
    if (this.#animationFrame !== null) cancelAnimationFrame(this.#animationFrame)
    this.#animationFrame = null
    if (!active) {
      this.#mapHoveredInstrument = undefined
      this.#mapHoveredSection = null
      this.#hoveredSections.clear()
      this.#hoveredInstrument = undefined
      this.#renderer.domElement.style.cursor = ''
      this.#onHoveredSectionsChange?.([])
    }
    this.#resize()
  }

  refreshAnnotationLayout() {
    this.#labelLayoutDirty = true
    this.#scheduleFrame()
  }

  overviewBounds() {
    return projectedNodeBounds(this.#positions, { level: 'orchestra' }, {
      width: this.#container.clientWidth,
      height: this.#container.clientHeight,
    }, this.#camera.fov, this.#config.camera.desktopOccupancy)
  }

  // Explore mode is a visual overview only. The semantic navigation and its
  // instrument highlighting stay untouched while the full formation is framed.
  setExperienceOverview(active: boolean) {
    this.#experienceOverview = active
    if (active) this.#floor?.setVisible(false)
    this.#motion.finish()
    this.#experienceCameraTimeline?.kill()
    const focus = active
      ? contextualOverviewFocus(
        this.#positions,
        this.#camera.aspect,
        this.#camera.fov,
        this.#container.clientWidth,
        this.#container.clientHeight,
        this.#config.camera.desktopOccupancy,
      )
      : this.#navigationCameraFocus()
    const settle = () => {
      this.#camera.position.copy(focus.position)
      this.#cameraCenter.copy(focus.center)
      this.#camera.lookAt(this.#cameraCenter)
      if (!active) this.#floor?.setVisible(true)
      // The caption and figure are projected from this camera. Follow it
      // back from the wide exploration framing, or they stay where that
      // framing left them.
      this.#labelLayoutDirty = true
      this.#scheduleFrame()
    }
    const ghostVisibility = active ? 0 : 1
    if (this.#motionPreference.matches || this.#debug) {
      this.#ghostOverviewVisibility.value = ghostVisibility
      settle()
      return
    }
    this.#experienceCameraTimeline = gsap.timeline({
      onUpdate: () => {
        this.#camera.lookAt(this.#cameraCenter)
        this.#labelLayoutDirty = true
        this.#scheduleFrame()
      },
      onComplete: settle,
    })
      .to(this.#camera.position, { ...focus.position, duration: 0.76, ease: 'power2.inOut' }, 0.05)
      .to(this.#cameraCenter, { ...focus.center, duration: 0.76, ease: 'power2.inOut' }, 0.05)
      .to(this.#ghostOverviewVisibility, { value: ghostVisibility, duration: 0.76, ease: 'power2.inOut' }, 0.05)
  }

  setNavigation(state: NavigationState) {
    this.#entityLayouts = []
    const previous = this.#navigation
    const interaction = this.#config.visuals.interaction
    const familyEmphasis = (interaction.familyIntensity - interaction.neutralIntensity)
      / Math.max(0.001, interaction.highlightedIntensity - interaction.neutralIntensity)
    const values: MotionValue[] = []
    for (const id of Object.keys(this.#config.sections) as OrchestraSectionId[]) {
      const focused = state.level !== 'orchestra' && familySections(state.familyId).includes(id)
      values.push({ target: this.#targetState[id], values: { emphasis: state.level === 'orchestra' ? 0 : focused ? familyEmphasis : -1 }, focused })
    }
    for (const node of this.#positions) {
      const inFamily = state.level !== 'orchestra' && familySections(state.familyId).includes(node.sectionId)
      const focused = state.level === 'instrument' && inFamily && node.instrument === state.instrumentId
      // The selected instrument keeps the family view's glow (its peers dim
      // around it); brighter levels are left to hover alone (in #animateFrame).
      const intensity = state.level === 'instrument' && inFamily && !focused
        ? interaction.dimmedIntensity : interaction.familyIntensity
      values.push({ target: this.#navigationFocus.get(node.id)!, values: { value: intensity / Math.max(interaction.familyIntensity, 0.001) }, focused })
    }
    // Apply the selected highlight before hover is cleared so the family does
    // not fall back to neutral for the first beats of travel.
    for (const value of values) {
      if (value.focused) Object.assign(value.target, value.values)
    }
    this.#navigation = state
    this.#labelLayoutDirty = true
    this.#updateNodeSemanticStates()
    this.#mapHoveredInstrument = undefined
    this.#labelHoveredInstrument = undefined
    this.setHoveredSections([])
    this.#setMapHoveredSection(null)
    this.#updateCameraFocus()
    const reduced = this.#motionPreference.matches || this.#debug || !this.#initializedNavigation
    this.#labelNavigation = reduced ? state : previous
    this.#travelingTargetId = reduced ? undefined : travelingTargetId(previous, state)
    this.#labelsFollowTravel = !reduced
    const departingLabel = this.#travelingTargetId
      ? this.#annotationUI?.labels.querySelector<HTMLElement>(`[data-target="${this.#travelingTargetId}"]`) ?? undefined
      : undefined
    // React has already committed the new heading, but its projected box
    // would otherwise wait for the next animation frame and briefly render at
    // the stage origin. Place it at the camera's current pose before travel.
    this.#render()
    this.#motion.travel({
      from: previous, to: state,
      camera: this.#camera.position, center: this.#cameraCenter,
      destination: this.#cameraDestination.clone(), destinationCenter: this.#centerDestination.clone(),
      values, reduced,
      departingLabel,
      handoff: () => {
        this.#labelNavigation = state
        this.#ghostFocusNavigation = state
        this.#travelingTargetId = undefined
        this.#labelsFollowTravel = false
        this.#labelLayoutDirty = true
      },
      update: () => {
        this.#camera.lookAt(this.#cameraCenter)
        this.#scheduleFrame()
      },
    })
    if (reduced) this.#render()
    this.#initializedNavigation = true
    this.#scheduleFrame()
  }

  // A node present under both the live and the not-yet-arrived navigation is
  // the same group being zoomed into or out of, rather than one fading in or
  // out. For it, take the lower of the live and not-yet-arrived focus: a
  // level increase (approaching a stronger look) is held at the lower,
  // pre-travel value until arrival, while a level decrease (withdrawing to a
  // weaker look) is already the lower value live, so it eases down through
  // the travel instead of holding then dropping abruptly on arrival. A node
  // present under only one of the two is fading in or out and always reacts
  // to the live navigation immediately.
  #ghostFocusForNode(node: Pick<OrchestraPosition, 'sectionId' | 'instrument'>) {
    const liveFocus = ghostFocusFor(this.#navigation, node)
    if (ghostPresentFor(this.#ghostFocusNavigation, node) <= 0 || ghostPresentFor(this.#navigation, node) <= 0) return liveFocus
    return Math.min(liveFocus, ghostFocusFor(this.#ghostFocusNavigation, node))
  }

  #applyGhostActivity() {
    const interaction = this.#config.visuals.interaction
    for (const group of this.#paletteGroups) {
      const ghosts = this.#ghosts.get(group.nodes[0].sectionId)
      if (!ghosts) continue
      const emphasis = this.#state[group.nodes[0].sectionId].emphasis
      ghosts.setActivity(
        group.nodes.map(node => ghostLiveWeight(
          node, this.#navigationFocus.get(node.id)?.value ?? 1, emphasis, interaction,
        )),
        group.nodes.map(node => this.#ghostFocusForNode(node)),
      )
      ghosts.update(this.#materialTime, this.#motionPreference.matches ? 0 : this.#ghostOverviewVisibility.value)
    }
  }

  #captionFrame(state: NavigationState, element = this.#annotationUI?.identity) {
    if (state.level === 'orchestra' || !element) return undefined
    const content = element.querySelector<HTMLElement>('.map-identity-content')
    if (!content) return undefined
    const width = this.#container.clientWidth, height = this.#container.clientHeight
    const origin = this.#container.getBoundingClientRect()
    const header = element.closest('main')?.querySelector('.map-chrome--top')?.getBoundingClientRect()
    const footer = this.#annotationUI?.actions.parentElement?.getBoundingClientRect()
    const top = Math.max(0, (header?.bottom ?? origin.top) - origin.top) + 16
    const bottom = Math.min(height, (footer?.top ?? origin.bottom) - origin.top) - 16
    const safe = { x: 16, y: top, width: Math.max(1, width - 32), height: Math.max(1, bottom - top) }
    const orientation = this.#orientationQuery.matches ? 'portrait' : 'landscape'
    const config = identityCaptionPlacement(state, orientation)
    const outside = config.side === 'outside' && config.edge !== 'center'
    const horizontalEdge = config.edge === 'left' || config.edge === 'right'
    // Leave room for both text and lights even on very short/narrow stages.
    // Gap affects edge separation, never the text box dimensions.
    // Only the text stack scrolls in exceptional cases; artwork stays free.
    const maxWidth = outside && horizontalEdge ? Math.max(1, safe.width / 2) : safe.width
    const maxHeight = outside && !horizontalEdge ? Math.max(1, safe.height / 2) : safe.height
    content.style.setProperty('--caption-max-width', `${maxWidth}px`)
    content.style.setProperty('--caption-max-height', `${maxHeight}px`)
    return { ...config, gap: resolveCaptionGap(config.edge, config.gap, { width, height }), safe, size: { width: content.offsetWidth, height: content.offsetHeight } }
  }

  #navigationCameraFocus() {
    const width = this.#container.clientWidth, height = this.#container.clientHeight
    const base = cameraFocus(this.#positions, this.#navigation, this.#camera.aspect, this.#camera.fov,
      width, height, this.#config.camera.desktopOccupancy)
    return frameOutsideCaption(this.#positions, this.#navigation, base, { width, height }, this.#camera.fov, this.#captionFrame(this.#navigation))
  }

  #updateCameraFocus() {
    const focus = this.#navigationCameraFocus()
    this.#cameraDestination.copy(focus.position)
    this.#centerDestination.copy(focus.center)
  }

  #pickProjectedEntity(clientX: number, clientY: number) {
    if (this.#annotationUI?.labels.inert) return undefined
    const rect = this.#container.getBoundingClientRect()
    const point = { x: clientX - rect.left, y: clientY - rect.top }
    // pickEntity's broad group-box fallback intentionally covers the gap
    // between a family's own nodes (see entity-layout.mjs); at orchestra
    // depth that's dead space the mouse can sit in (e.g. above the
    // conductor) while still registering as a family hover/click, which is
    // exactly the over-eager highlighting this was asked to stop doing — so
    // every depth now follows the lights/label only, like family depth
    // already did.
    const id = pickEntityNearMarks(this.#entityLayouts, point)
    return mapLabels(this.#config, this.#navigation).find(target => target.id === id)
  }

  setNavigationBlocked(blocked: boolean) {
    this.#navigationBlocked = blocked
  }

  #handlePointerDown = (event: PointerEvent) => {
    if (!this.#active) return
    this.#pointerOrigin.set(event.clientX, event.clientY)
    this.#pointerDragged = false
    this.#pointerStartedOnCanvas = event.target instanceof HTMLCanvasElement
  }

  #handleClick = (event: MouseEvent) => {
    if (!this.#active || this.#navigationBlocked || this.#pointerDragged || this.#pointerOrigin.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 8) return
    if (!acceptCanvasNavigation({
      debug: this.#debug,
      defaultPrevented: event.defaultPrevented,
      targetIsCanvas: event.target instanceof HTMLCanvasElement,
      traveling: Boolean(this.#annotationUI?.labels.inert),
      pointerStartedOnCanvas: this.#pointerStartedOnCanvas,
    })) return
    const inside = this.#preparePointerRay(event.clientX, event.clientY)
    const target = inside ? this.#mapClickTarget(event.clientX, event.clientY) : undefined
    // At instrument depth the selected instrument's own lights are its way
    // in; a click between them, inside its region, still just keeps it
    // selected (clickDestination).
    if (inside && this.#selectionAction && this.#selectedInstrumentNodeHit()) {
      this.#selectionAction()
      return
    }
    const destination = clickDestination(this.#navigation, target)
    if (destination) this.#onNavigate?.(destination)
  }

  #mapClickTarget(clientX: number, clientY: number): NavigationState | undefined {
    if (this.#navigation.level === 'instrument') {
      return this.#selectedClusterContains() ? this.#navigation : undefined
    }
    return this.#pickProjectedEntity(clientX, clientY)?.state
      ?? this.#activeMapTarget()
      ?? (this.#navigation.level === 'family' && this.#selectedClusterContains() ? this.#navigation : undefined)
  }

  // Whether the pointer ray is on one of the selected instrument's own
  // lights — not merely inside its region. Instrument depth's hover and
  // click target.
  #selectedInstrumentNodeHit() {
    if (this.#navigation.level !== 'instrument') return false
    const hit = this.#pickNodeFromRay()
    return !!hit && this.#positions.find(node => node.id === hit.nodeId)?.instrument === this.#navigation.instrumentId
  }

  #selectedClusterContains() {
    if (this.#navigation.level === 'orchestra') return false
    const sections = familySections(this.#navigation.familyId)
    const hit = this.#pickNodeFromRay()
    // A visible light outside the selection always counts as a click away.
    if (hit && !sections.includes(hit.sectionId)) return false
    if (this.#navigation.level === 'instrument') {
      if (hit && this.#positions.find(node => node.id === hit.nodeId)?.instrument !== this.#navigation.instrumentId) return false
      return this.#pickInstrumentRegion()?.instrument === this.#navigation.instrumentId
    }
    const point = this.#raycaster.ray.intersectPlane(this.#pointerPlane, this.#pointerWorld)
    if (!point) return false
    this.#pointerPoint.set(point.x, point.y)
    // Families can have separated lobes (notably Strings around Woodwinds);
    // nearest-real-node naturally handles that without needing one
    // enclosing hull per lobe.
    const section = this.#sectionRegionAt(this.#pointerPoint)
    return !!section && sections.includes(section)
  }

  #activeMapTarget(): NavigationState | undefined {
    if (this.#navigation.level === 'orchestra') {
      const section = this.#pickNodeFromRay()?.sectionId ?? this.#pickSectionRegion()
      const family = section ? sectionFamily(section) : undefined
      return family ? { level: 'family', familyId: family } : undefined
    }
    if (this.#navigation.level !== 'family') return undefined
    const group = this.#pickInstrumentRegion()
    return group
      ? { level: 'instrument', familyId: this.#navigation.familyId, instrumentId: group.instrument }
      : undefined
  }

  #handlePointerMove = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - this.#pointerOrigin.x, event.clientY - this.#pointerOrigin.y) > 8) this.#pointerDragged = true
    if (!this.#active || event.pointerType !== 'mouse') return
    this.#pointerClient.set(event.clientX, event.clientY)
    this.#pointerDirty = true
    this.#scheduleFrame()
  }

  #updatePointerHover() {
    const inside = this.#resolvePointerHover()
    // Decided last: the hover bookkeeping above clears the cursor at this
    // depth. Same hit test as the click (#selectedInstrumentNodeHit).
    if (this.#navigation.level === 'instrument') {
      this.#renderer.domElement.style.cursor = inside && this.#selectionAction && this.#selectedInstrumentNodeHit() ? 'pointer' : ''
    }
  }

  // Returns whether the pointer is over the canvas.
  #resolvePointerHover() {
    this.#pointerDirty = false
    if (!this.#preparePointerRay(this.#pointerClient.x, this.#pointerClient.y)) {
      this.#mapHoveredInstrument = undefined
      this.#setMapHoveredSection(null)
      return false
    }
    const destination = this.#pickProjectedEntity(this.#pointerClient.x, this.#pointerClient.y)
    if (destination) {
      this.#mapHoveredInstrument = destination.state.level === 'instrument' ? destination.state.instrumentId : undefined
      this.#setMapHoveredSection(destination.sectionIds[0])
      return true
    }
    const hit = this.#pickNodeFromRay()
    const instrument = this.#pickInstrumentRegion()
    // At instrument depth only a light of the selected instrument counts as
    // hovering it — then all of its lights brighten together (the boost in
    // #animateFrame applies per instrument); its region alone doesn't.
    this.#mapHoveredInstrument = this.#navigation.level === 'instrument'
      ? this.#selectedInstrumentNodeHit() ? this.#navigation.instrumentId : undefined
      : instrument?.instrument
    this.#setMapHoveredSection(this.#navigation.level === 'family'
      ? instrument?.sectionId ?? null : hit?.sectionId ?? this.#pickSectionRegion())
    return true
  }

  #pickInstrumentRegion() {
    if (this.#navigation.level === 'orchestra') return undefined
    const sections = familySections(this.#navigation.familyId)
    const candidates = this.#instrumentHoverNodes.filter(node => sections.includes(node.sectionId))
    // Exact node hits win; padding overlaps resolve to the nearest actual node.
    const hit = this.#pickNodeFromRay()
    if (hit) return candidates.find(node => node.id === hit.nodeId)
    const point = this.#raycaster.ray.intersectPlane(this.#pointerPlane, this.#pointerWorld)
    if (!point) return undefined
    this.#pointerPoint.set(point.x, point.y)
    const padding = this.#config.sectionHoverRegions.padding * this.#config.orchestraScale
    let best: typeof candidates[number] | undefined
    let bestDistance = Infinity
    for (const node of candidates) {
      const distance = node.point.distanceTo(this.#pointerPoint) - node.radius
      if (distance <= padding && distance < bestDistance) {
        bestDistance = distance
        best = node
      }
    }
    return best
  }

  // Nearest real node within `padding` of its own edge, or null — never a
  // hand-drawn polygon's interior, so empty space between sparse/non-convex
  // node clusters can't claim a section no node actually occupies.
  #sectionRegionAt(point: THREE.Vector2): OrchestraSectionId | null {
    const padding = this.#config.sectionHoverRegions.padding * this.#config.orchestraScale
    let bestSection: OrchestraSectionId | null = null
    let bestDistance = Infinity
    for (const node of this.#sectionHoverNodes) {
      const distance = node.point.distanceTo(point) - node.radius
      if (distance <= padding && distance < bestDistance) {
        bestDistance = distance
        bestSection = node.sectionId
      }
    }
    return bestSection
  }

  #pickSectionRegion(): OrchestraSectionId | null {
    if (!this.#sectionHoverNodes.length) return null
    const worldPoint = this.#raycaster.ray.intersectPlane(this.#pointerPlane, this.#pointerWorld)
    if (!worldPoint) return null
    this.#pointerPoint.set(worldPoint.x, worldPoint.y)
    return this.#sectionRegionAt(this.#pointerPoint)
  }

  #handlePointerLeave = () => {
    if (!this.#active) return
    this.#mapHoveredInstrument = undefined
    this.#scheduleFrame()
    this.#pointerDirty = false
    this.#setMapHoveredSection(null)
  }

  #handleMotionPreference = () => {
    if (this.#motionPreference.matches) this.#motion.finish()
    this.#scheduleFrame()
  }

  #canAnimateMaterial() {
    if (!this.#active || this.#motionPreference.matches || document.hidden) return false
    if (this.#config.visuals.nodes.ghost.enabled) return true
    if (this.#config.visuals.idleAnimation.enabled) return true
    return this.#config.visuals.nodes.idle.enabled && this.#paletteGroups.some(({ nodes }) => {
      const state = this.#state[nodes[0].sectionId]
      return (1 - Math.abs(state.emphasis)) * (1 - state.activity) > 0.001
    })
  }

  #mapIsEngaged() {
    return this.#hoveredSections.size > 0
      || !!this.#mapHoveredInstrument
      || !!this.#labelHoveredInstrument
      || this.#navigation.level !== 'orchestra'
  }

  #highlightActive() {
    return Object.values(this.#state).some(state => Math.abs(state.emphasis) > 0.02)
  }

  // Idle never shares the stage with hover or selection; it eases back after.
  #idleTargetWeight() {
    if (!this.#config.visuals.idleAnimation.enabled || this.#motionPreference.matches) return 0
    if (this.#mapIsEngaged() || this.#highlightActive()) return 0
    return 1
  }

  #handleVisibility = () => {
    if (this.#animationFrame !== null) cancelAnimationFrame(this.#animationFrame)
    this.#animationFrame = null
    this.#lastFrameTime = null
    if (!document.hidden) this.#scheduleFrame()
  }

  #scheduleFrame() {
    if (this.#active && !document.hidden && this.#animationFrame === null) this.#animationFrame = requestAnimationFrame(this.#animateFrame)
  }

  #animateFrame = (time: number) => {
    this.#animationFrame = null
    const interval = 1000 / Math.max(1, this.#config.visuals.performance.frameRate)
    if (this.#lastFrameTime !== null && time - this.#lastFrameTime < interval - 1) {
      this.#scheduleFrame()
      return
    }
    const delta = this.#lastFrameTime === null ? 0 : Math.min((time - this.#lastFrameTime) / 1000, 0.1)
    if (this.#lastFrameTime !== null) this.#trackAdaptiveQuality(time - this.#lastFrameTime, interval)
    this.#lastFrameTime = time
    if (this.#pointerDirty) this.#updatePointerHover()
    if (this.#canAnimateMaterial()) this.#materialTime += delta
    let stateChanging = false
    const duration = this.#config.visuals.interaction.transitionSeconds
    const pointerHover = this.#hoveredSections.size > 0
      || !!this.#mapHoveredInstrument
      || !!this.#labelHoveredInstrument
    const hoverResponse = this.#navigation.level === 'orchestra' || pointerHover
    // Hover response is instantaneous, never eased.
    const blend = hoverResponse || this.#motionPreference.matches || duration <= 0
      ? 1 : 1 - Math.exp(-delta * 2.2 / duration)
    const interaction = this.#config.visuals.interaction
    const intensityRange = interaction.highlightedIntensity - interaction.neutralIntensity
    const hoverEmphasis = intensityRange > 0
      ? THREE.MathUtils.clamp((interaction.hoveredIntensity - interaction.neutralIntensity) / intensityRange, 0, 1)
      : 0
    // At quality step 2, hoverEmphasis's normal (deliberately subtle) nudge
    // is too small for the scale-boost compensation below to read without
    // bloom's glow — push the hovered section itself much brighter/bigger
    // instead of dimming its surroundings.
    const orchestraHoverEmphasis = this.#qualityStep >= 2 ? Math.max(hoverEmphasis, ADAPTIVE_HOVER_EMPHASIS) : hoverEmphasis
    // Idle highlighting cycles through the current depth's items — all five
    // families in order at orchestra level, or the current family's
    // instruments at family level (see idleHighlightSequence/OrchestraMap.tsx)
    // — giving each the same highlighted-as-if-hovered boost real hover uses.
    const idleHighlightFamily = !this.#motionPreference.matches
      && this.#navigation.level === 'orchestra'
      && !pointerHover ? this.#idleHighlightFamily : null
    const idleHighlightInstrument = !this.#motionPreference.matches
      && this.#navigation.level === 'family'
      && !pointerHover ? this.#idleHighlightInstrument : null
    const sectionAppearanceChanged = new Map<OrchestraSectionId, boolean>()
    for (const [id, appearance] of this.#sectionMaterials) {
      const family = sectionFamily(id)
      let sectionChanged = false
      for (const key of ['opacity', 'emphasis', 'activity'] as const) {
        let target = this.#targetState[id][key]
        if (key === 'emphasis' && this.#navigation.level === 'orchestra') {
          const sectionHovered = !!family && [...this.#hoveredSections].some(hovered => sectionFamily(hovered) === family)
          const sectionIdleHighlighted = !!family && idleHighlightFamily === family
          if (sectionHovered || sectionIdleHighlighted) {
            target = Math.max(target, orchestraHoverEmphasis)
          }
        }
        // Navigation emphasis is already eased by the zoom timeline; extra blend
        // would make dimming trail the camera.
        const follow = key === 'emphasis' ? 1 : blend
        const value = THREE.MathUtils.lerp(this.#state[id][key], target, follow)
        const next = Math.abs(value - target) < 0.001 ? target : value
        sectionChanged ||= next !== this.#state[id][key]
        this.#state[id][key] = next
        stateChanging ||= this.#state[id][key] !== target
      }
      if (sectionChanged) {
        appearance.setState(this.#state[id])
        this.#floor?.setSectionState(id, this.#state[id])
      }
      sectionAppearanceChanged.set(id, sectionChanged)
    }
    const reducedMotion = this.#motionPreference.matches
    const legacyIdleEnabled = this.#config.visuals.nodes.idle.enabled && !reducedMotion
    const idleSettings = this.#config.visuals.idleAnimation
    const idleLive = idleSettings.enabled && !reducedMotion
    const idleAllowed = idleLive && !this.#mapIsEngaged() && !this.#highlightActive()
    for (const group of this.#paletteGroups) {
      const id = group.nodes[0].sectionId
      const state = this.#state[id]
      const amount = legacyIdleEnabled ? (1 - Math.abs(state.emphasis)) * (1 - state.activity) : 0
      const inFamily = this.#navigation.level !== 'orchestra' && familySections(this.#navigation.familyId).includes(id)
      const hoveredInstrument = this.#labelHoveredInstrument ?? this.#mapHoveredInstrument
      const idleTarget = idleAllowed ? this.#idleTargetWeight() : 0
      const focus = group.geometry.getAttribute('nodeFocus') as THREE.InstancedBufferAttribute
      const focusTargetFor = (node: OrchestraPosition) => {
        let target = this.#navigationFocus.get(node.id)?.value ?? 1
        // Hover lifts an instrument wherever it is a target: any instrument
        // of the family at family depth, and — one step brighter — the
        // selected one at instrument depth (its dimmed peers aren't clickable
        // there, so lighting them up would mislead).
        const selectedInstrument = this.#navigation.level === 'instrument' && node.instrument === this.#navigation.instrumentId
        if (inFamily && (this.#navigation.level === 'family' || selectedInstrument) && node.instrument
          && (node.instrument === hoveredInstrument || node.instrument === idleHighlightInstrument)) {
          const hovered = selectedInstrument ? interaction.selectedInstrumentHoveredIntensity : interaction.instrumentHoveredIntensity
          target = Math.max(target, hovered / Math.max(interaction.familyIntensity, 0.001))
        }
        return target
      }
      // Node appearance (color/focus/idle/scale) is a pure function of section
      // state, per-node navigation focus, and the idle system. None of
      // those change on most frames once a view settles (idle animation is
      // off by default), so a cheap comparison pass decides whether the
      // expensive recompute and GPU buffer re-upload below is actually needed.
      let appearanceDirty = (sectionAppearanceChanged.get(id) ?? true) || legacyIdleEnabled || idleAllowed
        || amount !== group.idleAmount
      if (!appearanceDirty) {
        for (let index = 0; index < group.nodes.length; index++) {
          if (group.idleWeights[index] !== idleTarget || focus.getX(index) !== focusTargetFor(group.nodes[index])) {
            appearanceDirty = true
            break
          }
        }
      }
      if (appearanceDirty) {
        group.colors = this.#sectionPalette(group.nodes, this.#materialTime, amount)
        group.idleAmount = amount
        const attribute = group.geometry.getAttribute('nodePalette') as THREE.InstancedBufferAttribute
        const idle = group.geometry.getAttribute('nodeIdle') as THREE.InstancedBufferAttribute
        const floorColors = group.colors.map((color, index) => {
          const node = group.nodes[index]
          const target = focusTargetFor(node)
          const previous = focus.getX(index)
          focus.setX(index, target)
          stateChanging ||= previous !== target
          const idleWeight = THREE.MathUtils.lerp(group.idleWeights[index], idleTarget, blend)
          group.idleWeights[index] = Math.abs(idleWeight - idleTarget) < 0.001 ? idleTarget : idleWeight
          stateChanging ||= group.idleWeights[index] !== idleTarget
          const appearance = idleAppearance(node, this.#materialTime, idleSettings, group.idleWeights[index])
          attribute.setXYZ(index, color.r, color.g, color.b)
          idle.setX(index, appearance.brightness)
          // Bloom is off at qualityStep 2 (see ADAPTIVE_* comment above), so
          // emphasis's usual brightness-only distinction (see
          // node-material.ts) needs a second, glow-independent cue here —
          // only ever grows a node, never shrinks a dimmed one.
          const emphasisBoost = this.#qualityStep >= 2
            ? 1 + Math.max(0, state.emphasis) * ADAPTIVE_EMPHASIS_SCALE_BOOST : 1
          const scale = node.radius * appearance.scale * emphasisBoost
          group.mesh.setMatrixAt(index, this.#nodeMatrix
            .makeScale(scale, scale, scale)
            .setPosition(...node.position))
          const reflection = 1 + (appearance.brightness - 1) * idleSettings.reflectionResponse
          return color.clone().multiplyScalar(reflection * focus.getX(index))
        })
        attribute.needsUpdate = true
        focus.needsUpdate = true
        idle.needsUpdate = true
        group.mesh.instanceMatrix.needsUpdate = true
        this.#floor?.setSectionColors(id, floorColors)
        this.#ghosts.get(id)?.setColors(group.colors)
      }
      if (legacyIdleEnabled) this.#sectionMaterials.get(id)?.setTime(this.#materialTime, amount)
      const ghosts = this.#ghosts.get(id)
      if (ghosts) {
        const lives = group.nodes.map(node => ghostLiveWeight(
          node, this.#navigationFocus.get(node.id)?.value ?? 1, state.emphasis, interaction,
        ))
        const focuses = group.nodes.map(node => this.#ghostFocusForNode(node))
        // setActivity must run every frame regardless of stateChanging so far —
        // `||=` would short-circuit and skip it once any earlier group changed.
        const ghostsChanged = ghosts.setActivity(lives, focuses, blend)
        stateChanging ||= ghostsChanged
        ghosts.update(this.#materialTime, reducedMotion ? 0 : state.opacity * this.#ghostOverviewVisibility.value)
      }
      const audioHighlight = this.#audioHighlights.get(id)
      if (audioHighlight) {
        const focused = highlightedInstrumentIds(this.#navigation)
        const targets = group.nodes.map(node => {
          if (!node.instrument) return 0
          if (focused.length && !focused.includes(node.instrument)) return 0
          return this.#audibleActivity.get(node.instrument) ?? 0
        })
        // Orchestra keeps every sounding ring. Family and instrument views
        // keep rings only on the focused group.
        const audioChanged = audioHighlight.setActivity(targets, delta, reducedMotion)
        stateChanging ||= audioChanged
        audioHighlight.update(reducedMotion ? 0 : 1)
      }
    }
    this.#render()

    if (stateChanging || this.#pointerDirty || this.#canAnimateMaterial()) this.#scheduleFrame()
    else this.#lastFrameTime = null
  }

  // Ignores the warm-up frames (shader compile is a one-time, not sustained,
  // cost), then averages over a window before deciding — a single slow frame
  // (GC pause, tab switch) must not trigger a permanent quality drop.
  #trackAdaptiveQuality(observedMs: number, targetMs: number) {
    if (this.#qualityStep >= ADAPTIVE_MAX_STEP) return
    this.#adaptiveFrameCount += 1
    if (this.#adaptiveFrameCount <= ADAPTIVE_WARMUP_FRAMES) return
    this.#adaptiveFrameMs += observedMs
    const windowFrames = this.#adaptiveFrameCount - ADAPTIVE_WARMUP_FRAMES
    if (windowFrames < ADAPTIVE_WINDOW_FRAMES) return
    const averageMs = this.#adaptiveFrameMs / windowFrames
    this.#adaptiveFrameMs = 0
    this.#adaptiveFrameCount = ADAPTIVE_WARMUP_FRAMES
    if (averageMs <= targetMs * ADAPTIVE_SLOW_FACTOR) return
    this.#qualityStep = (this.#qualityStep + 1) as 0 | 1 | 2
    console.info(
      `[orchestra-map] sustained frame time ${averageMs.toFixed(1)}ms vs ${targetMs.toFixed(1)}ms target — `
      + `reducing render quality to step ${this.#qualityStep}`,
    )
    this.#applyAdaptiveQuality()
    this.#onQualityStep?.(this.#qualityStep)
  }

  #applyAdaptiveQuality() {
    // Step 1 keeps bloom on at a lower internal resolution (see
    // #applyRenderQuality); only step 2 drops it, with hover/emphasis
    // compensating via scale/intensity instead (see ADAPTIVE_* comment
    // above). Disabling it here at step 1 already left highlights with
    // neither bloom nor that compensation.
    if (this.#qualityStep >= 2) this.#bloomPass.enabled = false
    const width = this.#container.clientWidth
    const height = this.#container.clientHeight
    if (width && height) this.#applyRenderQuality(width, height)
  }

  #render = () => this.#renderScene(false)

  #renderScene(force: boolean) {
    if (document.hidden || (!force && !this.#active)) return
    this.#composer.render(0)
    // Label positions only depend on the camera and the visible label set,
    // both of which only change during navigation/travel, on resize, or on
    // annotation content changes (all of which set #labelLayoutDirty) — skip
    // this on frames that only exist for idle material animation, since it
    // otherwise reprojects every node and forces a synchronous DOM reflow
    // (getBoundingClientRect below) on every single rendered frame.
    const needsLabelLayout = this.#labelsFollowTravel || this.#pointerDirty || this.#labelLayoutDirty
    if (!needsLabelLayout) return
    const width = this.#container.clientWidth
    const height = this.#container.clientHeight
    this.#camera.updateMatrixWorld()
    const outgoing = mapLabels(this.#config, this.#labelNavigation)
      .filter(target => !this.#travelingTargetId || target.id === this.#travelingTargetId)
    const incoming = this.#labelsFollowTravel
      ? mapLabels(this.#config, this.#navigation).filter(target => !outgoing.some(other => other.id === target.id))
      : []
    const targets = [...outgoing, ...incoming]
    const project = (x: number, y: number, z: number) => {
      const point = this.#projectScratch.set(x, y, z).project(this.#camera)
      return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 }
    }
    const projectNode = (node: OrchestraPosition) => {
      const center = project(...node.position)
      const edgeX = project(node.position[0] + node.radius, node.position[1], node.position[2])
      const edgeY = project(node.position[0], node.position[1] + node.radius, node.position[2])
      const rx = Math.max(2, Math.abs(edgeX.x - center.x)), ry = Math.max(2, Math.abs(edgeY.y - center.y))
      return { x: center.x - rx, y: center.y - ry, width: rx * 2, height: ry * 2 }
    }
    // Every caption uses the same edge/alignment resolver against projected
    // node circles, following the current camera throughout travel.
    const identity = this.#annotationUI?.identity
    const outgoingIdentity = identity?.parentElement?.querySelector<HTMLElement>('.map-context--outgoing')
    const orientation = this.#orientationQuery.matches ? 'portrait' : 'landscape'
    const origin = this.#container.getBoundingClientRect()
    const header = this.#annotationUI?.identity.closest('main')?.querySelector('.map-chrome--top')?.getBoundingClientRect()
    const footer = this.#annotationUI?.actions.parentElement?.getBoundingClientRect()
    const safeTop = Math.max(0, Math.min(height, (header?.bottom ?? origin.top) - origin.top))
    const safeBottom = Math.max(safeTop, Math.min(height, (footer?.top ?? origin.bottom) - origin.top))
    const positionIdentity = (element: HTMLElement | null | undefined, identityNavigation: NavigationState) => {
      if (!element) return
      const selected = this.#positions.filter(node => {
        if (node.visible === false || node.sectionId === 'grid' || node.id === 'conductor') return false
        if (identityNavigation.level === 'orchestra') return true
        if (!familySections(identityNavigation.familyId).includes(node.sectionId)) return false
        return identityNavigation.level === 'family' || node.instrument === identityNavigation.instrumentId
      })
      const content = element.querySelector<HTMLElement>('.map-identity-content')
      if (!selected.length || !content) return
      const bounds = union(selected.map(projectNode))
      const config = identityCaptionPlacement(identityNavigation, orientation)
      const frame = identityNavigation.level === 'orchestra'
        ? { ...config, gap: resolveCaptionGap(config.edge, config.gap, { width, height }), size: { width: content.offsetWidth, height: content.offsetHeight } }
        : this.#captionFrame(identityNavigation, element)!
      const position = placeCaption(bounds, frame.size, frame.edge, frame.align, frame.gap, frame.side)
      content.style.setProperty('--identity-anchor-left-px', `${position.x}px`)
      content.style.setProperty('--identity-anchor-top-px', `${position.y}px`)
    }
    positionIdentity(identity, this.#navigation)
    positionIdentity(outgoingIdentity, this.#labelNavigation)
    const conductor = this.#positions.find(node => node.id === 'conductor' && node.visible !== false)
    if (conductor) {
      const circle = projectNode(conductor)
      this.#onConductorPosition?.(circle.x + circle.width / 2, circle.y + circle.height / 2, circle.width)
    }
    const entities = targets.flatMap(target => {
      const state = target.state
      const nodes = this.#positions.filter(node => node.visible !== false && state.level !== 'orchestra'
        && familySections(state.familyId).includes(node.sectionId) && (state.level !== 'instrument' || node.instrument === state.instrumentId))
      if (!nodes.length) return []
      const label = this.#annotationUI?.labels.querySelector<HTMLElement>(`[data-target="${target.id}"]`)
      return [{
        id: target.id,
        corner: labelCornerFor(target.placementId, label?.dataset.labelCorner),
        labelSize: { width: label?.offsetWidth ?? 0, height: label?.offsetHeight ?? 0 },
        nodes: nodes.map(projectNode),
      }]
    })
    const viewport = { x: 0, y: safeTop, width, height: safeBottom - safeTop }
    const rootIds = new Set(targets.filter(target => target.state.level === 'family').map(target => target.id))
    const rootEntities = entities.filter(entity => rootIds.has(entity.id))
    const nestedEntities = entities.filter(entity => !rootIds.has(entity.id))
    const rootLayouts = rootEntities.length ? layoutOrchestraFamilyLabels(
      rootEntities,
      this.#positions.filter(node => node.visible !== false && node.id !== 'conductor').map(projectNode),
      viewport,
      { clamp: !this.#labelsFollowTravel },
    ) : []
    this.#entityLayouts = [
      ...rootLayouts,
      ...layoutEntities(nestedEntities, viewport),
    ]
    const overlay = this.#annotationUI?.labels.getBoundingClientRect()
    const dx = overlay ? origin.left - overlay.left : 0
    const dy = overlay ? origin.top - overlay.top : 0
    for (const entity of this.#entityLayouts) {
      this.#onLabelPosition?.(entity.id, entity.label.x + dx, entity.label.y + dy)
    }
    for (const label of this.#labels) {
      const point = this.#projectScratch.copy(label.position).project(this.#camera)
      label.element.style.left = `${(point.x + 1) * width / 2}px`
      label.element.style.top = `${(1 - point.y) * height / 2}px`
      label.element.style.visibility = point.z < -1 || point.z > 1 ? 'hidden' : 'visible'
    }
    this.#labelLayoutDirty = false
  }
}
