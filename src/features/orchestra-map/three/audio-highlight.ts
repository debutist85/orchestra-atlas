import * as THREE from 'three'
import type { OrchestraPosition } from './seating'
import type { OrchestraSceneConfig } from '../config'

// A rim/outline that lights up while an instrument is genuinely audible in
// the recording, independent of navigation dimming and separate from the
// ghost wave. Uses the classic "inverted hull" outline technique: a copy of
// the node's own geometry, scaled slightly larger and rendered back-face
// only, so just its silhouette peeks out around the front-facing disk.
// Intensity grows that extra radius. The rim stays a constant white.
export function createAudioHighlight(
  nodes: OrchestraPosition[],
  config: OrchestraSceneConfig,
  geometry: THREE.BufferGeometry,
) {
  const settings = config.visuals.nodes.audioHighlight
  const instanceCount = nodes.length
  const material = new THREE.ShaderMaterial({
    transparent: settings.opacity < 1,
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: {
      color: { value: new THREE.Color(settings.color) },
      strength: { value: 1 },
      opacity: { value: settings.opacity },
    },
    vertexShader: `void main() {
        vec4 transformed = instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * transformed;
      }`,
    fragmentShader: `uniform vec3 color;
      uniform float strength, opacity;
      void main() {
        gl_FragColor = vec4(color, strength * opacity);
      }`,
  })
  const mesh = new THREE.InstancedMesh(geometry, material, instanceCount)
  const matrix = new THREE.Matrix4()
  const activityWeights = new Array(nodes.length).fill(0)
  nodes.forEach((node, index) => {
    matrix.makeScale(0, 0, 0).setPosition(...node.position)
    mesh.setMatrixAt(index, matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
  mesh.frustumCulled = false

  const writeActivity = () => {
    nodes.forEach((node, index) => {
      const activity = activityWeights[index]
      // Scale fully-silent instances to zero so there is no fragment work
      // when nothing is playing. Width is the extra radius beyond the node.
      const scale = activity > 0.001
        ? node.radius * THREE.MathUtils.lerp(1, settings.offsetScale, activity)
        : 0
      matrix.makeScale(scale, scale, scale).setPosition(...node.position)
      mesh.setMatrixAt(index, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }

  return {
    mesh,
    // Eases toward the new per-node activity (0–1) instead of snapping, so a
    // note's onset/offset reads as a smooth swell rather than a hard flicker.
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
