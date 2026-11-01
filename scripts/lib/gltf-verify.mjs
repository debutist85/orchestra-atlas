import { readFile } from 'node:fs/promises'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import sharp from 'sharp'

// Independent geometry parsing, without WebGL or allocating decoded RGBA
// images. The shim reads image headers only; this is not a visual validation.
export async function verifyWithThree(file) {
  const saved = Object.fromEntries(['self', 'createImageBitmap', 'ProgressEvent'].map(key => [key, globalThis[key]]))
  globalThis.self = globalThis
  globalThis.createImageBitmap = async blob => {
    const metadata = await sharp(Buffer.from(await blob.arrayBuffer()), { limitInputPixels: false }).metadata()
    return { width: metadata.width, height: metadata.height, close() {} }
  }
  globalThis.ProgressEvent ??= class extends Event { constructor(type, values) { super(type); Object.assign(this, values) } }
  let gltf
  try {
    const bytes = await readFile(file)
    gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', resolve, reject))
    return gltf.scenes.map(scene => {
      let triangles = 0, draws = 0
      scene.traverse(object => {
        if (!object.isMesh) return
        const geometry = object.geometry, count = geometry.index?.count ?? geometry.getAttribute('position')?.count
        triangles += count / 3 * (object.isInstancedMesh ? object.count : 1)
        draws += geometry.groups.length || 1
      })
      return { triangles, primitiveDraws: draws }
    })
  } finally {
    const released = new Set()
    const release = value => { if (value && !released.has(value)) { released.add(value); value.dispose?.() } }
    for (const scene of gltf?.scenes ?? []) scene.traverse(object => {
      release(object.geometry)
      for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
        for (const value of Object.values(material)) if (value?.isTexture) release(value)
        release(material)
      }
    })
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
}
