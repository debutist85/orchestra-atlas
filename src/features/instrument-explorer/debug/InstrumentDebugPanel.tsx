import { useEffect, useRef } from 'react'
import * as THREE from 'three'

import type { OrchestraInstrument } from '../../orchestra-map/config'
import type { CameraReadout, DebugBridge } from './debug-bridge'
import { roundVec3 } from '../content/hotspots'
import { HotspotEditor } from './HotspotEditor'
import { LightingControls } from './LightingControls'
import { ModelPoseControls } from './ModelPoseControls'

type Props = { instrumentId: OrchestraInstrument; rotation: readonly [number, number, number]; bridge: DebugBridge }

const fixed = (values: readonly number[]) => values.map(n => n.toFixed(4)).join(', ')
const degrees = (radians: number) => THREE.MathUtils.radToDeg(radians).toFixed(1)
const formatReadout = ({ target, position, azimuth, polar, distance }: CameraReadout) =>
  `target:   ${fixed(target)}\nposition: ${fixed(position)}\nazimuth ${degrees(azimuth)}°  polar ${degrees(polar)}°  distance ${distance.toFixed(4)}`

// Dev-only (?debug=true) tools for any instrument with a model: the live
// camera, with a ready-to-paste CameraPreset for anatomy-camera.ts (how a
// part gets a composed angle instead of the automatic close-up), plus
// lighting and hotspot editing.
export function InstrumentDebugPanel({ instrumentId, rotation, bridge }: Props) {
  const readoutRef = useRef<HTMLPreElement>(null)
  // Written straight to the DOM: it changes every frame of a drag.
  useEffect(() => bridge.onCamera(readout => {
    if (readoutRef.current) readoutRef.current.textContent = formatReadout(readout)
  }), [bridge])

  const copyPreset = () => {
    const camera = bridge.camera()
    if (camera) void navigator.clipboard?.writeText(`{ target: [${fixed(camera.target)}], position: [${fixed(camera.position)}] }`)
  }
  const captureView = () => {
    const camera = bridge.camera()
    return camera && { orientation: camera.orientation, preset: { target: roundVec3(camera.target), position: roundVec3(camera.position) } }
  }

  return (
    <div className="instrument-explore__debug">
      <pre ref={readoutRef} />
      <button type="button" onClick={copyPreset}>Copy camera preset</button>
      <ModelPoseControls key={instrumentId} instrumentId={instrumentId} rotation={rotation} onChange={pose => bridge.target()?.setModelRotation(pose)} />
      <LightingControls key={instrumentId} instrumentId={instrumentId} onChange={settings => bridge.target()?.applyLighting(settings)} />
      <HotspotEditor instrumentId={instrumentId} captureView={captureView} preview={id => bridge.target()?.previewPart(id)} />
    </div>
  )
}
