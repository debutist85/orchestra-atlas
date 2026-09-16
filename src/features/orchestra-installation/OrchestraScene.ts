import * as THREE from 'three'
import { labelCornerFor, layoutEntities, pickEntity, type EntityLayout, type Rect } from './entity-layout'
import { NavigationMotion, type MotionUI, type MotionValue } from './navigation-motion'
import { familySelection } from '../../store/catalog'
import { cameraFocus } from './camera-focus'
import { acceptCanvasNavigation, clickDestination, familySections, mapLabels, sectionFamily, travelingTargetId, type NavigationState } from './navigation'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js'

import type { OrchestraSceneConfig, OrchestraSectionId, OrchestraInstrument } from './config'
import { createOrchestraVisualState, type OrchestraVisualState, type SectionVisualState } from './visual-state'
import { createOrchestraPositions, ringPoint } from './seating'
import { createNodeMaterial, nodeSeed } from './node-material'
import { sectionNodeColors } from './section-palette'
import { currentGlints, idleAppearance } from './idle-animation'
import { ghostFocusFor, ghostLiveWeight, ghostPresentFor } from './ghost-idle'
import { createNodeGhosts } from './node-ghost'
import type { OrchestraPosition } from './seating'
import { createOrchestraFloor } from './floor'

type SectionHoverRegion = {
  sectionId: OrchestraSectionId
  points: THREE.Vector2[]
  padding: number
}

type PaletteGroup = {
  nodes: OrchestraPosition[]
  geometry: THREE.BufferGeometry
  colors: THREE.Color[]
  mesh: THREE.InstancedMesh
  idleAmount: number
  idleWeights: number[]
}

// Instrument node lists are seating order, not polygon boundary order.
function convexBoundary(points: THREE.Vector2[]) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  if (sorted.length < 3) return sorted
  const cross = (a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const half = (vertices: THREE.Vector2[]) => {
    const hull: THREE.Vector2[] = []
    for (const point of vertices) {
      while (hull.length > 1 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) hull.pop()
      hull.push(point)
    }
    return hull.slice(0, -1)
  }
  return [...half(sorted), ...half([...sorted].reverse())]
}

function distanceToSegment(point: THREE.Vector2, start: THREE.Vector2, end: THREE.Vector2) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return point.distanceTo(start)
  const t = THREE.MathUtils.clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1)
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t))
}

function regionContainsPoint(region: SectionHoverRegion, point: THREE.Vector2) {
  const { points, padding } = region
  if (points.length === 1) return point.distanceTo(points[0]) <= padding
  const edgeCount = points.length === 2 ? 1 : points.length
  for (let index = 0; index < edgeCount; index++) {
    if (distanceToSegment(point, points[index], points[(index + 1) % points.length]) <= padding) return true
  }
  if (points.length < 3) return false
  let inside = false
  for (let current = 0, previous = points.length - 1; current < points.length; previous = current++) {
    const a = points[current]
    const b = points[previous]
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export class OrchestraScene {
  readonly #container: HTMLElement
  readonly #scene = new THREE.Scene()
  readonly #camera = new THREE.PerspectiveCamera()
  readonly #renderer = new THREE.WebGLRenderer({ antialias: false })
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
  #annotationResize: ResizeObserver | undefined
  #annotationMutation: MutationObserver | undefined
  #annotationUI: MotionUI | undefined
  #entityLayouts: EntityLayout[] = []
  readonly #motion = new NavigationMotion()
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
  #cameraCenter = new THREE.Vector3()
  #cameraDestination = new THREE.Vector3()
  #centerDestination = new THREE.Vector3()
  #positions: OrchestraPosition[] = []
  #labels: { element: HTMLSpanElement; position: THREE.Vector3 }[] = []
  readonly #motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  #animationFrame: number | null = null
  #materialTime = 0
  #lastFrameTime: number | null = null
  readonly #pointerClient = new THREE.Vector2()
  readonly #pointerNdc = new THREE.Vector2()
  readonly #pointerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1))
  readonly #pointerWorld = new THREE.Vector3()
  readonly #pointerPoint = new THREE.Vector2()
  #pointerDirty = false
  #pointerStartedOnCanvas = false
  #floor: ReturnType<typeof createOrchestraFloor> | null = null
  #state: OrchestraVisualState
  #targetState: OrchestraVisualState
  #selectedInstrumentIds: readonly OrchestraInstrument[] = []
  #mapHoveredInstrument: OrchestraInstrument | undefined
  #labelHoveredInstrument: OrchestraInstrument | undefined
  #mapHoveredSection: OrchestraSectionId | null = null
  #navigationHoveredSections = new Set<OrchestraSectionId>()
  #hoveredSections = new Set<OrchestraSectionId>()
  #hoveredInstrument: OrchestraInstrument | undefined
  #sectionHoverRegions: SectionHoverRegion[] = []
  #instrumentHoverRegions: (SectionHoverRegion & { instrument: OrchestraInstrument; nodes: OrchestraPosition[] })[] = []
  #sectionMaterials = new Map<OrchestraSectionId, ReturnType<typeof createNodeMaterial>>()
  #pickable: THREE.InstancedMesh[] = []
  #paletteGroups: PaletteGroup[] = []
  #ghosts = new Map<OrchestraSectionId, ReturnType<typeof createNodeGhosts>>()
  #lastMapInteraction = 0
  #glintAmounts = new Map<string, number>()
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
  ) {
    this.#container = container
    this.#config = config
    this.#debug = debug
    this.#onHoveredSectionsChange = onHoveredSectionsChange
    this.#onNavigate = onNavigate
    this.#onLabelPosition = onLabelPosition
    this.#state = createOrchestraVisualState(config.sections)
    this.#targetState = createOrchestraVisualState(config.sections)
    this.#scene.background = new THREE.Color('#0c0e10')
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
    this.#noteMapInteraction()
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
    this.#glintAmounts.clear()
    this.#pointerDirty = false
    this.#sectionHoverRegions = []
    this.#ghosts.clear()
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
    this.#controls?.dispose()
    this.#controls = null
    this.#clear()
    this.#group = new THREE.Group()
    this.#scene.add(this.#group)
    const config = this.#config
    this.#renderer.toneMappingExposure = config.visuals.exposure
    this.#bloomPass.enabled = config.visuals.glow.enabled && !this.#debug
    this.#bloomPass.strength = config.visuals.glow.strength
    this.#bloomPass.radius = config.visuals.glow.radius
    this.#bloomPass.threshold = config.visuals.glow.threshold
    const positions = createOrchestraPositions(config)
    this.#pointerPlane.constant = -config.conductorOrigin[2]
    if (config.sectionHoverRegions.enabled) {
      const positionsById = new Map(positions.map(node => [node.id, node]))
      this.#sectionHoverRegions = config.sectionHoverRegions.regions.flatMap(region => {
        const points = region.boundaryNodeIds.flatMap(id => {
          const node = positionsById.get(id)
          return node ? [new THREE.Vector2(node.position[0], node.position[1])] : []
        })
        return points.length ? [{
          sectionId: region.sectionId,
          points,
          padding: (region.padding ?? config.sectionHoverRegions.padding) * config.orchestraScale,
        }] : []
      })
    }
    this.#instrumentHoverRegions = Object.entries(config.instrumentGroups).flatMap(([sectionId, groups]) =>
      groups.flatMap(group => {
        const nodes = positions.filter(node => node.visible !== false && group.nodeIds.includes(node.id))
        return nodes.length ? [{
          sectionId: sectionId as OrchestraSectionId, instrument: group.instrument, nodes,
          points: convexBoundary(nodes.map(node => new THREE.Vector2(node.position[0], node.position[1]))),
          padding: Math.max(config.sectionHoverRegions.padding * config.orchestraScale, ...nodes.map(node => node.radius)),
        }] : []
      }),
    )
    this.#positions = positions
    this.#navigationFocus = new Map(positions.map(node => [node.id, this.#navigationFocus.get(node.id) ?? { value: 1 }]))
    if (config.visuals.floor.enabled) {
      this.#floor = createOrchestraFloor(config, positions)
      this.#group.add(this.#floor.group)
    }
    if (config.showNodeNumbers) {
      // Number in stable polar-grid order, independent of camera position or preset scale.
      positions.forEach((node, index) => {
        if (node.visible === false) return
        const element = document.createElement('span')
        element.className = 'orchestra-node-number'
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
      const palette = sectionNodeColors(nodes, config)
      if (config.visuals.nodes.ghost.enabled) {
        const ghosts = createNodeGhosts(nodes, config, palette)
        this.#ghosts.set(group, ghosts)
        this.#group.add(ghosts.mesh)
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
      const appearance = createNodeMaterial('#ffffff', config.visuals)
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
        element.className = 'orchestra-section-label'
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
      this.#controls.addEventListener('change', this.#render)
      this.#controls.update()
    }
    this.#applyGhostActivity()
    this.#scheduleFrame()
  }

  #resize = () => {
    const width = this.#container.clientWidth
    const height = this.#container.clientHeight
    if (!width || !height) return
    this.#motion.finish()
    const quality = this.#config.visuals.performance
    // Canvas antialiasing does not cover EffectComposer's offscreen targets.
    // Intersect color/depth support instead of assuming MAX_SAMPLES applies to HDR.
    if (!this.#multisampleCounts) {
      const gl = this.#renderer.getContext() as WebGL2RenderingContext
      const colorSamples = Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES) as Int32Array)
      const depthSamples = Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, gl.SAMPLES) as Int32Array)
      this.#multisampleCounts = colorSamples.filter(n => n > 1 && depthSamples.includes(n))
    }
    const samples = quality.antialias ? Math.max(0, ...this.#multisampleCounts.filter(n => n <= quality.antialiasSamples)) : 0
    for (const target of [this.#composer.renderTarget1, this.#composer.renderTarget2]) {
      if (target.samples !== samples) {
        target.dispose()
        target.samples = samples
      }
    }
    const ratio = Math.min(window.devicePixelRatio, Math.max(0.5, quality.maxPixelRatio),
      Math.sqrt(Math.max(1, quality.maxRenderPixels) / (width * height)))
    this.#renderer.setPixelRatio(ratio)
    this.#composer.setPixelRatio(ratio)
    this.#renderer.setSize(width, height, false)
    this.#composer.setSize(width, height)
    this.#antialiasPass.enabled = quality.antialias && samples === 0
    this.#antialiasPass.uniforms.resolution.value.set(
      1 / this.#composer.readBuffer.width, 1 / this.#composer.readBuffer.height,
    )
    this.#camera.aspect = width / height
    this.#camera.fov = this.#config.camera.fov
    this.#camera.clearViewOffset()
    this.#camera.updateProjectionMatrix()
    this.#updateCameraFocus()
    this.#camera.position.copy(this.#cameraDestination)
    this.#cameraCenter.copy(this.#centerDestination)
    this.#camera.lookAt(this.#cameraCenter)
    this.#render()
  }

  setListeningSelection(ids: readonly OrchestraInstrument[]) {
    this.#selectedInstrumentIds = [...ids]
    this.#updateNodeSemanticStates()
  }

  // Per-instance metadata exposes overlapping focus and listening states without
  // repurposing navigation luminosity as an audio selection indicator.
  #updateNodeSemanticStates() {
    for (const mesh of this.#pickable) {
      mesh.userData.nodeStates = (mesh.userData.nodeIds as string[]).map(id => {
        const node = this.#positions.find(position => position.id === id)!
        const family = sectionFamily(node.sectionId)
        return {
          nodeId: id, instrumentId: node.instrument,
          focused: this.#navigation.level !== 'orchestra' && family === this.#navigation.familyId
            && (this.#navigation.level !== 'instrument' || node.instrument === this.#navigation.instrumentId),
          selectedForListening: !!node.instrument && this.#selectedInstrumentIds.includes(node.instrument),
          familySelection: family ? familySelection(family, this.#selectedInstrumentIds) : 'none',
        }
      })
    }
  }

  bindMotionUI(ui: MotionUI) {
    this.#annotationUI = ui
    this.#motion.bind(ui)
    this.#annotationResize?.disconnect()
    this.#annotationMutation?.disconnect()
    this.#annotationResize = new ResizeObserver(() => this.#scheduleFrame())
    this.#annotationResize.observe(ui.identity)
    if (ui.actions.parentElement) this.#annotationResize.observe(ui.actions.parentElement)
    // Ignore GSAP/style changes; observe semantic label content only. This also
    // reflows Added/Some added indicators when reduced motion leaves rendering idle.
    this.#annotationMutation = new MutationObserver(() => this.#scheduleFrame())
    this.#annotationMutation.observe(ui.labels, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['data-label-corner'],
    })
  }

  setNavigation(state: NavigationState) {
    this.#noteMapInteraction()
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
      const intensity = state.level === 'instrument' && inFamily
        ? focused ? interaction.highlightedIntensity : interaction.dimmedIntensity : interaction.familyIntensity
      values.push({ target: this.#navigationFocus.get(node.id)!, values: { value: intensity / Math.max(interaction.familyIntensity, 0.001) }, focused })
    }
    // Apply the selected highlight before hover is cleared so the family does
    // not fall back to neutral for the first beats of travel.
    for (const value of values) {
      if (value.focused) Object.assign(value.target, value.values)
    }
    this.#navigation = state
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
      },
      update: () => {
        this.#camera.lookAt(this.#cameraCenter)
        this.#scheduleFrame()
      },
    })
    this.#initializedNavigation = true
    this.#applyGhostActivity()
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
      ghosts.update(this.#materialTime, this.#motionPreference.matches ? 0 : 1)
    }
  }

  #updateCameraFocus() {
    const focus = cameraFocus(this.#positions, this.#navigation, this.#camera.aspect, this.#camera.fov)
    this.#cameraDestination.copy(focus.position)
    this.#centerDestination.copy(focus.center)
  }

  #pickProjectedEntity(clientX: number, clientY: number) {
    if (this.#annotationUI?.labels.inert) return undefined
    const rect = this.#container.getBoundingClientRect()
    const id = pickEntity(this.#entityLayouts, { x: clientX - rect.left, y: clientY - rect.top })
    return mapLabels(this.#config, this.#navigation).find(target => target.id === id)
  }

  #handlePointerDown = (event: PointerEvent) => {
    this.#pointerStartedOnCanvas = event.target instanceof HTMLCanvasElement
  }

  #handleClick = (event: MouseEvent) => {
    this.#noteMapInteraction()
    if (!acceptCanvasNavigation({
      debug: this.#debug,
      defaultPrevented: event.defaultPrevented,
      targetIsCanvas: event.target instanceof HTMLCanvasElement,
      traveling: Boolean(this.#annotationUI?.labels.inert),
      pointerStartedOnCanvas: this.#pointerStartedOnCanvas,
    })) return
    const inside = this.#preparePointerRay(event.clientX, event.clientY)
    const target = inside ? this.#pickProjectedEntity(event.clientX, event.clientY)?.state ?? this.#activeMapTarget() : undefined
    const destination = clickDestination(this.#navigation, target)
    if (destination) this.#onNavigate?.(destination)
  }

  #activeMapTarget(): NavigationState | undefined {
    if (this.#navigation.level === 'orchestra') {
      const section = this.#pickNodeFromRay()?.sectionId ?? this.#pickSectionRegion()
      const family = section ? sectionFamily(section) : undefined
      return family ? { level: 'family', familyId: family } : undefined
    }
    const group = this.#pickInstrumentRegion()
    if (!group) return undefined
    if (this.#navigation.level === 'family') {
      return { level: 'instrument', familyId: this.#navigation.familyId, instrumentId: group.instrument }
    }
    return group.instrument === this.#navigation.instrumentId ? this.#navigation : undefined
  }

  #handlePointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    this.#pointerClient.set(event.clientX, event.clientY)
    this.#pointerDirty = true
    this.#scheduleFrame()
  }

  #updatePointerHover() {
    this.#pointerDirty = false
    if (!this.#preparePointerRay(this.#pointerClient.x, this.#pointerClient.y)) {
      this.#mapHoveredInstrument = undefined
      this.#setMapHoveredSection(null)
      return
    }
    const destination = this.#pickProjectedEntity(this.#pointerClient.x, this.#pointerClient.y)
    if (destination) {
      this.#mapHoveredInstrument = destination.state.level === 'instrument' ? destination.state.instrumentId : undefined
      this.#setMapHoveredSection(destination.sectionIds[0])
      return
    }
    const hit = this.#pickNodeFromRay()
    const instrument = this.#pickInstrumentRegion()
    this.#mapHoveredInstrument = instrument?.instrument
    this.#setMapHoveredSection(this.#navigation.level === 'family'
      ? instrument?.sectionId ?? null : hit?.sectionId ?? this.#pickSectionRegion())
  }

  #pickInstrumentRegion() {
    if (this.#navigation.level === 'orchestra') return undefined
    const sections = familySections(this.#navigation.familyId)
    const candidates = this.#instrumentHoverRegions.filter(region => sections.includes(region.sectionId))
    // Exact node hits win; padding overlaps resolve to the nearest actual node.
    const hit = this.#pickNodeFromRay()
    if (hit) return candidates.find(region => region.nodes.some(node => node.id === hit.nodeId))
    const point = this.#raycaster.ray.intersectPlane(this.#pointerPlane, this.#pointerWorld)
    if (!point) return undefined
    this.#pointerPoint.set(point.x, point.y)
    const distance = (region: typeof candidates[number]) => Math.min(...region.nodes.map(node =>
      Math.hypot(node.position[0] - point.x, node.position[1] - point.y)))
    return candidates.filter(region => regionContainsPoint(region, this.#pointerPoint))
      .sort((a, b) => distance(a) - distance(b))[0]
  }

  #pickSectionRegion(): OrchestraSectionId | null {
    if (!this.#sectionHoverRegions.length) return null
    const worldPoint = this.#raycaster.ray.intersectPlane(this.#pointerPlane, this.#pointerWorld)
    if (!worldPoint) return null
    this.#pointerPoint.set(worldPoint.x, worldPoint.y)
    return this.#sectionHoverRegions.find(region => regionContainsPoint(region, this.#pointerPoint))?.sectionId ?? null
  }

  #handlePointerLeave = () => {
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
    if (this.#motionPreference.matches || document.hidden) return false
    if (this.#config.visuals.nodes.ghost.enabled) return true
    if (this.#config.visuals.idleAnimation.enabled) return true
    return this.#config.visuals.nodes.idle.enabled && this.#paletteGroups.some(({ nodes }) => {
      const state = this.#state[nodes[0].sectionId]
      return (1 - Math.abs(state.emphasis)) * (1 - state.activity) > 0.001
    })
  }

  #noteMapInteraction() {
    this.#lastMapInteraction = this.#materialTime
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
    if (!document.hidden && this.#animationFrame === null) this.#animationFrame = requestAnimationFrame(this.#animateFrame)
  }

  #animateFrame = (time: number) => {
    this.#animationFrame = null
    const interval = 1000 / Math.max(1, this.#config.visuals.performance.frameRate)
    if (this.#lastFrameTime !== null && time - this.#lastFrameTime < interval - 1) {
      this.#scheduleFrame()
      return
    }
    const delta = this.#lastFrameTime === null ? 0 : Math.min((time - this.#lastFrameTime) / 1000, 0.1)
    this.#lastFrameTime = time
    if (this.#pointerDirty) this.#updatePointerHover()
    if (this.#canAnimateMaterial()) this.#materialTime += delta
    let stateChanging = false
    const duration = this.#config.visuals.interaction.transitionSeconds
    const hoverDuration = this.#config.visuals.interaction.hoverTransitionSeconds
    const pointerHover = this.#hoveredSections.size > 0
      || !!this.#mapHoveredInstrument
      || !!this.#labelHoveredInstrument
    const hoverResponse = this.#navigation.level === 'orchestra' || pointerHover
    const blendDuration = hoverResponse ? hoverDuration : duration
    const blendRate = hoverResponse ? 10 : 2.2
    const blend = this.#motionPreference.matches || blendDuration <= 0 ? 1 : 1 - Math.exp(-delta * blendRate / blendDuration)
    const sectionAppearanceChanged = new Map<OrchestraSectionId, boolean>()
    for (const [id, appearance] of this.#sectionMaterials) {
      let sectionChanged = false
      for (const key of ['opacity', 'emphasis', 'activity'] as const) {
        let target = this.#targetState[id][key]
        if (key === 'emphasis' && this.#navigation.level === 'orchestra' && [...this.#hoveredSections].some(hovered => sectionFamily(hovered) && sectionFamily(hovered) === sectionFamily(id))) {
          const interaction = this.#config.visuals.interaction
          const intensityRange = interaction.highlightedIntensity - interaction.neutralIntensity
          const hoverEmphasis = intensityRange > 0
            ? (interaction.hoveredIntensity - interaction.neutralIntensity) / intensityRange
            : 0
          target = Math.max(target, THREE.MathUtils.clamp(hoverEmphasis, 0, 1))
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
    // Only allocate this (a flatMap over every node) when idle animation can
    // actually use it; idleAppearance()/currentGlints() never touch it otherwise.
    const idleSubjects = idleSettings.enabled ? this.#paletteGroups.flatMap(group => group.nodes) : []
    const idleClock = Math.max(0, this.#materialTime - this.#lastMapInteraction)
    const idleAllowed = idleLive && !this.#mapIsEngaged() && !this.#highlightActive()
    const targetGlints = idleAllowed ? currentGlints(idleClock, idleSettings, idleSubjects) : new Map<string, number>()
    const glintIds = new Set([...this.#glintAmounts.keys(), ...targetGlints.keys()])
    for (const nodeId of glintIds) {
      const target = targetGlints.get(nodeId) ?? 0
      const value = THREE.MathUtils.lerp(this.#glintAmounts.get(nodeId) ?? 0, target, blend)
      const next = Math.abs(value - target) < 0.001 ? target : value
      if (next <= 0 && target <= 0) this.#glintAmounts.delete(nodeId)
      else this.#glintAmounts.set(nodeId, next)
      stateChanging ||= next !== target
    }
    const glints = this.#glintAmounts
    const interaction = this.#config.visuals.interaction
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
        if (inFamily && this.#navigation.level === 'family' && node.instrument && node.instrument === hoveredInstrument) {
          target = Math.max(target, interaction.instrumentHoveredIntensity / Math.max(interaction.familyIntensity, 0.001))
        }
        return target
      }
      // Node appearance (color/focus/idle/scale) is a pure function of section
      // state, per-node navigation focus, and the idle/glint system. None of
      // those change on most frames once a view settles (idle animation is
      // off by default), so a cheap comparison pass decides whether the
      // expensive recompute and GPU buffer re-upload below is actually needed.
      let appearanceDirty = (sectionAppearanceChanged.get(id) ?? true) || legacyIdleEnabled || idleAllowed
        || amount !== group.idleAmount || group.nodes.some(node => glints.has(node.id))
      if (!appearanceDirty) {
        for (let index = 0; index < group.nodes.length; index++) {
          if (group.idleWeights[index] !== idleTarget || focus.getX(index) !== focusTargetFor(group.nodes[index])) {
            appearanceDirty = true
            break
          }
        }
      }
      if (appearanceDirty) {
        group.colors = sectionNodeColors(group.nodes, this.#config, this.#materialTime, amount)
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
          const appearance = idleAppearance(node, this.#materialTime, idleSettings, idleSubjects, group.idleWeights[index], glints)
          attribute.setXYZ(index, color.r, color.g, color.b)
          idle.setX(index, appearance.brightness)
          const scale = node.radius * appearance.scale
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
        ghosts.update(this.#materialTime, reducedMotion ? 0 : state.opacity)
      }
    }
    this.#render()

    if (stateChanging || this.#pointerDirty || this.#canAnimateMaterial()) this.#scheduleFrame()
    else this.#lastFrameTime = null
  }

  #render = () => {
    if (document.hidden) return
    this.#composer.render(0)
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
    const entities = targets.flatMap(target => {
      const state = target.state
      const nodes = this.#positions.filter(node => node.visible !== false && state.level !== 'orchestra'
        && familySections(state.familyId).includes(node.sectionId) && (state.level !== 'instrument' || node.instrument === state.instrumentId))
      if (!nodes.length) return []
      const label = this.#annotationUI?.labels.querySelector<HTMLElement>(`[data-target="${target.id}"]`)
      return [{
        id: target.id,
        corner: labelCornerFor(target.placementId, label?.dataset.labelCorner),
        labelSize: { width: label?.offsetWidth || 120, height: label?.offsetHeight || 44 },
        nodes: nodes.map(node => {
          const center = project(...node.position)
          const edgeX = project(node.position[0] + node.radius, node.position[1], node.position[2])
          const edgeY = project(node.position[0], node.position[1] + node.radius, node.position[2])
          const rx = Math.max(2, Math.abs(edgeX.x - center.x)), ry = Math.max(2, Math.abs(edgeY.y - center.y))
          return { x: center.x - rx, y: center.y - ry, width: rx * 2, height: ry * 2 }
        }),
      }]
    })
    const origin = this.#container.getBoundingClientRect()
    const exclusions: Rect[] = []
    for (const element of [this.#annotationUI?.identity, this.#annotationUI?.actions.parentElement]) {
      if (!element) continue
      const rect = element.getBoundingClientRect()
      exclusions.push({ x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height })
    }
    this.#entityLayouts = layoutEntities(entities, { x: 0, y: 0, width, height }, exclusions, { clamp: !this.#labelsFollowTravel })
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
  }
}
