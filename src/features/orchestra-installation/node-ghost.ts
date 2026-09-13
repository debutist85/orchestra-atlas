import * as THREE from 'three'
import type { OrchestraPosition } from './seating'
import type { OrchestraSceneConfig } from './config'
import { nodeSeed } from './node-material'

export function createNodeGhosts(nodes: OrchestraPosition[], config: OrchestraSceneConfig) {
  const settings = config.visuals.nodes.ghost
  const geometry = new THREE.PlaneGeometry(2.5, 2.5)
  const alpha = new THREE.InstancedBufferAttribute(new Float32Array(nodes.length * 2), 1)
  const tint = new THREE.InstancedBufferAttribute(new Float32Array(nodes.length * 6), 3)
  geometry.setAttribute('ghostAlpha', alpha)
  geometry.setAttribute('ghostColor', tint)
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `attribute float ghostAlpha; attribute vec3 ghostColor;
      varying vec2 point; varying float opacity; varying vec3 color;
      void main() { point = uv * 2.0 - 1.0; opacity = ghostAlpha; color = ghostColor;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 point; varying float opacity; varying vec3 color;
      void main() { float r = length(point);
        float feather = 1.0 - smoothstep(0.45, 1.0, r);
        gl_FragColor = vec4(color, opacity * feather); }`,
  })
  const mesh = new THREE.InstancedMesh(geometry, material, nodes.length * 2)
  // Offsets vary over time, so don't rely on the initial instance bounds.
  mesh.frustumCulled = false
  mesh.visible = false
  const matrix = new THREE.Matrix4()
  return {
    mesh,
    update(seconds: number, colors: THREE.Color[], strength: number) {
      let visible = false
      nodes.forEach((node, index) => {
        for (let twin = 0; twin < 2; twin++) {
        const seed = nodeSeed(node.id)
        const interval = Math.max(1, settings.intervalSeconds) * (0.85 + seed * 0.5)
        // The second echo trails the first, allowing a gentle overlap.
        const clock = seconds + seed * interval + interval - twin * settings.durationSeconds * 0.35
        const cycle = Math.floor(clock / interval)
        const elapsed = clock % interval
        const duration = Math.min(interval * 0.5, Math.max(0.1, settings.durationSeconds))
        const envelope = elapsed < duration ? Math.sin(Math.PI * elapsed / duration) ** 2 : 0
        const direction = nodeSeed(`${node.id}-${cycle}`) * Math.PI * 2 + twin * 1.1
        const offset = node.radius * settings.offset * (0.7 + 0.3 * envelope)
        matrix.makeScale(node.radius, node.radius, node.radius).setPosition(
          node.position[0] + Math.cos(direction) * offset,
          node.position[1] + Math.sin(direction) * offset * 0.5,
          node.position[2] - node.radius * 0.15,
        )
        const instance = index * 2 + twin
        const shade = 0.85 + nodeSeed(`${node.id}-${cycle}-${twin}-shade`) * 0.3
        mesh.setMatrixAt(instance, matrix)
        alpha.setX(instance, envelope * settings.opacity * strength)
        tint.setXYZ(instance, colors[index].r * shade, colors[index].g * shade, colors[index].b * shade)
        visible ||= envelope * strength > 0.001
        }
      })
      mesh.visible = visible
      mesh.instanceMatrix.needsUpdate = true
      alpha.needsUpdate = true
      tint.needsUpdate = true
    },
  }
}
