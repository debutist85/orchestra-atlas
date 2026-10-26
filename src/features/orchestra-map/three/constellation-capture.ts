import * as THREE from 'three'

import type { OrchestraSceneConfig } from '../config'
import { constellationScope } from '../utils/constellation-scope'
import { buildMiniature, DEFAULT_MINIATURE_FRAME, type ConstellationMiniatureData, type MiniatureFrame, type ProjectedNode } from '../utils/constellation-miniature'
import { navigationPath } from '../utils/navigation-path'
import type { NavigationState } from '../utils/navigation'
import type { OrchestraPosition } from './seating'
import { nodeBaseColor } from './section-palette'
import { invitationPreference } from '../utils/constellation-invitation'

// The instanced meshes the lights are drawn with, one per section, and the
// nodes in instance order.
export type CaptureGroup = { nodes: readonly OrchestraPosition[]; mesh: THREE.InstancedMesh }

const instance = new THREE.Matrix4()
const world = new THREE.Vector3()
const projected = new THREE.Vector3()
const edge = new THREE.Vector3()
const right = new THREE.Vector3()

// Projects the view's constellation (constellation-scope.ts) through the
// scene's own camera, as the visitor sees it, and fits it into a miniature
// frame. Positions come from the meshes' instance matrices under their
// world transforms, so this follows wherever the scene actually draws the
// lights; size is each light's resting radius (not its idle pulse). Lights
// outside the camera's clip range are left out. Read-only: the camera and
// nodes are not moved. Call it once the view has settled, not per frame.
export function captureConstellation(input: {
  config: OrchestraSceneConfig
  navigation: NavigationState
  groups: readonly CaptureGroup[]
  camera: THREE.Camera
  viewport: { width: number; height: number }
  frame?: MiniatureFrame
}): ConstellationMiniatureData {
  const { camera, viewport } = input
  camera.updateMatrixWorld()
  const positions = input.groups.flatMap(group => group.nodes)
  const wanted = new Map(constellationScope(input.config, input.navigation, positions).map(({ node, tier }) => [node.id, tier]))
  // Screen-right in world space, to measure a light's projected radius.
  right.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
  const nodes: ProjectedNode[] = []
  for (const { nodes: groupNodes, mesh } of input.groups) {
    mesh.updateWorldMatrix(true, false)
    const worldScale = mesh.matrixWorld.getMaxScaleOnAxis()
    groupNodes.forEach((node, index) => {
      if (!wanted.has(node.id) || index >= mesh.count) return
      mesh.getMatrixAt(index, instance)
      world.setFromMatrixPosition(instance).applyMatrix4(mesh.matrixWorld)
      projected.copy(world).project(camera)
      if (projected.z < -1 || projected.z > 1) return
      edge.copy(right).multiplyScalar(node.radius * worldScale).add(world).project(camera)
      const x = (projected.x + 1) * viewport.width / 2
      const y = (1 - projected.y) * viewport.height / 2
      nodes.push({
        id: node.id,
        sectionId: node.sectionId,
        instrument: node.instrument,
        x, y,
        radius: Math.hypot((edge.x - projected.x) * viewport.width / 2, (edge.y - projected.y) * viewport.height / 2),
        color: nodeBaseColor(node, input.config),
        tier: wanted.get(node.id),
      })
    })
  }
  const frame = input.frame ?? DEFAULT_MINIATURE_FRAME
  return { key: navigationPath(input.navigation), navigation: input.navigation, frame, ...buildMiniature(nodes, frame, invitationPreference(input.navigation)) }
}
