import * as THREE from 'three'
import type { OrchestraPosition } from './seating'
import type { OrchestraSceneConfig } from './config'
import { nodeSeed } from './node-material'

const ghostsPerNode = 3

export function createNodeGhosts(
  nodes: OrchestraPosition[],
  config: OrchestraSceneConfig,
  initialColors: THREE.Color[],
) {
  const settings = config.visuals.nodes.ghost
  const instanceCount = nodes.length * ghostsPerNode
  const geometry = new THREE.PlaneGeometry(2.5, 2.5)
  const seed = new Float32Array(instanceCount)
  const twin = new Float32Array(instanceCount)
  const radius = new Float32Array(instanceCount)
  const tint = new THREE.InstancedBufferAttribute(new Float32Array(instanceCount * 3), 3)
  const mesh = new THREE.InstancedMesh(geometry, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      time: { value: 0 },
      strength: { value: 1 },
      slotCount: { value: ghostsPerNode },
      intervalSeconds: { value: Math.max(0.4, settings.intervalSeconds) },
      durationSeconds: { value: Math.max(0.1, settings.durationSeconds) },
      familyDurationSeconds: { value: Math.max(0.1, settings.familyDurationSeconds) },
      selectedDurationSeconds: { value: Math.max(0.1, settings.selectedDurationSeconds) },
      ghostOpacity: { value: settings.opacity },
      offsetScale: { value: settings.offset },
      familyOpacity: { value: settings.familyOpacity },
      familyOffset: { value: settings.familyOffset },
      selectedOpacity: { value: settings.selectedOpacity },
      selectedOffset: { value: settings.selectedOffset },
    },
    vertexShader: `attribute float ghostSeed, ghostTwin, ghostRadius;
      attribute vec3 ghostColor;
      uniform float time, strength, slotCount, intervalSeconds, durationSeconds, offsetScale;
      uniform float familyOffset, selectedOffset, familyDurationSeconds, selectedDurationSeconds;
      varying vec2 point; varying float opacity; varying float focus; varying vec3 color;
      float random(float value) { return fract(sin(value * 91.3458) * 47453.5453); }
      void main() {
        point = uv * 2.0 - 1.0;
#ifdef USE_INSTANCING_COLOR
        float live = instanceColor.r;
        focus = instanceColor.g * 2.0;
#else
        float live = 0.0;
        focus = 0.0;
#endif
        if (live < 0.001 || ghostTwin >= slotCount) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          opacity = 0.0;
          color = ghostColor;
          return;
        }
        float instrument = clamp(focus - 1.0, 0.0, 1.0);
        float family = clamp(focus, 0.0, 1.0) * (1.0 - instrument);
        // The clock/period never varies by level - recomputing phase from an
        // absolute, stateless time means any change to the period itself
        // would jump the wave's position rather than smoothly retime it.
        // Duration is safe to vary continuously: it only moves the on/off
        // threshold against that same unchanged phase.
        float period = intervalSeconds * slotCount;
        float clock = time + ghostSeed * period + ghostTwin * intervalSeconds;
        float cycle = floor(clock / period);
        float elapsed = mod(clock, period);
        float duration = mix(mix(durationSeconds, familyDurationSeconds, family), selectedDurationSeconds, instrument);
        float envelope = elapsed < duration ? pow(sin(3.14159265 * elapsed / duration), 2.0) : 0.0;
        opacity = envelope * live * strength;
        color = ghostColor * (0.85 + random(ghostSeed + cycle * 0.371 + ghostTwin * 0.719) * 0.3);
        float direction = random(ghostSeed + cycle * 0.173 + ghostTwin * 0.41) * 6.2831853;
        float offsetMix = mix(mix(offsetScale, familyOffset, family), selectedOffset, instrument);
        float offset = ghostRadius * offsetMix * (0.7 + 0.3 * envelope);
        vec4 transformed = instanceMatrix * vec4(position, 1.0);
        transformed.xy += vec2(cos(direction) * offset, sin(direction) * offset * 0.5);
        transformed.z -= ghostRadius * 0.15;
        gl_Position = projectionMatrix * modelViewMatrix * transformed;
        if (opacity < 0.001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: `varying vec2 point; varying float opacity; varying float focus; varying vec3 color;
      uniform float ghostOpacity, familyOpacity, selectedOpacity;
      void main() {
        float instrument = clamp(focus - 1.0, 0.0, 1.0);
        float family = clamp(focus, 0.0, 1.0) * (1.0 - instrument);
        float tint = mix(mix(ghostOpacity, familyOpacity, family), selectedOpacity, instrument);
        float feather = 1.0 - smoothstep(0.45, 1.0, length(point));
        gl_FragColor = vec4(color, opacity * tint * feather);
      }`,
  }), instanceCount)
  const matrix = new THREE.Matrix4()
  const activityColor = new THREE.Color()
  const presenceWeights = new Array(nodes.length).fill(0)
  const focusWeights = new Array(nodes.length).fill(0)
  nodes.forEach((node, nodeIndex) => {
    for (let twinIndex = 0; twinIndex < ghostsPerNode; twinIndex++) {
      const instance = nodeIndex * ghostsPerNode + twinIndex
      seed[instance] = nodeSeed(node.id)
      twin[instance] = twinIndex
      radius[instance] = node.radius
      matrix.makeScale(0, 0, 0).setPosition(...node.position)
      mesh.setMatrixAt(instance, matrix)
      mesh.setColorAt(instance, activityColor.setRGB(0, 0, 0))
    }
  })
  geometry.setAttribute('ghostSeed', new THREE.InstancedBufferAttribute(seed, 1))
  geometry.setAttribute('ghostTwin', new THREE.InstancedBufferAttribute(twin, 1))
  geometry.setAttribute('ghostRadius', new THREE.InstancedBufferAttribute(radius, 1))
  geometry.setAttribute('ghostColor', tint)
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.frustumCulled = false

  const material = mesh.material as THREE.ShaderMaterial
  const writeActivity = () => {
    nodes.forEach((node, nodeIndex) => {
      const live = presenceWeights[nodeIndex]
      const visible = live > 0.001 ? node.radius : 0
      for (let twinIndex = 0; twinIndex < ghostsPerNode; twinIndex++) {
        const instance = nodeIndex * ghostsPerNode + twinIndex
        matrix.makeScale(visible, visible, visible).setPosition(...node.position)
        mesh.setMatrixAt(instance, matrix)
        mesh.setColorAt(instance, activityColor.setRGB(live, focusWeights[nodeIndex] * 0.5, 0))
      }
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }
  const setColors = (colors: THREE.Color[]) => {
    nodes.forEach((_node, nodeIndex) => {
      for (let twinIndex = 0; twinIndex < ghostsPerNode; twinIndex++) {
        const color = colors[nodeIndex]
        tint.setXYZ(nodeIndex * ghostsPerNode + twinIndex, color.r, color.g, color.b)
      }
    })
    tint.needsUpdate = true
  }
  setColors(initialColors)

  return {
    mesh,
    setColors,
    setActivity(nextLive: number[], nextFocus: number[], blend = 1) {
      let changing = false
      nodes.forEach((_node, nodeIndex) => {
        const live = nextLive[nodeIndex] ?? 0
        const focusTarget = nextFocus[nodeIndex] ?? 0
        const nextPresence = live < 0.001 ? 0 : live
        let nextFocusValue: number
        if (nextPresence <= 0) {
          // Fully invisible: reset outright so a later reappearance starts clean.
          nextFocusValue = 0
        } else {
          // Ease toward the new intensity level rather than snapping or freezing.
          // A node that stays visible while its level changes (e.g. a family
          // easing back to idle, or a selected instrument stepping up from
          // family) still needs to move; a node that is fading toward silence
          // eases at the same pace, which reads as "holding the outgoing look".
          const eased = focusWeights[nodeIndex] + (focusTarget - focusWeights[nodeIndex]) * blend
          nextFocusValue = Math.abs(eased - focusTarget) < 0.001 ? focusTarget : eased
        }
        changing ||= Math.abs(nextPresence - presenceWeights[nodeIndex]) > 0.0001
          || Math.abs(nextFocusValue - focusWeights[nodeIndex]) > 0.0001
        presenceWeights[nodeIndex] = nextPresence
        focusWeights[nodeIndex] = nextFocusValue
      })
      writeActivity()
      return changing
    },
    update(seconds: number, strength: number) {
      material.uniforms.time.value = seconds
      material.uniforms.strength.value = strength
    },
  }
}
