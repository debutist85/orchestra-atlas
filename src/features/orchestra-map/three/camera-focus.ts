import * as THREE from 'three'
import { familySections, type NavigationState } from '../utils/navigation'
import type { OrchestraPosition } from './seating'

// Fit the selected group rather than the whole orchestra. Offscreen context
// stays in the scene; a minimum distance prevents tiny groups filling the view.
export function cameraFocus(nodes: OrchestraPosition[], state: NavigationState, aspect: number, fov: number) {
  const visible = nodes.filter(node => node.visible !== false)
  const bounds = new THREE.Box3().setFromPoints(visible.map(node => new THREE.Vector3(...node.position)))
  const center = bounds.getCenter(new THREE.Vector3())
  const selected = visible.filter(node => state.level !== 'orchestra' && familySections(state.familyId).includes(node.sectionId)
    && (state.level !== 'instrument' || node.instrument === state.instrumentId))
  if (selected.length) {
    const focus = new THREE.Box3().setFromPoints(selected.map(node => new THREE.Vector3(...node.position))).getCenter(new THREE.Vector3())
    center.copy(focus)
  }
  const occupancy = state.level === 'orchestra' ? 0.72 : state.level === 'family' ? 0.9 : 0.7
  const tangent = Math.tan(THREE.MathUtils.degToRad(fov / 2))
  let distance = 0
  for (const node of selected.length ? selected : visible) {
    distance = Math.max(distance,
      (Math.abs(node.position[0] - center.x) + node.radius) / (tangent * aspect * occupancy),
      (Math.abs(node.position[1] - center.y) + node.radius) / (tangent * occupancy))
  }
  if (state.level !== 'orchestra') {
    const size = bounds.getSize(new THREE.Vector3())
    const overviewDistance = Math.max(size.x / aspect, size.y) / (2 * tangent * 0.72)
    distance = Math.max(distance, overviewDistance * (state.level === 'family' ? 0.4 : 0.22))
  }
  return { center, position: center.clone().add(new THREE.Vector3(0, 0, distance)) }
}
