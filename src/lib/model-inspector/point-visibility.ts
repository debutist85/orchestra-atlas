import * as THREE from 'three'
import { isOccluded } from './anchor-projection'

export type InspectionPoint = { id: string; object: THREE.Object3D }

// Generic visibility cache for model-relative annotations. Meaning, labels,
// DOM, and focus policy belong to the consuming application.
export function createPointVisibility(camera: THREE.Camera) {
  let model: THREE.Object3D | undefined
  let points: InspectionPoint[] = []
  let epsilon = .01
  let invalid = true
  let remaining = 0
  let cursor = 0
  const visible = new Map<string, boolean>()
  const lastCamera = new THREE.Matrix4()
  const worldPosition = new THREE.Vector3()
  const raycaster = new THREE.Raycaster()
  return {
    setModel(root: THREE.Object3D) { model = root; invalid = true; visible.clear() },
    setPoints(next: InspectionPoint[]) {
      points = next
      invalid = true
      const ids = new Set(next.map(point => point.id))
      for (const id of visible.keys()) if (!ids.has(id)) visible.delete(id)
    },
    setEpsilon(next: number) { epsilon = next; invalid = true },
    invalidate() { invalid = true },
    isVisible: (id: string) => visible.get(id) ?? false,
    // Returns whether more frames are needed to finish the current pass.
    refresh(count = 1) {
      if (!model || !points.length) return false
      if (invalid || !lastCamera.equals(camera.matrixWorld)) {
        lastCamera.copy(camera.matrixWorld)
        remaining = points.length
        invalid = false
      }
      for (let i = 0; i < Math.min(Math.max(1, count), remaining); i++) {
        const point = points[cursor % points.length]
        cursor++
        remaining--
        point.object.getWorldPosition(worldPosition)
        visible.set(point.id, !isOccluded(camera.position, worldPosition, model, epsilon, raycaster))
      }
      return remaining > 0
    },
  }
}
