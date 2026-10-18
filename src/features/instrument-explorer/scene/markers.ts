import * as THREE from 'three'

import type { Hotspot } from '../content/hotspots'
import { anatomyLabel, anatomyPositionCorrection, isAnchorIntentionallyHidden } from '../content/instrument-anatomy'
import { collectAnchors } from './instrument-model-resource'
import { isOccluded, projectToScreen } from './anchor-projection'

export type Marker = { id: string; label: string; object: THREE.Object3D; hotspot: boolean }
export type Markers = ReturnType<typeof createMarkers>

// Every focusable point on the model: the GLB's own Anchor_ empties and
// JSON-defined hotspots. A hotspot gets an empty Object3D parented to the
// model at its model-local position, so from then on both kinds are
// projected, occlusion-tested and focused the same way.
export function createMarkers(camera: THREE.Camera) {
  let model: THREE.Object3D | undefined
  let anchors: Marker[] = []
  let hotspotMarkers: Marker[] = []
  const hotspotObjects = new Map<string, THREE.Object3D>()
  const all = () => [...anchors, ...hotspotMarkers]
  // An anchor sits essentially ON the surface it marks, so a full-length ray
  // to it would almost always report an "intersection" with that same
  // adjacent surface. Stopping the ray just short excludes that
  // self-intersection and only catches genuinely closer, occluding geometry
  // (e.g. the body blocking an anchor rotated to the back). Scaled to the
  // model's own size once it loads.
  let occlusionEpsilon = 0.01
  const raycaster = new THREE.Raycaster()
  const worldPosition = new THREE.Vector3()

  // Whether each marker is in view. The occlusion raycast against the
  // whole mesh is by far the costliest per-frame work, so while the camera
  // moves it is spread round-robin over frames (a few markers per frame)
  // instead of all of them every frame; once the camera settles, one full
  // pass makes every marker exact. Positions are projected every frame.
  const visible = new Map<string, boolean>()
  let occlusionCursor = 0

  return {
    all,
    find: (id: string | null) => id === null ? undefined : all().find(marker => marker.id === id),
    // Called once the model is placed (rotated and centered).
    attach(placed: THREE.Object3D, size: THREE.Vector3) {
      model = placed
      occlusionEpsilon = Math.max(Math.max(size.x, size.y, size.z) * 0.02, 0.001)
      anchors = collectAnchors(placed).flatMap(object => {
        const label = anatomyLabel(object.name)
        if (!label) {
          if (import.meta.env.DEV && !isAnchorIntentionallyHidden(object.name)) console.warn(`Unlabeled instrument anchor: ${object.name}`)
          return []
        }
        const correction = anatomyPositionCorrection(object.name)
        if (correction) object.position.add(new THREE.Vector3(...correction))
        return [{ id: object.name, label, object, hotspot: false }]
      })
    },
    syncHotspots(hotspots: Hotspot[]) {
      const root = model
      if (!root) return
      const ids = new Set(hotspots.map(hotspot => hotspot.id))
      for (const [id, object] of hotspotObjects) {
        if (ids.has(id)) continue
        object.removeFromParent()
        hotspotObjects.delete(id)
      }
      hotspotMarkers = hotspots.map(hotspot => {
        let object = hotspotObjects.get(hotspot.id)
        if (!object) {
          object = new THREE.Object3D()
          object.name = `Hotspot_${hotspot.id}`
          root.add(object)
          hotspotObjects.set(hotspot.id, object)
        }
        object.position.set(...hotspot.position)
        return { id: hotspot.id, label: hotspot.title || hotspot.id, object, hotspot: true }
      })
    },
    refreshOcclusion(count: number) {
      const list = all()
      if (!model || list.length === 0) return
      for (let i = 0; i < Math.min(count, list.length); i++) {
        const { id, object } = list[occlusionCursor % list.length]
        occlusionCursor++
        object.getWorldPosition(worldPosition)
        // The camera is never parented, so its own position is already world-space.
        visible.set(id, !isOccluded(camera.position, worldPosition, model, occlusionEpsilon, raycaster))
      }
    },
    // Positions each marker's DOM button over its projected point.
    write(elements: Map<string, HTMLElement>, viewport: { width: number; height: number }) {
      for (const { id, object } of all()) {
        const element = elements.get(id)
        if (!element) continue
        // visibility (not unmounting) keeps the button out of the tab order
        // and accessibility tree while hidden behind the instrument.
        if (!visible.get(id)) { element.style.visibility = 'hidden'; continue }
        object.getWorldPosition(worldPosition)
        const { x, y } = projectToScreen(worldPosition, camera, viewport)
        element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`
        element.style.visibility = 'visible'
      }
    },
  }
}
