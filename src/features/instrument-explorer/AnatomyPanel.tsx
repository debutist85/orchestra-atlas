import type { OrchestraInstrument } from '../orchestra-map/config'
import { instrumentSummary } from './instrument-summary'

type Props = { instrumentName: string; instrumentId: OrchestraInstrument }

// Stays on the instrument stage. Part details slide in beside it
// (AnatomyDetailPanel), so this box does not change when a part is selected.
//
// The heading sits in a box exactly --explore-heading-baseline-y tall
// (min-height, so a name that wraps can still grow past it instead of
// colliding with the description), bottom-aligned with line-height 1 — the
// same box height AnatomyDetailPanel's heading uses, so both line-box
// bottoms land on the same Y despite the very different font sizes. The
// description then starts a shared, fixed gap after that box
// (--explore-description-top-y), landing at the same Y in both columns for
// the same reason. See the --explore-* comment in global.css.
export function AnatomyPanel({ instrumentName, instrumentId }: Props) {
  const summary = instrumentSummary(instrumentId)

  return (
    <div className="pointer-events-none absolute top-0 right-0 h-full w-[var(--instrument-panel-width)] pt-[calc(var(--map-chrome-height)+env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[var(--map-footer-height)] text-right max-[719px]:pr-4">
      <div className="flex min-h-[var(--explore-heading-baseline-y)] items-end">
        <h2 className="w-full font-editorial text-[clamp(2rem,6vw,6rem)] leading-none font-normal">{instrumentName}</h2>
      </div>
      {summary && (
        <p className="mt-[calc(var(--explore-description-top-y)-var(--explore-heading-baseline-y))] font-editorial text-[var(--explore-body-text-size)] leading-normal text-fog">
          {summary}
        </p>
      )}
    </div>
  )
}
