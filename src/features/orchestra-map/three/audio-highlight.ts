import * as THREE from 'three'
import type { OrchestraPosition } from './seating'
import type { OrchestraSceneConfig } from '../config'

// A rim/outline that lights up while an instrument is genuinely audible in
// the recording, independent of navigation dimming and separate from the
// ghost wave. Uses the classic "inverted hull" outline technique: a copy of
// the node's own geometry, scaled slightly larger and rendered back-face
// only, so just its silhouette peeks out around the front-facing sphere.
export function createAudioHighlight(
  nodes: OrchestraPosition[],
  config: OrchestraSceneConfig,
  geometry: THREE.BufferGeometry,
) {
  const settings = config.visuals.nodes.audioHighlight
  const instanceCount = nodes.length
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: {
      color: { value: new THREE.Color(settings.color) },
      strength: { value: 1 },
      opacity: { value: settings.opacity },
    },
    vertexShader: `varying float vActivity;
      void main() {
#ifdef USE_INSTANCING_COLOR
        vActivity = instanceColor.r;
#else
        vActivity = 0.0;
#endif
        vec4 transformed = instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * transformed;
      }`,
    fragmentShader: `varying float vActivity;
      uniform vec3 color;
      uniform float strength, opacity;
      void main() {
        gl_FragColor = vec4(color, vActivity * strength * opacity);
      }`,
  })
  const mesh = new THREE.InstancedMesh(geometry, material, instanceCount)
  const matrix = new THREE.Matrix4()
  const instanceColor = new THREE.Color()
  const activityWeights = new Array(nodes.length).fill(0)
  nodes.forEach((node, index) => {
    matrix.makeScale(0, 0, 0).setPosition(...node.position)
    mesh.setMatrixAt(index, matrix)
    mesh.setColorAt(index, instanceColor.setRGB(0, 0, 0))
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.frustumCulled = false

  const writeActivity = () => {
    nodes.forEach((node, index) => {
      const activity = activityWeights[index]
      // Scale fully-silent instances to zero (not just opacity to zero) so
      // there is no fragment work at all for the common "nothing playing" case.
      const scale = activity > 0.001 ? node.radius * settings.offsetScale : 0
      matrix.makeScale(scale, scale, scale).setPosition(...node.position)
      mesh.setMatrixAt(index, matrix)
      mesh.setColorAt(index, instanceColor.setRGB(activity, 0, 0))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  return {
    mesh,
    // Eases toward the new per-node activity (0–1) instead of snapping, so a
    // note's onset/offset reads as a smooth glow rather than a hard flicker.
    setActivity(targets: number[], blend = 1) {
      let changing = false
      nodes.forEach((_node, index) => {
        const target = THREE.MathUtils.clamp(targets[index] ?? 0, 0, 1)
        const eased = activityWeights[index] + (target - activityWeights[index]) * blend
        const next = Math.abs(eased - target) < 0.001 ? target : eased
        changing ||= Math.abs(next - activityWeights[index]) > 0.0001
        activityWeights[index] = next
      })
      // The instance-buffer rewrite below is the expensive part (touches
      // every node and forces a full GPU re-upload) — skip it on frames
      // where this section's activity hasn't actually moved, e.g. a
      // currently-silent section while other sections are audible.
      if (changing) writeActivity()
      return changing
    },
    update(strength: number) {
      material.uniforms.strength.value = strength
    },
  }
}
