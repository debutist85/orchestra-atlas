import * as THREE from 'three'
export { instantiateModel as instantiateInstrumentModel } from '../../../lib/model-inspector/model-resource'

// Anchor empties are authored directly in the model (see
// public/3d/violin/violin-web-anchors.glb) rather than hand-picked at
// runtime — this just finds whichever of them a given model happens to have.
export function collectAnchors(model: THREE.Object3D) {
  const anchors: THREE.Object3D[] = []
  model.traverse(child => { if (child.name.startsWith('Anchor_')) anchors.push(child) })
  return anchors
}
