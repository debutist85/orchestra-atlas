import { Color, MathUtils } from 'three'
import type { OrchestraSceneConfig } from './config'
import type { OrchestraPosition } from './seating'

// Sample once when building meshes. Uses normalized section coordinates so the
// palette is stable across scales and independent of frame rate or draw order.
export function sectionNodeColors(nodes: OrchestraPosition[], config: OrchestraSceneConfig): Color[] {
  const section = config.sections[nodes[0].sectionId]
  if (!section.gradient) return nodes.map(() => new Color(section.color))
  const stops = section.gradient.map(color => new Color(color))
  const xs = nodes.map(node => node.position[0])
  const ys = nodes.map(node => node.position[1])
  const minX = Math.min(...xs), width = Math.max(...xs) - minX
  const minY = Math.min(...ys), height = Math.max(...ys) - minY
  return nodes.map(node => {
    const x = width > 0 ? (node.position[0] - minX) / width : 0.5
    const y = height > 0 ? (node.position[1] - minY) / height : 0.5
    const t = MathUtils.clamp(x + (y - 0.5) * 0.3, 0, 1) * 2
    const index = Math.min(1, Math.floor(t))
    return stops[index].clone().lerp(stops[index + 1], t - index)
  })
}
