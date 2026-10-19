import * as THREE from 'three'

// Let the browser paint the loading hint between uploads. One individual
// texture upload cannot be interrupted, but the whole model needn't occupy
// one frame. Resources stay in this renderer's GPU cache for its first draw.
const yieldToPaint = () => new Promise<void>(resolve => {
  requestAnimationFrame(() => { setTimeout(resolve, 0) })
})

export async function prepareModel(
  renderer: Pick<THREE.WebGLRenderer, 'initTexture' | 'compileAsync'>,
  model: THREE.Object3D,
  scene: THREE.Scene,
  camera: THREE.Camera,
  cancelled: () => boolean,
  yieldFrame = yieldToPaint,
) {
  const textures = new Set<THREE.Texture>()
  model.traverse(object => {
    const material = (object as THREE.Mesh).material
    for (const item of Array.isArray(material) ? material : material ? [material] : []) {
      for (const value of Object.values(item)) {
        if (value && (value as THREE.Texture).isTexture) textures.add(value as THREE.Texture)
      }
    }
  })
  for (const texture of textures) {
    await yieldFrame()
    if (cancelled()) return false
    renderer.initTexture(texture)
  }
  await yieldFrame()
  if (cancelled()) return false
  await renderer.compileAsync(model, camera, scene)
  return !cancelled()
}
