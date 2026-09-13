import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js'

import type { OrchestraSceneConfig, OrchestraSectionId } from './config'
import { createOrchestraVisualState, type OrchestraVisualState, type SectionVisualState } from './visual-state'
import { createOrchestraPositions, ringPoint } from './seating'
import { createNodeMaterial, nodeSeed } from './node-material'
import { sectionNodeColors } from './section-palette'
import { createNodeGhosts } from './node-ghost'
import type { OrchestraPosition } from './seating'
import { createOrchestraFloor } from './floor'

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
  #group = new THREE.Group()
  #controls: OrbitControls | null = null
  #config: OrchestraSceneConfig
  #debug: boolean
  #labels: { element: HTMLSpanElement; position: THREE.Vector3 }[] = []
  readonly #motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  readonly #cameraPivot = new THREE.Vector3()
  readonly #cameraOffset = new THREE.Vector3()
  readonly #cameraLookOffset = new THREE.Vector3()
  readonly #tiltedLookTarget = new THREE.Vector3()
  readonly #cameraUp = new THREE.Vector3()
  readonly #tiltTarget = new THREE.Vector2()
  readonly #tiltCurrent = new THREE.Vector2()
  #animationFrame: number | null = null
  #deviceOrientationBaseline: { beta: number; gamma: number } | null = null
  #devicePermissionRequested = false
  #nodeMaterials: ReturnType<typeof createNodeMaterial>[] = []
  #materialTime = 0
  #lastFrameTime: number | null = null
  #floor: ReturnType<typeof createOrchestraFloor> | null = null
  #state: OrchestraVisualState
  #targetState: OrchestraVisualState
  #sectionMaterials = new Map<OrchestraSectionId, ReturnType<typeof createNodeMaterial>>()
  #pickable: THREE.InstancedMesh[] = []
  #paletteGroups: { nodes: OrchestraPosition[]; geometry: THREE.BufferGeometry }[] = []
  #framingPoints: THREE.Vector3[] = []
  #ghosts = new Map<OrchestraSectionId, ReturnType<typeof createNodeGhosts>>()
  readonly #raycaster = new THREE.Raycaster()

  constructor(container: HTMLElement, config: OrchestraSceneConfig, debug: boolean) {
    this.#container = container
    this.#config = config
    this.#debug = debug
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

    container.addEventListener('pointermove', this.#handlePointerMove)
    container.addEventListener('pointerleave', this.#resetTilt)
    container.addEventListener('pointerup', this.#requestDeviceOrientation)
    window.addEventListener('deviceorientation', this.#handleDeviceOrientation)
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

  // Client coordinates in, semantic IDs out. No selection behavior is installed.
  pickNode(clientX: number, clientY: number): { nodeId: string; sectionId: OrchestraSectionId } | null {
    const bounds = this.#container.getBoundingClientRect()
    if (!bounds.width || !bounds.height || clientX < bounds.left || clientX > bounds.right
      || clientY < bounds.top || clientY > bounds.bottom) return null
    this.#camera.updateMatrixWorld()
    this.#group.updateMatrixWorld(true)
    this.#raycaster.setFromCamera(new THREE.Vector2(
      (clientX - bounds.left) / bounds.width * 2 - 1,
      1 - (clientY - bounds.top) / bounds.height * 2,
    ), this.#camera)
    for (const hit of this.#raycaster.intersectObjects(this.#pickable, false)) {
      const sectionId = hit.object.userData.sectionId as OrchestraSectionId
      if (hit.instanceId === undefined || this.#state[sectionId].opacity < 0.01) continue
      return { nodeId: hit.object.userData.nodeIds[hit.instanceId], sectionId }
    }
    return null
  }

  dispose() {
    this.#resizeObserver.disconnect()
    this.#container.removeEventListener('pointermove', this.#handlePointerMove)
    this.#container.removeEventListener('pointerleave', this.#resetTilt)
    this.#container.removeEventListener('pointerup', this.#requestDeviceOrientation)
    window.removeEventListener('deviceorientation', this.#handleDeviceOrientation)
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
    this.#nodeMaterials = []
    this.#sectionMaterials.clear()
    this.#pickable = []
    this.#paletteGroups = []
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
    // Include node edges, but exclude the expansive floor from camera fitting.
    this.#framingPoints = positions.flatMap(node =>
      [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z =>
        new THREE.Vector3(...node.position).add(new THREE.Vector3(x, y, z).multiplyScalar(node.radius)),
      ))),
    )
    if (config.visuals.floor.enabled) {
      this.#floor = createOrchestraFloor(config, positions)
      this.#group.add(this.#floor.group)
    }
    if (config.showNodeNumbers) {
      // Number in seating-data order, independent of camera position or preset scale.
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
        const ghosts = createNodeGhosts(nodes, config)
        this.#ghosts.set(group, ghosts)
        this.#group.add(ghosts.mesh)
      }
      geometry.setAttribute('nodePalette', new THREE.InstancedBufferAttribute(
        new Float32Array(palette.flatMap(color => color.toArray())), 3,
      ))
      this.#paletteGroups.push({ nodes, geometry })
      const appearance = createNodeMaterial('#ffffff', config.visuals)
      appearance.setState(this.#state[group])
      this.#floor?.setSectionState(group, this.#state[group])
      this.#sectionMaterials.set(group, appearance)
      appearance.setTime(this.#materialTime)
      this.#nodeMaterials.push(appearance)
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
    this.#cameraPivot.set(...(positions.find(node => node.id === 'conductor')?.position ?? config.conductorOrigin))
    this.#cameraOffset.copy(this.#camera.position).sub(this.#cameraPivot)
    this.#cameraLookOffset.copy(target).sub(this.#cameraPivot)
    this.#cameraUp.copy(this.#camera.up)
    this.#tiltCurrent.set(0, 0)
    this.#tiltTarget.set(0, 0)
    if (this.#debug) {
      this.#controls = new OrbitControls(this.#camera, this.#renderer.domElement)
      this.#controls.target.copy(target)
      this.#controls.enableDamping = false
      this.#controls.addEventListener('change', this.#render)
      this.#controls.update()
    }
    this.#scheduleFrame()
  }

  #resize = () => {
    const width = this.#container.clientWidth
    const height = this.#container.clientHeight
    if (!width || !height) return
    const quality = this.#config.visuals.performance
    // Canvas antialiasing does not cover EffectComposer's offscreen targets.
    // Intersect color/depth support instead of assuming MAX_SAMPLES applies to HDR.
    const gl = this.#renderer.getContext() as WebGL2RenderingContext
    const colorSamples = Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES) as Int32Array)
    const depthSamples = Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, gl.SAMPLES) as Int32Array)
    const samples = quality.antialias ? Math.max(0, ...colorSamples.filter(n =>
      n > 1 && n <= quality.antialiasSamples && depthSamples.includes(n),
    )) : 0
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
    const framingHeight = height / 2
    this.#camera.aspect = width / framingHeight
    // Preserve horizontal framing in narrow containers with the same spatial layout.
    const aspect = Math.min(this.#camera.aspect, 1.65)
    this.#camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.#config.camera.fov / 2)) * 1.65 / aspect))
    // Keep mobile's established framing. On desktop fit the actual formation
    // to the configured viewport fraction, leaving space for its glow.
    if (width >= 1024) {
      this.#camera.updateMatrixWorld()
      const occupancy = THREE.MathUtils.clamp(this.#config.camera.desktopOccupancy, 0.1, 1)
      let tangent = 0
      for (const point of this.#framingPoints) {
        const view = point.clone().applyMatrix4(this.#camera.matrixWorldInverse)
        if (view.z >= 0) continue
        tangent = Math.max(tangent, Math.abs(view.y) / -view.z,
          Math.abs(view.x) / (-view.z * this.#camera.aspect))
      }
      this.#camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tangent / occupancy))
    }
    // Frame against the upper half, then extend that frustum downward across
    // the full canvas so reflections and shadows are not clipped at its midpoint.
    this.#camera.setViewOffset(width, framingHeight, 0, 0, width, height)
    this.#render()
  }

  #handlePointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || !this.#canTilt()) return
    const bounds = this.#container.getBoundingClientRect()
    this.#setTiltTarget(
      THREE.MathUtils.clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1),
      THREE.MathUtils.clamp((event.clientY - bounds.top) / bounds.height * 2 - 1, -1, 1),
    )
  }

  #handleDeviceOrientation = (event: DeviceOrientationEvent) => {
    if (!this.#canTilt() || event.beta === null || event.gamma === null) return
    this.#deviceOrientationBaseline ??= { beta: event.beta, gamma: event.gamma }
    const sensitivity = 18
    this.#setTiltTarget(
      THREE.MathUtils.clamp((event.gamma - this.#deviceOrientationBaseline.gamma) / sensitivity, -1, 1),
      THREE.MathUtils.clamp((event.beta - this.#deviceOrientationBaseline.beta) / sensitivity, -1, 1),
    )
  }

  #requestDeviceOrientation = async (event: PointerEvent) => {
    if (event.pointerType === 'mouse' || this.#devicePermissionRequested || !this.#canTilt()) return
    const orientationEvent = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }
    if (!orientationEvent.requestPermission) return
    this.#devicePermissionRequested = true
    try {
      await orientationEvent.requestPermission()
    } catch {
      // Motion remains an optional enhancement when permission is unavailable.
    }
  }

  #handleMotionPreference = () => {
    if (this.#motionPreference.matches) this.#resetTilt()
    this.#scheduleFrame()
  }

  #canAnimateMaterial() {
    return (this.#config.visuals.nodes.ghost.enabled || this.#config.visuals.nodes.idle.enabled)
      && !this.#motionPreference.matches && !document.hidden
  }

  #handleVisibility = () => {
    if (this.#animationFrame !== null) cancelAnimationFrame(this.#animationFrame)
    this.#animationFrame = null
    this.#lastFrameTime = null
    if (!document.hidden) this.#scheduleFrame()
  }

  #canTilt() {
    return this.#config.gyroscope.enabled && !this.#debug && !this.#motionPreference.matches
  }

  #setTiltTarget(x: number, y: number) {
    this.#tiltTarget.set(x, y)
    this.#scheduleFrame()
  }

  #resetTilt = () => {
    this.#tiltTarget.set(0, 0)
    this.#deviceOrientationBaseline = null
    this.#scheduleFrame()
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
    if (this.#canAnimateMaterial()) this.#materialTime += delta
    for (const appearance of this.#nodeMaterials) appearance.setTime(this.#materialTime)
    for (const { nodes, geometry } of this.#paletteGroups) {
      const id = nodes[0].sectionId
      const state = this.#state[id]
      const amount = this.#config.visuals.nodes.idle.enabled && !this.#motionPreference.matches
        ? (1 - Math.abs(state.emphasis)) * (1 - state.activity) : 0
      const colors = sectionNodeColors(nodes, this.#config, this.#materialTime, amount)
      this.#ghosts.get(id)?.update(this.#materialTime, colors,
        this.#motionPreference.matches ? 0 : state.opacity * (1 - Math.abs(state.emphasis)))
      this.#sectionMaterials.get(id)?.setTime(this.#materialTime, amount)
      const attribute = geometry.getAttribute('nodePalette') as THREE.InstancedBufferAttribute
      colors.forEach((color, index) => attribute.setXYZ(index, color.r, color.g, color.b))
      attribute.needsUpdate = true
      this.#floor?.setSectionColors(id, colors)
    }
    let stateChanging = false
    const duration = this.#config.visuals.interaction.transitionSeconds
    const blend = this.#motionPreference.matches || duration <= 0 ? 1 : 1 - Math.exp(-delta * 5 / duration)
    for (const [id, appearance] of this.#sectionMaterials) {
      for (const key of ['opacity', 'emphasis', 'activity'] as const) {
        const target = this.#targetState[id][key]
        const value = THREE.MathUtils.lerp(this.#state[id][key], target, blend)
        this.#state[id][key] = Math.abs(value - target) < 0.001 ? target : value
        stateChanging ||= this.#state[id][key] !== target
      }
      appearance.setState(this.#state[id])
      this.#floor?.setSectionState(id, this.#state[id])
    }
    const easing = THREE.MathUtils.clamp(this.#config.gyroscope.easing, 0.01, 1)
    this.#tiltCurrent.lerp(this.#tiltTarget, this.#motionPreference.matches ? 1 : 1 - Math.pow(1 - easing, delta * 60))
    if (this.#tiltCurrent.distanceToSquared(this.#tiltTarget) < 0.000001) {
      this.#tiltCurrent.copy(this.#tiltTarget)
    }

    if (!this.#debug) {
      const maxTilt = THREE.MathUtils.degToRad(this.#config.gyroscope.maxTiltDegrees)
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        this.#tiltCurrent.y * maxTilt,
        -this.#tiltCurrent.x * maxTilt,
        0,
      ))
      this.#camera.position.copy(this.#cameraOffset).applyQuaternion(rotation).add(this.#cameraPivot)
      this.#camera.up.copy(this.#cameraUp).applyQuaternion(rotation)
      this.#tiltedLookTarget.copy(this.#cameraLookOffset)
        .applyQuaternion(rotation)
        .add(this.#cameraPivot)
      this.#camera.lookAt(this.#tiltedLookTarget)
    }
    this.#render()

    if (stateChanging || !this.#tiltCurrent.equals(this.#tiltTarget) || this.#canAnimateMaterial()) this.#scheduleFrame()
    else this.#lastFrameTime = null
  }

  #render = () => {
    if (document.hidden) return
    this.#composer.render(0)
    const width = this.#container.clientWidth
    const height = this.#container.clientHeight
    for (const label of this.#labels) {
      const point = label.position.clone().project(this.#camera)
      label.element.style.left = `${(point.x + 1) * width / 2}px`
      label.element.style.top = `${(1 - point.y) * height / 2}px`
      label.element.style.visibility = point.z < -1 || point.z > 1 ? 'hidden' : 'visible'
    }
  }
}
