import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

type ModelResource = {
  bytes?: Promise<ArrayBuffer>
  scene?: Promise<THREE.Object3D>
}

// Least recently used first (a Map keeps insertion order; a use re-inserts).
const resources = new Map<string, ModelResource>()

// Decoded models kept for quick re-entry. A decoded model holds its file
// buffer and every texture as a raw bitmap (a 1024² texture is 4 MB), so the
// heaviest instruments hold 100–270 MB each: an unbounded cache reached about
// 1.2 GB across the orchestra, past what mobile browsers allow a tab. Evicting
// only forgets the entry; instances still on screen keep their own references.
const MAX_CACHED_MODELS = 2

function resourceFor(url: string) {
  let resource = resources.get(url)
  if (resource) {
    resources.delete(url)
    resources.set(url, resource)
  } else {
    resource = {
      bytes: fetch(url).then(response => {
        if (!response.ok) throw new Error(`Unable to load instrument model: ${response.status}`)
        return response.arrayBuffer()
      }),
    }
    resources.set(url, resource)
    for (const oldest of resources.keys()) {
      if (resources.size <= MAX_CACHED_MODELS) break
      resources.delete(oldest)
    }
  }
  return resource
}

function modelPath(url: string) {
  const absolute = new URL(url, window.location.href).href
  return absolute.slice(0, absolute.lastIndexOf('/') + 1)
}

function decode(resource: ModelResource, url: string) {
  resource.scene ??= resource.bytes!.then(bytes => new Promise<THREE.Object3D>((resolve, reject) => {
    new GLTFLoader().parse(bytes, modelPath(url), gltf => resolve(gltf.scene), reject)
  })).then(scene => {
    resource.bytes = undefined
    return scene
  }).catch(error => {
    if (resources.get(url) === resource) resources.delete(url)
    throw error
  })
  return resource.scene
}

export async function instantiateModel(url: string) {
  return (await decode(resourceFor(url), url)).clone(true)
}

/** The number of decoded models the cache keeps (least recently used go). */
export const modelCacheLimit = () => MAX_CACHED_MODELS

/** Forget decoded cache entries without disposing resources shared by live models.
 * Existing instances remain usable; subsequent loads fetch/decode again.
 */
export function clearModelCache(url?: string) {
  if (url === undefined) resources.clear()
  else resources.delete(url)
}
