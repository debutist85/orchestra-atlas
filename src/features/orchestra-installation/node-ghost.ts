import * as THREE from 'three'
import type { OrchestraPosition } from './seating'
import type { OrchestraSceneConfig } from './config'
import { nodeSeed } from './node-material'

export function createNodeGhosts(
  nodes: OrchestraPosition[],
  config: OrchestraSceneConfig,
  initialColors: THREE.Color[],
) {
  const settings = config.visuals.nodes.ghost
  const instanceCount = nodes.length * 2
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
      intervalSeconds: { value: Math.max(1, settings.intervalSeconds) },
      durationSeconds: { value: Math.max(0.1, settings.durationSeconds) },
      ghostOpacity: { value: settings.opacity },
      offsetScale: { value: settings.offset },
    },
    vertexShader: `attribute float ghostSeed, ghostTwin, ghostRadius;
      attribute vec3 ghostColor;
      uniform float time, strength, intervalSeconds, durationSeconds, offsetScale;
      varying vec2 point; varying float opacity; varying vec3 color;
      float random(float value) { return fract(sin(value * 91.3458) * 47453.5453); }
      void main() {
        point = uv * 2.0 - 1.0;
        float interval = intervalSeconds * (0.85 + ghostSeed * 0.5);
        float clock = time + ghostSeed * interval + interval - ghostTwin * durationSeconds * 0.35;
        float cycle = floor(clock / interval);
        float elapsed = mod(clock, interval);
        float duration = min(interval * 0.5, durationSeconds);
        float envelope = elapsed < duration ? pow(sin(3.14159265 * elapsed / duration), 2.0) : 0.0;
        opacity = envelope * strength;
        color = ghostColor * (0.85 + random(ghostSeed + cycle * 0.371 + ghostTwin * 0.719) * 0.3);
        float direction = random(ghostSeed + cycle * 0.173) * 6.2831853 + ghostTwin * 1.1;
        float offset = ghostRadius * offsetScale * (0.7 + 0.3 * envelope);
        vec4 transformed = instanceMatrix * vec4(position, 1.0);
        transformed.xy += vec2(cos(direction) * offset, sin(direction) * offset * 0.5);
        transformed.z -= ghostRadius * 0.15;
        gl_Position = projectionMatrix * modelViewMatrix * transformed;
        if (opacity < 0.001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: `varying vec2 point; varying float opacity; varying vec3 color;
      uniform float ghostOpacity;
      void main() {
        float feather = 1.0 - smoothstep(0.45, 1.0, length(point));
        gl_FragColor = vec4(color, opacity * ghostOpacity * feather);
      }`,
  }), instanceCount)
  const matrix = new THREE.Matrix4()
  nodes.forEach((node, nodeIndex) => {
    for (let twinIndex = 0; twinIndex < 2; twinIndex++) {
      const instance = nodeIndex * 2 + twinIndex
      seed[instance] = nodeSeed(node.id)
      twin[instance] = twinIndex
      radius[instance] = node.radius
      matrix.makeScale(node.radius, node.radius, node.radius).setPosition(...node.position)
      mesh.setMatrixAt(instance, matrix)
    }
  })
  geometry.setAttribute('ghostSeed', new THREE.InstancedBufferAttribute(seed, 1))
  geometry.setAttribute('ghostTwin', new THREE.InstancedBufferAttribute(twin, 1))
  geometry.setAttribute('ghostRadius', new THREE.InstancedBufferAttribute(radius, 1))
  geometry.setAttribute('ghostColor', tint)
  mesh.instanceMatrix.needsUpdate = true
  mesh.frustumCulled = false

  const material = mesh.material as THREE.ShaderMaterial
  const setColors = (colors: THREE.Color[]) => {
    nodes.forEach((_node, nodeIndex) => {
      for (let twinIndex = 0; twinIndex < 2; twinIndex++) {
        const color = colors[nodeIndex]
        tint.setXYZ(nodeIndex * 2 + twinIndex, color.r, color.g, color.b)
      }
    })
    tint.needsUpdate = true
  }
  setColors(initialColors)

  return {
    mesh,
    setColors,
    update(seconds: number, strength: number) {
      material.uniforms.time.value = seconds
      material.uniforms.strength.value = strength
    },
  }
}
