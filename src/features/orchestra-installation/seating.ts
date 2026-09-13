import type { OrchestraFamily, OrchestraInstrument, OrchestraSceneConfig } from './config'

export type OrchestraPosition = {
  id: string
  family: OrchestraFamily
  instrument: OrchestraInstrument
  radius: number
  position: [number, number, number]
}

export function createOrchestraPositions(config: OrchestraSceneConfig): OrchestraPosition[] {
  const { conductorOrigin, orchestraScale, strings } = config
  const gap = strings.sectionGap * config.sectionSpacing
  const wedgeSpan = (strings.angularSpan - gap * (strings.sections.length - 1)) / strings.sections.length
  // Use the outer envelope of the ordinary rows, including sphere radii.
  const outerEdge = Math.max(...strings.sections.flatMap((section) =>
    section.rowCounts.flatMap((count, row) => {
      const override = section.rowOverrides?.[row]
      if (!count || override?.alignOuterEdge) return []
      const center = (strings.innerRadius + (row + (override?.rowOffset ?? 0)) * strings.rowSpacing) * config.playerSpacing
      return [(center + config.playerObject.radius * section.radiusScale * (override?.radiusScale ?? 1)) * orchestraScale]
    }),
  ))

  const positions = strings.sections.flatMap((section, sectionIndex) => {
    const startAngle = -strings.angularSpan / 2 + sectionIndex * (wedgeSpan + gap)
    const baseRadius = config.playerObject.radius * section.radiusScale * orchestraScale

    return section.rowCounts.flatMap((count, row) => {
      const override = section.rowOverrides?.[row]
      const rowNodeRadius = baseRadius * (override?.radiusScale ?? 1)
      const innerRingRadius = strings.innerRadius * config.playerSpacing * orchestraScale
      const outerAlignedOverride = Object.values(section.rowOverrides ?? {})
        .find((candidate) => candidate.alignOuterEdge)
      const outerRingRadius = outerEdge
        - baseRadius * (outerAlignedOverride?.radiusScale ?? 1)
      const rowRadius = override?.alignOuterEdge
        ? outerEdge - rowNodeRadius
        : override?.radialFraction !== undefined
          ? innerRingRadius + (outerRingRadius - innerRingRadius) * override.radialFraction
          : (strings.innerRadius + (row + (override?.rowOffset ?? 0)) * strings.rowSpacing) * config.playerSpacing * orchestraScale
      return Array.from({ length: count }, (_, seat) => seat).flatMap((seat) => {
        const merge = section.mergedSeats?.find((group) =>
          group.row === row + 1 && seat + 1 >= group.firstSeat && seat + 1 <= group.lastSeat)
        if (merge && seat + 1 !== merge.firstSeat) return []
        const lastSeat = merge?.lastSeat ?? seat + 1
        // Preserve the combined projected area and use the midpoint along the arc.
        let radiusSquared = 0
        for (let sourceSeat = seat + 1; sourceSeat <= lastSeat; sourceSeat++) {
          const sourceRadius = rowNodeRadius * (section.nodeRadiusScales?.[`${row + 1}-${sourceSeat}`] ?? 1)
          radiusSquared += sourceRadius ** 2
        }
        const radius = merge?.radiusScale !== undefined
          ? config.playerObject.radius * merge.radiusScale * orchestraScale
          : Math.sqrt(radiusSquared)
        // Half-seat margins keep adjacent wedges legible without moving their shared origin.
        let angle = (startAngle + wedgeSpan * (seat + lastSeat) / 2 / count) * Math.PI / 180
        const alignmentSeats = section.nodeAlignments?.[`${row + 1}-${seat + 1}`] ?? merge?.alignWithSeats
        if ((merge?.alignWithRowEnds || alignmentSeats) && row > 1) {
          // Fit the referenced centers, then intersect their line with this ring.
          const references = alignmentSeats
            ?? section.rowCounts.slice(0, row).map((rowCount, index) => [index + 1, rowCount])
          const points = references.map(([sourceRow, sourceSeat]) => {
            const index = sourceRow - 1
            const rowCount = section.rowCounts[index]
            const a = (startAngle + wedgeSpan * (sourceSeat - 0.5) / rowCount) * Math.PI / 180
            const r = (strings.innerRadius + index * strings.rowSpacing) * config.playerSpacing * orchestraScale
            return { x: Math.sin(a) * r, z: -Math.cos(a) * r }
          })
          const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length
          const meanZ = points.reduce((sum, point) => sum + point.z, 0) / points.length
          const slope = points.reduce((sum, point) => sum + (point.z - meanZ) * (point.x - meanX), 0)
            / points.reduce((sum, point) => sum + (point.z - meanZ) ** 2, 0)
          const intercept = meanX - slope * meanZ
          const discriminant = (slope * intercept) ** 2 - (slope ** 2 + 1) * (intercept ** 2 - rowRadius ** 2)
          const z = (-slope * intercept - Math.sqrt(Math.max(0, discriminant))) / (slope ** 2 + 1)
          angle = Math.atan2(slope * z + intercept, -z)
        }
        return {
          id: `${section.instrument}-${row + 1}-${seat + 1}`,
          family: 'strings' as const,
          instrument: section.instrument,
          radius,
          position: [
            conductorOrigin[0] + Math.sin(angle) * rowRadius,
            conductorOrigin[1] + radius,
            conductorOrigin[2] - Math.cos(angle) * rowRadius,
          ] as [number, number, number],
        }
      })
    })
  })

  for (const section of strings.sections) {
    for (const inserted of section.insertedArcNodes ?? []) {
      const afterIndex = positions.findIndex((node) => node.id === inserted.after)
      if (afterIndex < 0) continue
      const anchor = positions[afterIndex]
      positions.splice(afterIndex + 1, 0, {
        id: inserted.id,
        family: anchor.family,
        instrument: anchor.instrument,
        radius: config.playerObject.radius * inserted.radiusScale * orchestraScale,
        position: [...anchor.position],
      })
    }
  }

  for (const section of strings.sections) {
    for (const [seat, constraint] of Object.entries(section.arcNeighbors ?? {})) {
      const node = positions.find((position) => position.id === `${section.instrument}-${seat}`)
      const neighbor = positions.find((position) => position.id === `${section.instrument}-${constraint.seat}`)
      if (!node || !neighbor) continue
      const x = node.position[0] - conductorOrigin[0]
      const z = node.position[2] - conductorOrigin[2]
      const ringRadius = Math.hypot(x, z)
      const neighborAngle = Math.atan2(neighbor.position[0] - conductorOrigin[0], -(neighbor.position[2] - conductorOrigin[2]))
      const direction = Math.sign(Math.atan2(x, -z) - neighborAngle) || 1
      const separation = node.radius + neighbor.radius + constraint.gap * orchestraScale
      const angle = neighborAngle + direction * 2 * Math.asin(Math.min(1, separation / (2 * ringRadius)))
      node.position[0] = conductorOrigin[0] + Math.sin(angle) * ringRadius
      node.position[2] = conductorOrigin[2] - Math.cos(angle) * ringRadius
    }
  }
  for (const ids of config.equalArcSpacing ?? []) {
    const nodes = ids.map((id) => positions.find((node) => node.id === id))
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (nodes.length < 3 || !first || !last || nodes.some((node) => !node)) continue
    const angleOf = (node: OrchestraPosition) => Math.atan2(
      node.position[0] - conductorOrigin[0], -(node.position[2] - conductorOrigin[2]))
    const start = angleOf(first)
    const sweep = Math.atan2(Math.sin(angleOf(last) - start), Math.cos(angleOf(last) - start))
    const ringRadius = Math.hypot(first.position[0] - conductorOrigin[0], first.position[2] - conductorOrigin[2])
    nodes.slice(1, -1).forEach((node, index) => {
      if (!node) return
      const angle = start + sweep * (index + 1) / (nodes.length - 1)
      node.position[0] = conductorOrigin[0] + Math.sin(angle) * ringRadius
      node.position[2] = conductorOrigin[2] - Math.cos(angle) * ringRadius
    })
  }
  // Use final positions so spacing edits are reflected in the alignment.
  for (const [id, references] of Object.entries(config.finalCenterlines ?? {})) {
    const node = positions.find((candidate) => candidate.id === id)
    const points = references.flatMap((reference) => {
      const point = positions.find((candidate) => candidate.id === reference)
      return point ? [{ x: point.position[0] - conductorOrigin[0], z: point.position[2] - conductorOrigin[2] }] : []
    })
    if (!node || points.length < 2) continue
    const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length
    const meanZ = points.reduce((sum, point) => sum + point.z, 0) / points.length
    const variance = points.reduce((sum, point) => sum + (point.z - meanZ) ** 2, 0)
    if (variance < 1e-12) continue
    const slope = points.reduce((sum, point) => sum + (point.z - meanZ) * (point.x - meanX), 0) / variance
    const intercept = meanX - slope * meanZ
    const radius = Math.hypot(node.position[0] - conductorOrigin[0], node.position[2] - conductorOrigin[2])
    const discriminant = (slope * intercept) ** 2 - (slope ** 2 + 1) * (intercept ** 2 - radius ** 2)
    if (discriminant < 0) continue
    const z = (-slope * intercept - Math.sqrt(discriminant)) / (slope ** 2 + 1)
    node.position[0] = conductorOrigin[0] + slope * z + intercept
    node.position[2] = conductorOrigin[2] + z
  }
  for (const ids of config.finalArcSpacing ?? []) {
    const nodes = ids.map((id) => positions.find((node) => node.id === id))
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (nodes.length < 3 || !first || !last || nodes.some((node) => !node)) continue
    const angleOf = (node: OrchestraPosition) => Math.atan2(
      node.position[0] - conductorOrigin[0], -(node.position[2] - conductorOrigin[2]))
    const start = angleOf(first)
    const sweep = Math.atan2(Math.sin(angleOf(last) - start), Math.cos(angleOf(last) - start))
    const ringRadius = Math.hypot(first.position[0] - conductorOrigin[0], first.position[2] - conductorOrigin[2])
    nodes.slice(1, -1).forEach((node, index) => {
      if (!node) return
      const angle = start + sweep * (index + 1) / (nodes.length - 1)
      node.position[0] = conductorOrigin[0] + Math.sin(angle) * ringRadius
      node.position[2] = conductorOrigin[2] - Math.cos(angle) * ringRadius
    })
  }
  // Resolve midpoint constraints after neighboring nodes have been aligned.
  for (const section of strings.sections) {
    for (const [seat, neighbors] of Object.entries(section.arcMidpoints ?? {})) {
      const node = positions.find((position) => position.id === `${section.instrument}-${seat}`)
      const endpoints = neighbors.map((neighbor) =>
        positions.find((position) => position.id === `${section.instrument}-${neighbor}`))
      if (!node || !endpoints[0] || !endpoints[1]) continue
      const [left, right] = endpoints
      const x = (left.position[0] + right.position[0]) / 2 - conductorOrigin[0]
      const z = (left.position[2] + right.position[2]) / 2 - conductorOrigin[2]
      const distance = Math.hypot(x, z)
      if (distance === 0) continue
      const radius = Math.hypot(node.position[0] - conductorOrigin[0], node.position[2] - conductorOrigin[2])
      node.position[0] = conductorOrigin[0] + x / distance * radius
      node.position[2] = conductorOrigin[2] + z / distance * radius
    }
  }
  for (const group of config.mergedNodeGroups ?? []) {
    const sources = group.sources.map((id) => positions.find((node) => node.id === id))
    const endpoints = group.endpoints.map((id) => positions.find((node) => node.id === id))
    if (!sources[0] || !sources[1] || !endpoints[0] || !endpoints[1]) continue
    const [sourceA, sourceB] = sources
    const [first, last] = endpoints
    const start = Math.atan2(
      first.position[0] - conductorOrigin[0], -(first.position[2] - conductorOrigin[2]))
    const end = Math.atan2(
      last.position[0] - conductorOrigin[0], -(last.position[2] - conductorOrigin[2]))
    const sweep = Math.atan2(Math.sin(end - start), Math.cos(end - start))
    const ringRadius = Math.hypot(
      first.position[0] - conductorOrigin[0], first.position[2] - conductorOrigin[2])
    const angle = start + sweep / 2
    const spacingScale = group.spacingScale ?? 1
    const setAngle = (node: OrchestraPosition, targetAngle: number) => {
      node.position[0] = conductorOrigin[0] + Math.sin(targetAngle) * ringRadius
      node.position[2] = conductorOrigin[2] - Math.cos(targetAngle) * ringRadius
    }
    setAngle(first, angle - sweep / 2 * spacingScale)
    setAngle(last, angle + sweep / 2 * spacingScale)
    const sourceIndex = positions.indexOf(sourceA)
    const mergedRadius = Math.hypot(sourceA.radius, sourceB.radius) * group.radiusScale
    if (group.equalizeRadii) {
      first.radius = mergedRadius
      first.position[1] = conductorOrigin[1] + mergedRadius
      last.radius = mergedRadius
      last.position[1] = conductorOrigin[1] + mergedRadius
    }
    positions.splice(sourceIndex, 0, {
      id: group.id,
      family: first.family,
      instrument: first.instrument,
      radius: mergedRadius,
      position: [
        conductorOrigin[0] + Math.sin(angle) * ringRadius,
        conductorOrigin[1] + mergedRadius,
        conductorOrigin[2] - Math.cos(angle) * ringRadius,
      ],
    })
    for (const source of [sourceA, sourceB]) positions.splice(positions.indexOf(source), 1)
  }
  for (const group of config.anchoredArcCompression ?? []) {
    const anchor = positions.find((node) => node.id === group.anchor)
    if (!anchor) continue
    const anchorAngle = Math.atan2(
      anchor.position[0] - conductorOrigin[0], -(anchor.position[2] - conductorOrigin[2]))
    for (const id of group.ids) {
      const node = positions.find((candidate) => candidate.id === id)
      if (!node || node === anchor) continue
      const x = node.position[0] - conductorOrigin[0]
      const z = node.position[2] - conductorOrigin[2]
      const ringRadius = Math.hypot(x, z)
      const angle = Math.atan2(x, -z)
      const difference = Math.atan2(Math.sin(angle - anchorAngle), Math.cos(angle - anchorAngle))
      const compressedAngle = anchorAngle + difference * group.scale
      node.position[0] = conductorOrigin[0] + Math.sin(compressedAngle) * ringRadius
      node.position[2] = conductorOrigin[2] - Math.cos(compressedAngle) * ringRadius
    }
  }
  for (const group of config.centeredArcSpacing ?? []) {
    const nodes = group.ids.map((id) => positions.find((node) => node.id === id))
    if (!nodes[0] || !nodes[1] || !nodes[2]) continue
    const [first, center, last] = nodes
    const centerX = center.position[0] - conductorOrigin[0]
    const centerZ = center.position[2] - conductorOrigin[2]
    const ringRadius = Math.hypot(centerX, centerZ)
    const centerAngle = Math.atan2(centerX, -centerZ)
    const spacingReferences = (group.matchSpacingOf ?? []).flatMap((id) => {
      const node = positions.find((candidate) => candidate.id === id)
      return node ? [node] : []
    })
    const referenceDistances = spacingReferences.slice(1).map((node, index) =>
      Math.hypot(...node.position.map((value, axis) =>
        value - spacingReferences[index].position[axis])))
    const matchedSpacing = referenceDistances.length
      ? referenceDistances.reduce((sum, distance) => sum + distance, 0) / referenceDistances.length
      : undefined
    const setBesideCenter = (node: OrchestraPosition, direction: number) => {
      const separation = matchedSpacing
        ?? node.radius + center.radius + (group.gap ?? 0) * orchestraScale
      const offset = 2 * Math.asin(Math.min(1, separation / (2 * ringRadius)))
      const angle = centerAngle + direction * offset
      node.position[0] = conductorOrigin[0] + Math.sin(angle) * ringRadius
      node.position[2] = conductorOrigin[2] - Math.cos(angle) * ringRadius
    }
    setBesideCenter(first, -1)
    setBesideCenter(last, 1)
  }
  return positions.filter((node) => {
    const section = strings.sections.find((candidate) => candidate.instrument === node.instrument)
    const hiddenBySection = section?.hiddenSeats?.some(
      (seat) => node.id === `${node.instrument}-${seat}`)
    return !hiddenBySection && !config.hiddenNodeIds?.includes(node.id)
  })
}
