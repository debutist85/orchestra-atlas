import type { CSSProperties } from 'react'

type OrchestraFanLoaderProps = {
  size?: number
  openingAngle?: number
  duration?: number
  ringCount?: number
  label?: string
  className?: string
  // Seconds into the cycle to start at, so a loader that may only show
  // briefly opens already drawn instead of on the cycle's blank start.
  startOffset?: number
  // 0..1. When set, the arcs show this progress instead of looping: they
  // fill in order from the inner ring outward, each over its share.
  progress?: number
  // Arc stroke in viewBox units (the viewBox is 340 wide): a small loader
  // needs a heavier stroke to stay visible.
  strokeWidth?: number
}

// One stroke color per ring, inner to outer.
const COLORS = ['#ffb45b', '#f18d5a', '#df5b75', '#a55cae', '#7165c9']

// The orchestra's seating fan as a loading indicator: concentric arcs that
// draw in and out from the inner ring outward. Styles and reduced motion:
// orchestra-fan-loader.css.
export function OrchestraFanLoader({
  size = 110,
  openingAngle = 130,
  duration = 2.6,
  ringCount = 5,
  label = 'Preparing instrument',
  className = '',
  startOffset = 0,
  progress,
  strokeWidth = 3.2,
}: OrchestraFanLoaderProps) {
  const count = Math.max(1, Math.min(ringCount, COLORS.length))
  const angle = Math.max(30, Math.min(openingAngle, 175))
  const halfAngle = (angle * Math.PI) / 360

  // The fan's apex, in viewBox units; arcs open upward around it.
  const cx = 170
  const cy = 193

  const arcs = Array.from({ length: count }, (_, index) => {
    const radius = 35 + index * 29
    const x1 = cx - radius * Math.sin(halfAngle)
    const x2 = cx + radius * Math.sin(halfAngle)
    const y = cy - radius * Math.cos(halfAngle)
    return {
      path: `M ${x1} ${y} A ${radius} ${radius} 0 0 1 ${x2} ${y}`,
      color: COLORS[index],
      delay: index * duration * 0.115 - startOffset,
    }
  })

  const determinate = progress !== undefined
  const value = Math.max(0, Math.min(1, progress ?? 0))
  // How much of one arc is drawn (0..1) for the given progress.
  const fillOf = (index: number) => Math.max(0, Math.min(1, value * count - index))

  return (
    <span
      className={`orchestra-fan-loader${determinate ? ' orchestra-fan-loader--progress' : ''} ${className}`}
      role={determinate ? 'progressbar' : 'status'}
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={determinate ? Math.round(value * 100) : undefined}
      style={{ width: size, '--fan-duration': `${duration}s` } as CSSProperties}
    >
      <svg viewBox="0 0 340 210" width="100%" aria-hidden="true">
        {arcs.map((arc, index) => (
          <path
            key={index}
            className="orchestra-fan-arc"
            d={arc.path}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            pathLength={1}
            style={determinate
              ? { strokeDashoffset: 1 - fillOf(index), opacity: 0.1 + 0.85 * fillOf(index) }
              : { animationDelay: `${arc.delay}s` }}
          />
        ))}
      </svg>
    </span>
  )
}
