import { useState } from 'react'

import type { OrchestraInstrument } from '../orchestra-map/config'
import { instrumentLighting, type LightingSettings, type ToneMappingName } from './instrument-lighting'

type Props = {
  instrumentId: OrchestraInstrument
  // Applies straight to ViolinModel.tsx's renderer/scene — no scene rebuild.
  onChange: (settings: LightingSettings) => void
}

// Dev-only section of ViolinModel.tsx's ?debug=true panel: tune live, then
// paste "Copy lighting" into lightingOverrides (instrument-lighting.ts).
export function LightingControls({ instrumentId, onChange }: Props) {
  const [settings, setSettings] = useState(() => instrumentLighting(instrumentId))
  const change = (patch: Partial<LightingSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    onChange(next)
  }
  const copy = () => {
    const { toneMapping, exposure, environmentIntensity } = settings
    void navigator.clipboard?.writeText(`${instrumentId}: { toneMapping: '${toneMapping}', exposure: ${exposure}, environmentIntensity: ${environmentIntensity} },`)
  }

  return (
    <section className="lighting-controls" aria-label="Lighting controls">
      <h3>Lighting · {instrumentId}</h3>
      <label>
        Exposure {settings.exposure.toFixed(2)}
        <input type="range" min={0.2} max={3} step={0.05} value={settings.exposure} onChange={event => change({ exposure: Number(event.target.value) })} />
      </label>
      <label>
        Environment {settings.environmentIntensity.toFixed(2)}
        <input type="range" min={0} max={3} step={0.05} value={settings.environmentIntensity} onChange={event => change({ environmentIntensity: Number(event.target.value) })} />
      </label>
      <label>
        Tone mapping
        <select value={settings.toneMapping} onChange={event => change({ toneMapping: event.target.value as ToneMappingName })}>
          <option value="neutral">PBR Neutral</option>
          <option value="aces">ACES Filmic</option>
        </select>
      </label>
      <div className="lighting-controls__row">
        <button type="button" onClick={() => change(instrumentLighting(instrumentId))}>Reset</button>
        <button type="button" onClick={copy}>Copy lighting</button>
      </div>
    </section>
  )
}
