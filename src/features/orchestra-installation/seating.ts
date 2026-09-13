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

  return strings.sections.flatMap((section, sectionIndex) => {
    const startAngle = -strings.angularSpan / 2 + sectionIndex * (wedgeSpan + gap)
    const radius = config.playerObject.radius * section.radiusScale * orchestraScale

    return section.rowCounts.flatMap((count, row) => {
      const rowRadius = (strings.innerRadius + row * strings.rowSpacing) * config.playerSpacing * orchestraScale
      return Array.from({ length: count }, (_, seat) => {
        // Half-seat margins keep adjacent wedges legible without moving their shared origin.
        const angle = (startAngle + wedgeSpan * (seat + 0.5) / count) * Math.PI / 180
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
}
