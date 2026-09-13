import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { instrumentNames, type OrchestraSceneConfig, type OrchestraInstrument } from './config'
import { createOrchestraPositions } from './seating'

export class OrchestraScene {
  readonly #container: HTMLElement
  readonly #scene = new THREE.Scene()
  readonly #camera = new THREE.PerspectiveCamera()
  readonly #renderer = new THREE.WebGLRenderer({ antialias: true })
  readonly #resizeObserver: ResizeObserver
  #group = new THREE.Group()
  #controls: OrbitControls | null = null
  #config: OrchestraSceneConfig
  #debug: boolean
  #labels: { element: HTMLSpanElement; position: THREE.Vector3 }[] = []

  constructor(container: HTMLElement, config: OrchestraSceneConfig, debug: boolean) {
    this.#container = container
    this.#config = config
    this.#debug = debug
    this.#scene.background = new THREE.Color('#0c0e10')
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.#renderer.outputColorSpace = THREE.SRGBColorSpace
    this.#renderer.domElement.setAttribute('aria-hidden', 'true')
    container.append(this.#renderer.domElement)


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

  dispose() {
    this.#resizeObserver.disconnect()
    this.#controls?.dispose()
    this.#clear()
    this.#renderer.dispose()
    this.#renderer.domElement.remove()
  }

  #clear() {
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
    const positions = createOrchestraPositions(config)
    if (config.showNodeNumbers) {
      // Number in seating-data order, independent of camera position or preset scale.
      positions.forEach((node, index) => {
        const element = document.createElement('span')
        element.className = 'orchestra-node-number'
        element.textContent = String(index + 1)
        element.dataset.nodeId = node.id
        element.setAttribute('aria-label', `Node ${index + 1}: ${instrumentNames[node.instrument]}, ${node.id}`)
        this.#container.append(element)
        this.#labels.push({ element, position: new THREE.Vector3(...node.position) })
      })
    }
    const groups = [...new Set(positions.map((node) => node.instrument))]
    for (const instrument of groups) {
      const nodes = positions.filter((node) => node.instrument === instrument)
      const geometry = new THREE.SphereGeometry(1, 24, 16)
      const color = config.familyColors[nodes[0].family]
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 })
      const mesh = new THREE.InstancedMesh(geometry, material, nodes.length)
      nodes.forEach((node, index) => {
        mesh.setMatrixAt(index, new THREE.Matrix4()
          .makeScale(node.radius, node.radius, node.radius)
          .setPosition(...node.position))
      })
      mesh.instanceMatrix.needsUpdate = true
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
        element.textContent = instrumentNames[instrument as OrchestraInstrument]
        this.#container.append(element)
        const position = bounds.getCenter(new THREE.Vector3())
        position.y = bounds.max.y + 0.35
        this.#labels.push({ element, position })
      }
    }
    if (this.#debug) {
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
      config.conductorOrigin[1],
      (bounds.min.z + config.conductorOrigin[2]) / 2,
    ).add(new THREE.Vector3(...config.camera.target))
    this.#camera.fov = config.camera.fov
    this.#camera.near = 0.1
    this.#camera.far = 200
    this.#camera.position.copy(target).add(new THREE.Vector3(...config.camera.position))
    // A top-down view needs an up axis perpendicular to its viewing direction.
    // Negative Z keeps the rear of the orchestra at the top of the screen.
    this.#camera.up.set(0, 0, -1)
    this.#camera.lookAt(target)
    if (this.#debug) {
      this.#controls = new OrbitControls(this.#camera, this.#renderer.domElement)
      this.#controls.target.copy(target)
      this.#controls.enableDamping = false
      this.#controls.addEventListener('change', this.#render)
      this.#controls.update()
    }
  }

  #resize = () => {
    const width = this.#container.clientWidth
    const height = this.#container.clientHeight
    if (!width || !height) return
    this.#renderer.setSize(width, height, false)
    this.#camera.aspect = width / height
    // Preserve horizontal framing in narrow containers with the same spatial layout.
    const aspect = Math.min(this.#camera.aspect, 1.65)
    this.#camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.#config.camera.fov / 2)) * 1.65 / aspect))
    this.#camera.updateProjectionMatrix()
    this.#render()
  }

  #render = () => {
    this.#renderer.render(this.#scene, this.#camera)
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
