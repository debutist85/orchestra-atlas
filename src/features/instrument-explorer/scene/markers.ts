import * as THREE from 'three'

import type { Hotspot } from '../content/hotspots'
import { anatomyLabel, anatomyPositionCorrection, isAnchorIntentionallyHidden } from '../content/instrument-anatomy'
import { collectAnchors } from './instrument-model-resource'
import { createPointVisibility, projectToScreen } from '../../../lib/model-inspector'

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
  const visibility = createPointVisibility(camera)
  const worldPosition = new THREE.Vector3()

  return {
    all,
    find: (id: string | null) => id === null ? undefined : all().find(marker => marker.id === id),
    // The placed model's size, whenever it is (re)placed.
    setModelSize(size: THREE.Vector3) {
      // Stop just short of the surface so an annotation doesn't occlude itself.
      visibility.setEpsilon(Math.max(Math.max(size.x, size.y, size.z) * 0.02, 0.001))
    },
    // Called once, after the model is first placed (rotated and centered).
    attach(placed: THREE.Object3D) {
      model = placed
      visibility.setModel(placed)
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
      visibility.setPoints(all())
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
      visibility.setPoints(all())
    },
    refreshOcclusion: visibility.refresh,
    // Positions each marker's DOM button over its projected point.
    write(elements: Map<string, HTMLElement>, viewport: { width: number; height: number }) {
      for (const { id, object } of all()) {
        const element = elements.get(id)
        if (!element) continue
        // visibility (not unmounting) keeps the button out of the tab order
        // and accessibility tree while hidden behind the instrument.
        if (!visibility.isVisible(id)) { element.style.visibility = 'hidden'; continue }
        object.getWorldPosition(worldPosition)
        const { x, y } = projectToScreen(worldPosition, camera, viewport)
        element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`
        element.style.visibility = 'visible'
      }
    },
  }
}
