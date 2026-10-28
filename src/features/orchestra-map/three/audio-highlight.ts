import * as THREE from 'three'
import type { OrchestraPosition } from './seating'
import type { OrchestraSceneConfig } from '../config'

// What the scene needs to know about one instrument each frame.
export type AudibleActivity = { active: boolean; intensity: number; attack?: number }

type RingEasing = { minActivity: number; attackEasingRate: number; releaseEasingRate: number }

// What a ring should show for one instrument: nothing while its onset gate
// is closed, and at least `minActivity` while open, so a pianissimo entrance
// is visible on its first frame instead of growing out of a zero-width rim.
export function ringTarget(active: boolean, intensity: number, minActivity: number) {
  if (!active) return 0
  return Math.min(1, Math.max(minActivity, intensity))
}

// One frame of ring easing. An onset (rising from below the floor) jumps to
// the floor at once, then eases at the attack rate; falling uses the slower
// release rate so the rim lingers after a note ends.
export function easeRingActivity(current: number, target: number, delta: number, easing: RingEasing, instant = false) {
  const goal = Math.min(1, Math.max(0, target))
  const from = goal >= easing.minActivity && current < easing.minActivity ? easing.minActivity : current
  const rate = goal > from ? easing.attackEasingRate : easing.releaseEasingRate
  const blend = instant || delta <= 0 ? 1 : 1 - Math.exp(-delta * rate)
  const eased = from + (goal - from) * blend
  return Math.abs(eased - goal) < 0.001 ? goal : eased
}

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
  const rimOuterAttr = new THREE.InstancedBufferAttribute(new Float32Array(instanceCount), 1)
  ringGeometry.setAttribute('ringInner', innerAttr)
  ringGeometry.setAttribute('ringOuter', rimOuterAttr)
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
      attribute float ringOuter;
      varying vec2 vDiskOffset;
      varying float vInner;
      varying float vRimOuter;
      void main() {
        vec4 world = instanceMatrix * vec4(position, 1.0);
        vDiskOffset = world.xy - instanceMatrix[3].xy;
        vInner = ringInner;
        vRimOuter = ringOuter;
        gl_Position = projectionMatrix * modelViewMatrix * world;
      }`,
    fragmentShader: `varying vec2 vDiskOffset;
      varying float vInner;
      varying float vRimOuter;
      uniform vec3 color;
      uniform float strength, opacity;
      void main() {
        float radius = length(vDiskOffset);
        if (radius < vInner) discard;
        float rim = 1.0 - smoothstep(vRimOuter - vInner * 0.03, vRimOuter, radius);
        float halo = (1.0 - rim) * (1.0 - smoothstep(vRimOuter, vRimOuter * 1.18, radius));
        gl_FragColor = vec4(color, strength * opacity * (rim + halo * 0.32));
      }`,
  })
  const mesh = new THREE.InstancedMesh(ringGeometry, material, instanceCount)
  const matrix = new THREE.Matrix4()
  const activityWeights = new Array(nodes.length).fill(0)
  // Per-node displacement from the seat (the loading wave), so a ring stays
  // around its light when the light moves.
  const offsets = new Float32Array(instanceCount * 3)
  let offsetsChanged = false
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
      const rimRadius = activity > 0.001
        ? node.radius * THREE.MathUtils.lerp(1, settings.offsetScale, activity)
        : 0
      const haloRadius = rimRadius * 1.18
      matrix.makeScale(haloRadius, haloRadius, haloRadius).setPosition(
        node.position[0] + offsets[index * 3],
        node.position[1] + offsets[index * 3 + 1],
        node.position[2] + offsets[index * 3 + 2],
      )
      mesh.setMatrixAt(index, matrix)
      innerAttr.setX(index, node.radius)
      rimOuterAttr.setX(index, rimRadius)
    })
    mesh.instanceMatrix.needsUpdate = true
    innerAttr.needsUpdate = true
    rimOuterAttr.needsUpdate = true
  }

  return {
    mesh,
    // Targets come from ringTarget(); see easeRingActivity for the onset
    // jump and attack/release rates. `instant` snaps immediately (reduced
    // motion, or no elapsed time to ease over).
    setActivity(targets: number[], delta: number, instant = false) {
      let changing = false
      nodes.forEach((_node, index) => {
        const current = activityWeights[index]
        const next = easeRingActivity(current, targets[index] ?? 0, delta, settings, instant)
        changing ||= Math.abs(next - current) > 0.0001
        activityWeights[index] = next
      })
      if (changing || offsetsChanged) writeActivity()
      offsetsChanged = false
      return changing
    },
    // Applied on the next setActivity.
    setOffset(index: number, x: number, y: number, z: number) {
      const at = index * 3
      if (offsets[at] === x && offsets[at + 1] === y && offsets[at + 2] === z) return
      offsets[at] = x
      offsets[at + 1] = y
      offsets[at + 2] = z
      offsetsChanged = true
    },
    update(strength: number) {
      material.uniforms.strength.value = strength
    },
  }
}
