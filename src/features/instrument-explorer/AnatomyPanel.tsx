import { useId, type CSSProperties } from 'react'
import type { OrchestraInstrument } from '../orchestra-map/config'
import { instrumentCatalog } from '../../store/catalog'
import { familyName } from '../orchestra-map/utils/navigation'
import { orchestraSceneConfig } from '../orchestra-map/config'
import { instrumentSummary } from './instrument-summary'

type Props = {
  instrumentName: string
  instrumentId: OrchestraInstrument
  descriptionOpen: boolean
  onToggleDescription: () => void
}

export function AnatomyPanel({ instrumentName, instrumentId, descriptionOpen, onToggleDescription }: Props) {
  const summaryId = useId()
  const summary = instrumentSummary(instrumentId)
  const instrument = instrumentCatalog.find(item => item.instrument === instrumentId)
  const titleStyle = {
    '--instrument-title-word-length': Math.max(...instrumentName.split(/\s+/).map(word => word.length), 1),
  } as CSSProperties

  return <div className="pt-3 explore-stacked:relative explore-stacked:block explore-stacked:pt-0">
    <div data-explore-header className="explore-stacked:relative explore-stacked:grid explore-stacked:grid-cols-2">
    <div className="instrument-explore__map-slot hidden pointer-events-none explore-stacked:absolute explore-stacked:-top-4 explore-stacked:left-3 explore-stacked:block explore-stacked:h-full explore-stacked:w-1/2" aria-hidden="true" />
    <div className="explore-stacked:col-start-2 explore-stacked:min-w-0 explore-stacked:text-right explore-stacked:[container-type:inline-size]">
      {instrument && <p className="m-0 mb-2.5 text-xs tracking-[0.08em] uppercase">{familyName(orchestraSceneConfig, instrument.familyId)}</p>}
      <h2 style={titleStyle} className="m-0 font-editorial text-[clamp(2.5rem,4.8vw,5.5rem)] leading-none font-normal explore-stacked:text-[min(clamp(1.5rem,24cqi,5rem),calc(160cqi/var(--instrument-title-word-length)))] explore-stacked:[overflow-wrap:anywhere] explore-stacked:text-balance">{instrumentName}</h2>
    </div>
    {summary &&
      <button className="hidden min-h-[44px] min-w-[44px] mt-2 border-0 bg-transparent p-0 cursor-pointer explore-stacked:col-span-2 explore-stacked:flex explore-stacked:ml-auto explore-stacked:w-max items-center justify-center text-[clamp(0.75rem,1vw,0.9rem)] tracking-[0.08em] whitespace-nowrap text-dust uppercase hover:text-ivory focus-visible:text-ivory focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-[3px]" type="button"
        aria-expanded={descriptionOpen} aria-controls={summaryId} onClick={onToggleDescription}>
        <span className="inline-block bg-black/50 px-[0.4em] py-[0.12em]">{descriptionOpen ? 'Show less' : 'Show more'}</span>
      </button>
    }
    </div>
    {summary && <div id={summaryId} className={`explore-stacked:grid explore-stacked:transition-[grid-template-rows] explore-stacked:duration-[450ms] explore-stacked:ease-in-out motion-reduce:transition-none ${descriptionOpen ? 'explore-stacked:grid-rows-[1fr]' : 'explore-stacked:grid-rows-[0fr]'}`}>
      <div className={`explore-stacked:min-h-0 explore-stacked:overflow-hidden explore-stacked:transition-[visibility] motion-reduce:delay-0 ${descriptionOpen ? 'explore-stacked:visible explore-stacked:delay-0' : 'explore-stacked:invisible explore-stacked:delay-[450ms]'}`}>
        <p className="m-0 mt-5 font-editorial text-[clamp(1rem,1.15vw,1.25rem)] leading-[1.45] explore-stacked:mt-0 explore-stacked:pt-3 explore-stacked:text-base">{summary}</p>
      </div>
    </div>}
  </div>
}
