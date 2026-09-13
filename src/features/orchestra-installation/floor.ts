import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import type { OrchestraSceneConfig, OrchestraSectionId } from './config'
import type { OrchestraPosition } from './seating'
import type { SectionVisualState } from './visual-state'
import { sectionNodeColors } from './section-palette'
import { nodeSeed } from './node-material'

export function createOrchestraFloor(config: OrchestraSceneConfig, nodes: OrchestraPosition[]) {
  const settings = config.visuals.floor
  const group = new THREE.Group()
  const scale = config.orchestraScale
  const floorY = Math.min(...nodes.map(n => n.position[1] - n.radius)) - settings.clearance * scale
  const bounds = new THREE.Box3().setFromPoints(nodes.map(n => new THREE.Vector3(...n.position)))
  const center = bounds.getCenter(new THREE.Vector3())
  const size = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) + 40 * scale
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({
    color: settings.color, roughness: settings.roughness, metalness: 0,
    transparent: true, depthWrite: false,
  }))
  // Fade both the stage and its reflection before their geometry ends.
  const fadeRadius = size * 0.45
  surface.material.onBeforeCompile = shader => {
    shader.uniforms.floorFadeRadius = { value: fadeRadius }
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec2 floorPoint;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloorPoint = position.xy;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
      '#include <common>\nvarying vec2 floorPoint; uniform float floorFadeRadius;')
      .replace('#include <opaque_fragment>',
        'diffuseColor.a *= 1.0 - smoothstep(floorFadeRadius * 0.2, floorFadeRadius, length(floorPoint));\n#include <opaque_fragment>')
  }
  surface.renderOrder = -2
  surface.rotation.x = -Math.PI / 2
  surface.position.set(center.x, floorY, center.z)
  group.add(surface)

  let reflector: Reflector | undefined
  if (settings.reflections.enabled) {
    const softened = settings.reflections.mode === 'softened'
    // Retain the pre-refinement values as a one-switch comparison.
    const resolution = softened ? Math.max(64, Math.round(settings.reflections.resolution)) : 512
    reflector = new Reflector(new THREE.PlaneGeometry(size, size), {
      textureWidth: resolution, textureHeight: resolution, multisample: 0, clipBias: 0.003,
      shader: {
        uniforms: {
          color: { value: new THREE.Color(settings.color) },
          tDiffuse: { value: null }, textureMatrix: { value: new THREE.Matrix4() },
          blur: { value: (softened ? settings.reflections.blur : 0.6) * 8 / resolution },
          strength: { value: softened ? settings.reflections.strength : 0.2 },
          distance: { value: Math.max(0.1, settings.reflections.distance) * scale },
          fadeRadius: { value: fadeRadius },
        },
        vertexShader: `uniform mat4 textureMatrix; varying vec4 reflectionUv; varying vec2 floorPoint;
          void main() { floorPoint = position.xy; reflectionUv = textureMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform sampler2D tDiffuse; uniform float blur, strength, fadeRadius, distance; varying vec2 floorPoint;
          varying vec4 reflectionUv;
          void main() {
            vec2 uv = reflectionUv.xy / reflectionUv.w;
            vec3 reflected = vec3(0.0); float weights = 0.0;
            for (int x = -${softened ? 2 : 1}; x <= ${softened ? 2 : 1}; x++) for (int y = -${softened ? 2 : 1}; y <= ${softened ? 2 : 1}; y++) {
              float weight = exp(-float(x*x+y*y) * 0.5);
              reflected += texture2D(tDiffuse, uv + vec2(float(x),float(y)) * blur * 2.0).rgb * weight;
              weights += weight;
            }
            float fade = 1.0 - smoothstep(fadeRadius * 0.2, fadeRadius, length(floorPoint));
            ${softened ? 'fade *= 1.0 - smoothstep(0.0, distance, abs(floorPoint.y));' : ''}
            gl_FragColor = vec4(reflected / weights, strength * fade);
          }`,
      },
    })
    reflector.rotation.copy(surface.rotation)
    reflector.renderOrder = -1
    reflector.position.copy(surface.position).add(new THREE.Vector3(0, 0.001 * scale, 0))
    const material = reflector.material as THREE.ShaderMaterial
    material.transparent = true
    material.depthWrite = false
    group.add(reflector)
    const capture = reflector.onBeforeRender.bind(reflector)
    const lastCamera = new THREE.Matrix4()
    const lastProjection = new THREE.Matrix4()
    let lastCapture = -Infinity
    reflector.onBeforeRender = (...args) => {
      const camera = args[2]
      const now = performance.now()
      // Ambient changes need fewer reflection updates. Camera movement
      // still captures immediately so the projected reflection stays aligned.
      if (now - lastCapture < 100 && lastCamera.equals(camera.matrixWorld)
        && lastProjection.equals(camera.projectionMatrix)) return
      lastCapture = now
      lastCamera.copy(camera.matrixWorld)
      lastProjection.copy(camera.projectionMatrix)
      const visible = group.children.filter(child => child !== reflector && child.visible)
      visible.forEach(child => { child.visible = false })
      try { capture(...args) }
      finally { visible.forEach(child => { child.visible = true }) }
    }
  }

  // Soft projected contact shadows/light pools: cheap grounding for floating
  // emissive nodes, not an additional shadow-casting point light per sphere.
  const pools = new Map<OrchestraSectionId, THREE.ShaderMaterial[]>()
  const poolColors = new Map<OrchestraSectionId, THREE.InstancedBufferAttribute[]>()
  const poolGeometry = new THREE.PlaneGeometry(2, 2)
  // Rank stable IDs once: exact density, repeatable across rebuilds and presets.
  // Exclude the conductor from the subset so its visibility toggle cannot reshuffle it.
  const candidates = nodes.filter(node => node.sectionId !== 'conductor')
    .sort((a, b) => nodeSeed(`floor-${a.id}`) - nodeSeed(`floor-${b.id}`) || a.id.localeCompare(b.id))
  const localIds = new Set(candidates.slice(0,
    Math.round(candidates.length * THREE.MathUtils.clamp(settings.localPools.density, 0, 1)),
  ).map(node => node.id))
  for (const id of [...new Set(nodes.map(node => node.sectionId))]) {
    if (!config.showConductor && id === 'conductor') continue
    const members = nodes.filter(node => node.sectionId === id && node.visible !== false)
    if (members.length === 0) continue
    const palette = sectionNodeColors(members, config)
    for (const layer of ['shadow', 'wash', 'local'] as const) {
      const local = layer === 'local'
      const light = layer !== 'shadow'
      if (local ? !settings.localPools.enabled || !members.some(node => localIds.has(node.id))
        : light ? !settings.lightSpill.enabled : !settings.shadows.enabled) continue
      const geometry = poolGeometry.clone()
      const strengths = new Float32Array(members.length)
      const material = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        blending: light ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: {
          color: { value: new THREE.Color(light ? '#ffffff' : '#000000') },
          opacity: { value: 1 },
          featherStart: { value: local ? 0.65 * (1 - THREE.MathUtils.clamp(settings.localPools.softness, 0, 1)) : 0.65 },
        },
        vertexShader: `attribute float poolStrength; attribute vec3 poolColor;
          varying vec3 tint; varying float strength; varying vec2 poolUv;
          void main() { poolUv = uv; strength = poolStrength; tint = poolColor;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec3 tint; varying vec2 poolUv; varying float strength; uniform vec3 color; uniform float opacity, featherStart;
          void main() { float r = length(poolUv * 2.0 - 1.0);
            float falloff = exp(-r*r*4.0) * (1.0-smoothstep(featherStart,1.0,r));
            gl_FragColor = vec4(color * tint, falloff * opacity * strength); }`,
      })
      material.userData.baseOpacity = 1
      material.userData.light = light
      const mesh = new THREE.InstancedMesh(geometry, material, members.length)
      mesh.name = `floor-${layer}-${id}`
      const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
      members.forEach((node, index) => {
        const height = Math.max(0, node.position[1] - node.radius - floorY)
        const radius = local ? Math.max(0.01, settings.localPools.radius) * scale * (0.85 + 0.3 * nodeSeed(`pool-size-${node.id}`))
          : light ? node.radius * settings.lightSpill.radiusScale + height * 0.4
          : node.radius * (1.3 + settings.shadows.softness) + height * 0.3
        strengths[index] = local
          ? (localIds.has(node.id) ? Math.max(0, settings.localPools.intensity) * (0.7 + 0.3 * nodeSeed(`pool-light-${node.id}`)) : 0)
          : (light ? settings.lightSpill.strength : settings.shadows.opacity) / (1 + height / scale)
        mesh.setMatrixAt(index, new THREE.Matrix4().compose(
          new THREE.Vector3(node.position[0], floorY + (local ? Math.max(0.0035, settings.localPools.groundOffset) : light ? 0.003 : 0.002) * scale, node.position[2]),
          rotation, new THREE.Vector3(radius, local ? radius * 0.8 : radius, 1),
        ))
      })
      geometry.setAttribute('poolStrength', new THREE.InstancedBufferAttribute(strengths, 1))
      geometry.setAttribute('poolColor', new THREE.InstancedBufferAttribute(
        new Float32Array(palette.flatMap(color => color.toArray())), 3,
      ))
      const attributes = poolColors.get(id) ?? []
      attributes.push(geometry.getAttribute('poolColor') as THREE.InstancedBufferAttribute)
      poolColors.set(id, attributes)
      mesh.instanceMatrix.needsUpdate = true
      mesh.renderOrder = local ? 3 : light ? 2 : 1
      group.add(mesh)
      const sectionPools = pools.get(id) ?? []
      sectionPools.push(material)
      pools.set(id, sectionPools)
    }
  }
  poolGeometry.dispose()
  return {
    group,
    setSectionColors(id: OrchestraSectionId, colors: THREE.Color[]) {
      for (const attribute of poolColors.get(id) ?? []) {
        colors.forEach((color, index) => attribute.setXYZ(index, color.r, color.g, color.b))
        attribute.needsUpdate = true
      }
    },
    setSectionState(id: OrchestraSectionId, state: SectionVisualState) {
      const emphasis = THREE.MathUtils.clamp(state.emphasis, -1, 1)
      const intensity = emphasis < 0
        ? THREE.MathUtils.lerp(config.visuals.interaction.neutralIntensity, config.visuals.interaction.dimmedIntensity, -emphasis)
        : THREE.MathUtils.lerp(config.visuals.interaction.neutralIntensity, config.visuals.interaction.highlightedIntensity, emphasis)
      for (const material of pools.get(id) ?? []) {
        material.uniforms.opacity.value = material.userData.baseOpacity * THREE.MathUtils.clamp(state.opacity, 0, 1)
          * (material.userData.light ? intensity * (1 + THREE.MathUtils.clamp(state.activity, 0, 1) * 0.5) : 1)
      }
    },
    // Geometry/material cleanup is handled by the owning scene's group traversal.
    dispose() { reflector?.getRenderTarget().dispose() },
  }
}
