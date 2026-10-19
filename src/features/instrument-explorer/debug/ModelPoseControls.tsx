import { useState } from 'react'
import * as THREE from 'three'

import type { OrchestraInstrument } from '../../orchestra-map/config'

type Rotation = readonly [number, number, number]
type Props = {
  instrumentId: OrchestraInstrument
  // The configured pose (modelRotations in content/explorable-instruments.ts).
  rotation: Rotation
  // Re-places the live model — no reload.
  onChange: (rotation: Rotation) => void
}

const axes = ['X', 'Y', 'Z'] as const
const toDegrees = (rotation: Rotation) => rotation.map(n => Math.round(THREE.MathUtils.radToDeg(n))) as [number, number, number]

// Dev-only section of the ?debug=true panel: the model's initial rotation —
// how it faces the visitor when Explore opens. Tune live, then paste "Copy
// rotation" into modelRotations (content/explorable-instruments.ts).
// Anatomy camera presets and captured hotspot views are world-space, so an
// instrument that has any needs them re-captured after its pose changes.
export function ModelPoseControls({ instrumentId, rotation, onChange }: Props) {
  const [degrees, setDegrees] = useState(() => toDegrees(rotation))
  const apply = (next: [number, number, number]) => {
    setDegrees(next)
    onChange(next.map(n => THREE.MathUtils.degToRad(n)) as [number, number, number])
  }
  const copy = () => {
    const radians = degrees.map(n => THREE.MathUtils.degToRad(n).toFixed(4)).join(', ')
    void navigator.clipboard?.writeText(`${instrumentId}: [${radians}],`)
  }

  return (
    <section className="lighting-controls" aria-label="Initial rotation">
      <h3>Initial rotation · {instrumentId}</h3>
      {axes.map((axis, index) => (
        <label key={axis}>
          {axis} {degrees[index]}°
          <input
            type="range" min={-180} max={180} step={1} value={degrees[index]}
            onChange={event => apply(degrees.map((value, i) => i === index ? Number(event.target.value) : value) as [number, number, number])}
          />
        </label>
      ))}
      <div className="lighting-controls__row">
        <button type="button" onClick={() => apply(toDegrees(rotation))}>Reset</button>
        <button type="button" onClick={copy}>Copy rotation</button>
      </div>
    </section>
  )
}
