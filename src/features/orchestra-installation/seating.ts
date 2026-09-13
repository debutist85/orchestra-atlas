import type { OrchestraFamily, OrchestraSceneConfig, OrchestraSectionId } from './config'

export type OrchestraPosition = {
  id: string
  family: OrchestraFamily
  sectionId: OrchestraSectionId
  sectionName: string
  radius: number
  visible?: boolean
  ringIndex?: number
  spokeIndex?: number
  position: [number, number, number]
}

export type PolarGridNode = {
  id: string
  ringIndex: number
  spokeIndex: number
  radius: number
  angle: number
}

// Domain geometry only: no instrument counts, visibility rules, or visual sizes.
export function generatePolarGrid(grid: OrchestraSceneConfig['polarGrid']): PolarGridNode[] {
  if (!Number.isInteger(grid.ringCount) || grid.ringCount < 1
    || !Number.isInteger(grid.spokeCount) || grid.spokeCount < 2
    || !Number.isFinite(grid.innerRadius) || grid.innerRadius <= 0
    || !Number.isFinite(grid.radialSpacing) || grid.radialSpacing <= 0
    || !Number.isFinite(grid.fanStartAngle) || !Number.isFinite(grid.fanEndAngle)
    || grid.fanEndAngle <= grid.fanStartAngle) throw new Error('Invalid polar grid parameters')
  const step = (grid.fanEndAngle - grid.fanStartAngle) / (grid.spokeCount - 1)
  return Array.from({ length: grid.ringCount }, (_, ringIndex) =>
    Array.from({ length: grid.spokeCount }, (_, spokeIndex) => ({
      id: `grid-r${ringIndex}-s${spokeIndex}`, ringIndex, spokeIndex,
      radius: grid.innerRadius + ringIndex * grid.radialSpacing,
      angle: (grid.fanStartAngle + spokeIndex * step) * Math.PI / 180,
    })),
  ).flat()
}

// Exact planar construction: same transform for the lattice and its guides.
export function ringPoint(config: OrchestraSceneConfig, radius: number, angle: number): [number, number, number] {
  const [x, y, z] = config.conductorOrigin
  return [x + Math.sin(angle) * radius * config.orchestraScale,
    y + Math.cos(angle) * radius * config.orchestraScale, z]
}

export function createOrchestraPositions(config: OrchestraSceneConfig): OrchestraPosition[] {
  const radius = config.polarGrid.nodeRadius * config.orchestraScale
  if (!Number.isFinite(radius) || radius <= 0) throw new Error('Invalid grid node radius')
  // Build the geometry first; semantic overrides cannot change its placement.
  const section = config.sections.grid
  const nodes: OrchestraPosition[] = generatePolarGrid(config.polarGrid).map(node => ({
    id: node.id, ringIndex: node.ringIndex, spokeIndex: node.spokeIndex,
    sectionId: 'grid', family: section.family, sectionName: section.name,
    radius, position: ringPoint(config, node.radius, node.angle),
  }))
  // Optional origin marker is not a seating intersection; it uses the same size.
  nodes.push({ id: 'conductor', sectionId: 'conductor', family: config.sections.conductor.family,
    sectionName: config.sections.conductor.name, radius, position: [...config.conductorOrigin] })
  // Visibility is a separate layer; retain every generated position and its order.
  const hidden = new Set(config.hiddenNodeIds)
  return nodes.map(node => {
    const sectionId = node.id === 'conductor' ? 'conductor' : config.nodeSections[node.id] ?? config.defaultNodeSection
    const metadata = config.sections[sectionId]
    const sizeMultiplier = config.nodeSizeMultipliers[node.id] ?? 1
    if (!Number.isFinite(sizeMultiplier) || sizeMultiplier <= 0) throw new Error(`Invalid size multiplier: ${node.id}`)
    return { ...node, sectionId, family: metadata.family, sectionName: metadata.name,
      radius: node.radius * sizeMultiplier,
      visible: !hidden.has(node.id) && (node.id !== 'conductor' || config.showConductor),
    }
  })
}
