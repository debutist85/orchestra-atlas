import type { OrchestraInstrument } from '../orchestra-map/config'
import { instrumentSummary } from './instrument-summary'

type Props = { instrumentName: string; instrumentId: OrchestraInstrument }

// Stays on the instrument stage. Part details slide in beside it
// (AnatomyDetailPanel), so this box does not change when a part is selected.
export function AnatomyPanel({ instrumentName, instrumentId }: Props) {
  const summary = instrumentSummary(instrumentId)

  return (
    <div className="pointer-events-none absolute top-0 right-0 h-full w-[var(--demo-panel-width)] pt-[calc(var(--map-chrome-height)+env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[var(--map-footer-height)] text-right max-[719px]:pr-4">
      <h2 className="mb-2 font-identity text-[clamp(2rem,6vw,6rem)] font-normal">{instrumentName}</h2>
      {summary && <p className="text-[0.85rem] leading-normal text-fog">{summary}</p>}
    </div>
  )
}
