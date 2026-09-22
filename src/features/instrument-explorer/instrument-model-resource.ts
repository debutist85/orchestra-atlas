import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

type ModelResource = {
  bytes: Promise<ArrayBuffer>
  scene?: Promise<THREE.Object3D>
}

const resources = new Map<string, ModelResource>()

function resourceFor(url: string) {
  let resource = resources.get(url)
  if (!resource) {
    resource = {
      bytes: fetch(url).then(response => {
        if (!response.ok) throw new Error(`Unable to load instrument model: ${response.status}`)
        return response.arrayBuffer()
      }),
    }
    resources.set(url, resource)
  }
  return resource
}

function modelPath(url: string) {
  const absolute = new URL(url, window.location.href).href
  return absolute.slice(0, absolute.lastIndexOf('/') + 1)
}

function decode(resource: ModelResource, url: string) {
  resource.scene ??= resource.bytes.then(bytes => new Promise<THREE.Object3D>((resolve, reject) => {
    new GLTFLoader().parse(bytes, modelPath(url), gltf => resolve(gltf.scene), reject)
  })).catch(error => {
    resources.delete(url)
    throw error
  })
  return resource.scene
}

export async function instantiateInstrumentModel(url: string) {
  return (await decode(resourceFor(url), url)).clone(true)
}
