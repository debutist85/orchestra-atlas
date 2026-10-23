import type * as THREE from 'three'

type Disposable = { dispose(): void }

// A renderer attaches a 'dispose' listener to every geometry, material and
// texture it uploads, and removes it only when that resource is disposed,
// not when the renderer is. Models are clones sharing the cached resources
// (model-resource.ts), which outlive any one inspector, so without this every
// disposed renderer stays reachable from the cache. Disposing a model's
// resources frees this renderer's GPU copies and drops its listeners; the
// CPU data stays, and a later renderer uploads it again.
export function releaseModelResources(model: THREE.Object3D) {
  const released = new Set<Disposable>()
  const release = (resource: Disposable) => {
    if (released.has(resource)) return
    released.add(resource)
    resource.dispose()
  }
  model.traverse(object => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry) release(mesh.geometry)
    const material = mesh.material
    for (const item of Array.isArray(material) ? material : material ? [material] : []) {
      for (const value of Object.values(item)) {
        if (value && (value as THREE.Texture).isTexture) release(value as THREE.Texture)
      }
      release(item)
    }
  })
}
