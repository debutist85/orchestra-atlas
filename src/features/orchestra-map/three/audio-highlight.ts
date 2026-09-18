import * as THREE from 'three'
import type { OrchestraPosition } from './seating'
import type { OrchestraSceneConfig } from '../config'

// A rim that lights up while an instrument is audible. Intensity grows the
// extra radius. Own geometry so the node mesh's instance attributes cannot
// shift this outline, and the hole is measured from the instance center in
// the disk plane (world XY, disks face +Z).
export function createAudioHighlight(
  nodes: OrchestraPosition[],
  config: OrchestraSceneConfig,
  geometry: THREE.BufferGeometry,
) {
  const settings = config.visuals.nodes.audioHighlight
  const instanceCount = nodes.length
  const ringGeometry = geometry.clone()
  const innerAttr = new THREE.InstancedBufferAttribute(new Float32Array(instanceCount), 1)
  ringGeometry.setAttribute('ringInner', innerAttr)
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.BackSide,
    uniforms: {
      color: { value: new THREE.Color(settings.color) },
      strength: { value: 1 },
      opacity: { value: settings.opacity },
    },
    vertexShader: `attribute float ringInner;
      varying vec2 vDiskOffset;
      varying float vInner;
      void main() {
        vec4 world = instanceMatrix * vec4(position, 1.0);
        vDiskOffset = world.xy - instanceMatrix[3].xy;
        vInner = ringInner;
        gl_Position = projectionMatrix * modelViewMatrix * world;
      }`,
    fragmentShader: `varying vec2 vDiskOffset;
      varying float vInner;
      uniform vec3 color;
      uniform float strength, opacity;
      void main() {
        if (length(vDiskOffset) < vInner) discard;
        gl_FragColor = vec4(color, strength * opacity);
      }`,
  })
  const mesh = new THREE.InstancedMesh(ringGeometry, material, instanceCount)
  const matrix = new THREE.Matrix4()
  const activityWeights = new Array(nodes.length).fill(0)
  nodes.forEach((node, index) => {
    matrix.makeScale(0, 0, 0).setPosition(...node.position)
    mesh.setMatrixAt(index, matrix)
    innerAttr.setX(index, node.radius)
  })
  mesh.instanceMatrix.needsUpdate = true
  innerAttr.needsUpdate = true
  mesh.frustumCulled = false
  mesh.renderOrder = 8

  const writeActivity = () => {
    nodes.forEach((node, index) => {
      const activity = activityWeights[index]
      const scale = activity > 0.001
        ? node.radius * THREE.MathUtils.lerp(1, settings.offsetScale, activity)
        : 0
      matrix.makeScale(scale, scale, scale).setPosition(...node.position)
      mesh.setMatrixAt(index, matrix)
      innerAttr.setX(index, node.radius)
    })
    mesh.instanceMatrix.needsUpdate = true
    innerAttr.needsUpdate = true
  }

  return {
    mesh,
    setActivity(targets: number[], blend = 1) {
      let changing = false
      nodes.forEach((_node, index) => {
        const target = THREE.MathUtils.clamp(targets[index] ?? 0, 0, 1)
        const eased = activityWeights[index] + (target - activityWeights[index]) * blend
        const next = Math.abs(eased - target) < 0.001 ? target : eased
        changing ||= Math.abs(next - activityWeights[index]) > 0.0001
        activityWeights[index] = next
      })
      if (changing) writeActivity()
      return changing
    },
    update(strength: number) {
      material.uniforms.strength.value = strength
    },
  }
}
