import { PanelBoundary } from './PanelBoundary'
import { InstrumentEngraving } from './InstrumentEngraving'
import { useState } from 'react'

import { useAnatomyStore } from '../../store/anatomy-store'
import type { OrchestraInstrument } from '../orchestra-map/config'
import { anatomyDescription, anatomyLabel } from './instrument-anatomy'
import { techniqueHasVideo, techniquesForAnatomyPart } from './technique'

type Props = { instrumentId: OrchestraInstrument }

// A flex child of .instrument-explore__rail. The rail, not this panel,
// slides: closed off-screen, Anatomy revealed, then Demonstration docked
// at the outer edge with Anatomy carried beside it. This stays mounted
// while Explore is open so the first part selection has a closed rail to
// animate. The last part stays rendered during the slide back out.
export function AnatomyDetailPanel({ instrumentId }: Props) {
  const selectedPartId = useAnatomyStore(state => state.selectedPartId)
  const demonstrationOpen = useAnatomyStore(state => state.demonstrationOpen)
  const selectedTechniqueId = useAnatomyStore(state => state.selectedTechniqueId)
  const openPerformance = useAnatomyStore(state => state.openPerformance)
  const returnToInstrument = useAnatomyStore(state => state.returnToInstrument)
  const [shownPartId, setShownPartId] = useState<string | null>(null)
  if (selectedPartId && selectedPartId !== shownPartId) setShownPartId(selectedPartId)

  const label = shownPartId ? anatomyLabel(shownPartId, instrumentId) : undefined
  const description = shownPartId ? anatomyDescription(shownPartId, instrumentId) : undefined
  const techniques = shownPartId ? techniquesForAnatomyPart(shownPartId, instrumentId) : []
  const open = selectedPartId !== null

  return (
    <div
      className="instrument-explore__anatomy relative flex flex-col pt-[calc(var(--map-chrome-height)+env(safe-area-inset-top))] px-[clamp(20px,2.35vw,42px)] explore-stacked:px-5 pb-[var(--map-footer-height)] text-right bg-[var(--instrument-surface)] text-[color:var(--instrument-text)]"
      role="region"
      aria-label={label ? `${label} details` : 'Anatomy details'}
      aria-hidden={open ? undefined : true}
      inert={!open}
    >
      <InstrumentEngraving instrumentId={instrumentId} />
      {shownPartId && <PanelBoundary label="Close anatomy panel" onClose={returnToInstrument} />}
      {shownPartId && (
        <div className="relative z-[1] min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          {/* Same shared box AnatomyPanel's heading uses — see the
              --explore-* comment in global.css. */}
          <div className="flex min-h-[var(--explore-heading-baseline-y)] items-end">
            <h3 className={`w-full font-editorial text-[clamp(1.4rem,4vw,3rem)] leading-none font-normal transition-colors duration-300 motion-reduce:transition-none ${demonstrationOpen ? 'text-[color:var(--instrument-muted)]' : 'text-[color:var(--instrument-text)]'}`}>{label}</h3>
          </div>
          {description && <p className={`mt-[calc(var(--explore-description-top-y)-var(--explore-heading-baseline-y))] font-editorial text-[var(--explore-body-text-size)] leading-normal transition-colors duration-300 motion-reduce:transition-none ${demonstrationOpen ? 'text-[color:var(--instrument-muted)]' : 'text-[color:var(--instrument-text)]'}`}>{description}</p>}
          {techniques.length > 0 && (
            <>
              <p className="mt-5 text-[0.65rem] tracking-[0.08em] text-[color:var(--instrument-muted)] uppercase">Techniques</p>
              <ul className="mt-2 list-none space-y-5 p-0">
                {techniques.map(item => (
                  <li key={item.id} data-active={demonstrationOpen && item.id === selectedTechniqueId ? 'true' : undefined}
                    className={`transition-colors duration-300 motion-reduce:transition-none ${demonstrationOpen && item.id !== selectedTechniqueId ? 'text-[color:var(--instrument-muted)]' : 'text-[color:var(--instrument-text)]'}`}>
                    {demonstrationOpen && item.id === selectedTechniqueId && <span className="sr-only">Currently demonstrated technique</span>}
                    <h4 className="font-editorial text-[clamp(1.05rem,2.2vw,1.6rem)] font-normal">{item.title}</h4>
                    <p className="mt-[0.6rem] font-editorial text-[var(--explore-body-text-size)] leading-normal text-current">{item.description}</p>
                    {techniqueHasVideo(item) && (
                      <button
                        type="button"
                        className="mt-3 inline-block cursor-pointer border-0 bg-transparent p-0 text-[clamp(0.75rem,1vw,0.9rem)] tracking-[0.08em] text-[color:var(--instrument-text)] uppercase hover:underline focus-visible:outline-2 focus-visible:outline-current focus-visible:outline-offset-4"
                        aria-label={`${item.title} performance`}
                        onClick={() => openPerformance(item.id, instrumentId)}
                      >
                        {item.demonstrationIds.includes('prototype-violin-video') ? 'Test performance' : 'Performance'} <span className="map-identity-explore__arrow inline-block text-[color:var(--instrument-accent)]" aria-hidden="true">→</span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
