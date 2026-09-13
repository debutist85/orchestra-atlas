import type {
  OrchestraFamily,
  OrchestraSceneConfig,
  OrchestraSectionId,
} from './config'
import { orchestraNodes } from './seating-data'

export type OrchestraPosition = {
  id: string
  family: OrchestraFamily
  sectionId: OrchestraSectionId
  sectionName: string
  radius: number
  position: [number, number, number]
}

export function createOrchestraPositions(config: OrchestraSceneConfig): OrchestraPosition[] {
  const { conductorOrigin, orchestraScale } = config
  const positions = orchestraNodes.map((node): OrchestraPosition => {
    const radius = node.radius * orchestraScale
    const section = config.sections[node.sectionId]
    return {
      id: node.id,
      family: section.family,
      sectionId: node.sectionId,
      sectionName: section.name,
      radius,
      position: [
        conductorOrigin[0] + node.x * orchestraScale,
        conductorOrigin[1] + radius,
        conductorOrigin[2] + node.z * orchestraScale,
      ],
    }
  })

  // Approximate a very large spherical surface with a shallow radial cap. The
  // outer edge stays on the original plane while the center moves by `height`.
  const outerRadius = Math.max(...positions.map((node) => Math.hypot(
    node.position[0] - conductorOrigin[0],
    node.position[2] - conductorOrigin[2],
  )))
  if (config.surfaceWarp.height !== 0 && outerRadius > 0) {
    for (const node of positions) {
      const radialDistance = Math.hypot(
        node.position[0] - conductorOrigin[0],
        node.position[2] - conductorOrigin[2],
      )
      const normalizedRadius = radialDistance / outerRadius
      node.position[1] += config.surfaceWarp.height
        * (1 - normalizedRadius ** 2)
        * orchestraScale
    }
  }

  // The canonical fan is stored in X/Z. Stand it upright over an X/Z stage:
  // radial depth becomes elevation and the existing warp becomes front/back depth.
  for (const node of positions) {
    const elevation = -(node.position[2] - conductorOrigin[2])
    const depth = node.position[1] - conductorOrigin[1]
    node.position[1] = conductorOrigin[1] + elevation
    node.position[2] = conductorOrigin[2] + depth
  }
  return positions
}
