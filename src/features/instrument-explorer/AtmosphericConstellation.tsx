import type { CSSProperties } from 'react'

// Fixed, sparse positions avoid visual changes on rerenders. Keep the middle
// mostly clear so decorative points cannot be mistaken for anatomy hotspots.
const stars = Array.from({ length: 28 }, (_, index) => {
  const seed = ((index + 1) * 2654435761) >>> 0
  let x = 4 + (seed % 920) / 10
  if (x > 34 && x < 68) x += index % 2 ? 24 : -24
  return { x, y: 6 + ((seed >>> 8) % 880) / 10, size: 2 + (seed % 8), opacity: 0.08 + (seed % 15) / 100 }
})

export function AtmosphericConstellation() {
  return <div className="instrument-atmosphere" aria-hidden="true">
    {stars.map((star, index) => <span key={index} style={{ left: `${star.x}%`, top: `${star.y}%`, width: star.size, height: star.size, opacity: star.opacity } as CSSProperties} />)}
  </div>
}
