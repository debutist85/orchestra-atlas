import { liquidOrbConfig, type OrbSize } from './config'
import { orchestraSceneConfig } from '../orchestra-map/config'
import { createOrchestraPositions } from '../orchestra-map/three/seating'

const nodes = createOrchestraPositions(orchestraSceneConfig)
const sizes = Object.entries(liquidOrbConfig.prototype.sizes).map(([id, preset]) => {
  const node = nodes.find(node => node.visible !== false && node.instrument === preset.instrument)
  if (!node) throw new Error(`Missing map node for orb size: ${preset.instrument}`)
  return { id: id as OrbSize, label: preset.label, radius: node.radius }
})
const largestRadius = Math.max(...sizes.map(size => size.radius))

// The preview magnifies the map nodes equally; their authored radius ratios stay exact.
export const orbSizePresets = sizes.map(size => ({ ...size, scale: size.radius / largestRadius }))
export const orbSizeScale = (id: OrbSize) => orbSizePresets.find(size => size.id === id)!.scale
