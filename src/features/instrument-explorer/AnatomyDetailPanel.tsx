import { useState, type CSSProperties } from 'react'

import { useAnatomyStore } from '../../store/anatomy-store'
import { orchestraSceneConfig, type OrchestraInstrument } from '../orchestra-map/config'
import { instrumentCatalog } from '../../store/catalog'
import { anatomyDescription, anatomyLabel } from './instrument-anatomy'
import { techniqueHasVideo, techniquesForAnatomyPart } from './technique'

type Props = { instrumentId: OrchestraInstrument }

// Off-canvas, same slide-in behavior as the demonstration (their widths can
// be configured independently — see --anatomy-panel-width/
// --demonstration-panel-width in global.css). It stays mounted while Explore
// is open so the first part selection has a closed position to animate
// from. The last part stays rendered during the slide back out.
export function AnatomyDetailPanel({ instrumentId }: Props) {
  const selectedPartId = useAnatomyStore(state => state.selectedPartId)
  const openPerformance = useAnatomyStore(state => state.openPerformance)
  const returnToInstrument = useAnatomyStore(state => state.returnToInstrument)
  const [shownPartId, setShownPartId] = useState<string | null>(null)
  if (selectedPartId && selectedPartId !== shownPartId) setShownPartId(selectedPartId)

  const label = shownPartId ? anatomyLabel(shownPartId) : undefined
  const description = shownPartId ? anatomyDescription(shownPartId) : undefined
  const techniques = shownPartId ? techniquesForAnatomyPart(shownPartId, instrumentId) : []
  const open = selectedPartId !== null
  const instrument = instrumentCatalog.find(item => item.instrument === instrumentId)
  const background = instrument?.color ?? (instrument ? orchestraSceneConfig.sections[instrument.sectionId].color : '#25231f')
  // Choose the higher-contrast black/white foreground for the catalog's hex palette.
  const channels = background.slice(1).match(/.{2}/g)!.map(channel => {
    const value = parseInt(channel, 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  const foreground = luminance > 0.179 ? '#000000' : '#ffffff'

  return (
    <div
      className={`absolute top-0 right-0 z-[3] flex h-full w-[var(--anatomy-panel-width)] translate-x-full flex-col overflow-hidden pt-[calc(var(--map-chrome-height)+env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))] pb-[var(--map-footer-height)] text-right transition-[translate,right] duration-[0.6s] ease-[var(--demo-panel-ease)] group-data-[part-open=true]:translate-x-0 group-data-[demo-open=true]:right-[var(--demonstration-panel-width)] motion-reduce:transition-none max-[719px]:pr-4 bg-[var(--anatomy-background)] text-[color:var(--anatomy-foreground)]`}
      style={{ '--anatomy-background': background, '--anatomy-foreground': foreground } as CSSProperties}
      role="region"
      aria-label={label ? `${label} details` : 'Anatomy details'}
      aria-hidden={open ? undefined : true}
      inert={!open}
    >
      {shownPartId && (
        // Taken out of flow (absolute, top/left set explicitly) rather than
        // flowing above the heading — otherwise its own height would push
        // the heading down by a different amount than the Instrument
        // column's (which has nothing above its heading), breaking the
        // shared baseline below.
        <button
          type="button"
          className="absolute top-[calc(var(--map-chrome-height)+env(safe-area-inset-top))] left-[max(1.25rem,env(safe-area-inset-left))] z-[1] cursor-pointer border-0 bg-transparent p-0 text-[clamp(0.75rem,1vw,0.9rem)] tracking-[0.08em] text-current uppercase hover:underline focus-visible:outline-2 focus-visible:outline-current focus-visible:outline-offset-4 max-[719px]:left-4"
          aria-label="Return to the full instrument view"
          onClick={returnToInstrument}
        >
          <span aria-hidden="true">✕</span> Close
        </button>
      )}
      {shownPartId && (
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          {/* Same shared box AnatomyPanel's heading uses — see the
              --explore-* comment in global.css. */}
          <div className="flex min-h-[var(--explore-heading-baseline-y)] items-end">
            <h3 className="w-full font-editorial text-[clamp(1.4rem,4vw,3rem)] leading-none font-normal">{label}</h3>
          </div>
          {description && <p className="mt-[calc(var(--explore-description-top-y)-var(--explore-heading-baseline-y))] font-editorial text-[var(--explore-body-text-size)] leading-normal text-current">{description}</p>}
          {techniques.length > 0 && (
            <>
              <p className="mt-5 text-[0.65rem] tracking-[0.08em] text-current uppercase">Techniques</p>
              <ul className="mt-2 list-none space-y-5 p-0">
                {techniques.map(item => (
                  <li key={item.id}>
                    <h4 className="font-editorial text-[clamp(1.05rem,2.2vw,1.6rem)] font-normal">{item.title}</h4>
                    <p className="mt-[0.6rem] font-editorial text-[var(--explore-body-text-size)] leading-normal text-current">{item.description}</p>
                    {techniqueHasVideo(item) && (
                      <button
                        type="button"
                        className="mt-3 inline-block cursor-pointer border-0 bg-transparent p-0 text-[clamp(0.75rem,1vw,0.9rem)] tracking-[0.08em] text-current uppercase hover:underline focus-visible:outline-2 focus-visible:outline-current focus-visible:outline-offset-4"
                        aria-label={`${item.title} performance`}
                        onClick={() => openPerformance(item.id, instrumentId)}
                      >
                        Performance <span className="map-identity-explore__arrow inline-block" aria-hidden="true">→</span>
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
