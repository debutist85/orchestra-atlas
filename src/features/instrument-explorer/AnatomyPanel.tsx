import { useAnatomyStore } from '../../store/anatomy-store'
import type { OrchestraInstrument } from '../orchestra-map/config'
import { anatomyDescription, anatomyLabel } from './instrument-anatomy'
import { techniqueHasVideo, techniquesForAnatomyPart } from './technique'

type Props = { instrumentName: string; instrumentId: OrchestraInstrument }

// The instrument's own name stays visible here throughout — selecting a part
// adds its description and techniques below it, it never replaces the name.
// Back navigation is the single header Back button (OrchestraMap.tsx).
export function AnatomyPanel({ instrumentName, instrumentId }: Props) {
  const selectedPartId = useAnatomyStore(state => state.selectedPartId)
  const openPerformance = useAnatomyStore(state => state.openPerformance)

  const label = selectedPartId ? anatomyLabel(selectedPartId) : undefined
  const description = selectedPartId ? anatomyDescription(selectedPartId) : undefined
  const techniques = selectedPartId ? techniquesForAnatomyPart(selectedPartId, instrumentId) : []

  return (
    <div className={selectedPartId
      ? 'pointer-events-auto absolute inset-y-0 right-0 flex w-[var(--demo-panel-width)] flex-col overflow-hidden pt-[calc(var(--map-chrome-height)+max(1.25rem,env(safe-area-inset-top)))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[var(--map-footer-height)] text-right max-[719px]:pr-4 [background:linear-gradient(90deg,rgb(from_var(--stage-background)_r_g_b/0)_0%,var(--stage-background)_90%)]'
      : 'pointer-events-auto absolute top-[calc(var(--map-chrome-height)+max(1.25rem,env(safe-area-inset-top)))] right-[max(1.25rem,env(safe-area-inset-right))] text-right max-[719px]:right-4'}>
      <h2 className="mb-2 shrink-0 font-identity text-[clamp(2rem,6vw,6rem)] font-normal">{instrumentName}</h2>
      {selectedPartId && (
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <h3 className="mt-[0.3rem] text-[clamp(1.1rem,2.4vw,1.9rem)] font-normal">{label}</h3>
          {description && <p className="mt-[0.6rem] text-[0.65rem] leading-normal text-[#8f908a]">{description}</p>}
          {techniques.length > 0 && (
            <ul className="mt-5 list-none space-y-5 p-0">
              {techniques.map(item => (
                <li key={item.id}>
                  <h4 className="text-[clamp(1.05rem,2.2vw,1.6rem)] font-normal">{item.title}</h4>
                  <p className="mt-[0.6rem] text-[0.85rem] leading-normal text-fog">{item.description}</p>
                  {techniqueHasVideo(item) && (
                    <button
                      type="button"
                      className="mt-3 inline-block cursor-pointer border-0 bg-transparent p-0 text-[0.75rem] tracking-[0.08em] text-ivory uppercase underline underline-offset-[0.2em]"
                      aria-label={`${item.title} performance`}
                      onClick={() => openPerformance(item.id, instrumentId)}
                    >
                      Performance <span aria-hidden="true">→</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
