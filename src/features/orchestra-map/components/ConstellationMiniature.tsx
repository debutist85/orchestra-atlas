import { useId } from 'react'

import { GLOW_BLUR, GLOW_SCALE, type MiniatureNode } from '../utils/constellation-miniature'

type Props = {
  nodes: readonly MiniatureNode[]
  width?: number
  height?: number
  // A soft halo under each light, approximating the map's bloom.
  glow?: boolean
  className?: string
}

// The map's constellation in miniature, from a scene capture
// (OrchestraScene.captureConstellation): one circle per real light, in its
// own color and relative size. Decorative: no pointer events, hidden from
// assistive technology. Each circle carries data-node-id, so a later
// animation can target a specific light without recapturing.
export function ConstellationMiniature({ nodes, width = 220, height = 135, glow = true, className = '' }: Props) {
  const filterId = `constellation-glow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg className={`constellation-miniature pointer-events-none block ${className}`} width={width} height={height}
      viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      {glow && (
        <>
          <defs>
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={GLOW_BLUR} />
            </filter>
          </defs>
          <g filter={`url(#${filterId})`} opacity="0.55">
            {nodes.map(node => <circle key={node.id} cx={node.x} cy={node.y} r={node.radius * GLOW_SCALE} fill={node.color} />)}
          </g>
        </>
      )}
      <g>
        {nodes.map(node => <circle key={node.id} data-node-id={node.id} cx={node.x} cy={node.y} r={node.radius} fill={node.color} />)}
      </g>
    </svg>
  )
}
