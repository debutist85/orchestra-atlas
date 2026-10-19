import { DebugButton } from './DebugButton'
import { useState } from 'react'

import type { OrchestraInstrument } from '../../orchestra-map/config'
import { instrumentLighting, type LightingSettings, type ToneMappingName } from '../scene/instrument-lighting'

type Props = {
  instrumentId: OrchestraInstrument
  // Applies straight to InstrumentModel.tsx's renderer/scene — no scene rebuild.
  onChange: (settings: LightingSettings) => void
}

// Dev-only section of InstrumentModel.tsx's ?debug=true panel: tune live, then
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
    <section className="lighting-controls grid gap-[0.35rem] border-t border-ivory/25 pt-[0.4rem]" aria-label="Lighting controls">
      <h3 className="m-0 text-[length:inherit] tracking-[0.08em] uppercase">Lighting · {instrumentId}</h3>
      <label className="grid gap-[0.15rem]">
        Exposure {settings.exposure.toFixed(2)}
        <input type="range" min={0.2} max={3} step={0.05} value={settings.exposure} onChange={event => change({ exposure: Number(event.target.value) })} />
      </label>
      <label className="grid gap-[0.15rem]">
        Environment {settings.environmentIntensity.toFixed(2)}
        <input type="range" min={0} max={3} step={0.05} value={settings.environmentIntensity} onChange={event => change({ environmentIntensity: Number(event.target.value) })} />
      </label>
      <label className="grid gap-[0.15rem]">
        Tone mapping
        <select value={settings.toneMapping} onChange={event => change({ toneMapping: event.target.value as ToneMappingName })}>
          <option value="neutral">PBR Neutral</option>
          <option value="aces">ACES Filmic</option>
        </select>
      </label>
      <div className="lighting-controls__row flex flex-wrap gap-[0.3rem]">
        <DebugButton type="button" onClick={() => change(instrumentLighting(instrumentId))}>Reset</DebugButton>
        <DebugButton type="button" onClick={copy}>Copy lighting</DebugButton>
      </div>
    </section>
  )
}
