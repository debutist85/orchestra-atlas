import * as THREE from 'three'

// Transparent radial patches suggest a lit floor without a visible plane edge,
// texture download, or shadow-map pass. The viewer keeps their orientation
// aligned to the camera so orbiting never tilts the presentation floor.
export function createInstrumentGround(size: THREE.Vector3) {
  const group = new THREE.Group()
  const geometry = new THREE.PlaneGeometry(1, 1)
  const materials: THREE.ShaderMaterial[] = []
  const patch = (color: string, opacity: number, width: number, depth: number, y: number) => {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: opacity } },
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec2 vUv;
        uniform vec3 color; uniform float opacity;
        void main() {
          float radius = length((vUv - 0.5) * 2.0);
          float falloff = pow(1.0 - smoothstep(0.0, 1.0, radius), 2.0);
          gl_FragColor = vec4(color, opacity * falloff);
          #include <colorspace_fragment>
        }`,
    })
    materials.push(material)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2
    mesh.scale.set(width, depth, 1)
    mesh.position.y = y
    group.add(mesh)
    return mesh
  }
  const floorY = -size.y / 2 - size.y * 0.006
  patch('#857b6c', 0.09, size.y * 5, size.y * 4, floorY).renderOrder = -2
  patch('#000000', 0.5, size.x * 1.5, size.y * 0.5, floorY + size.y * 0.001).renderOrder = -1
  return {
    group,
    dispose() {
      group.removeFromParent()
      geometry.dispose()
      materials.forEach(material => material.dispose())
    },
  }
}
