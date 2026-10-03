import { useEffect, useRef } from 'react'

import { listeningEngine } from './listening-engine'
import { excerptStems } from './stems'
import { instrumentCatalog } from '../../store/catalog'
import type { OrchestraInstrument } from '../orchestra-map/config'

const instrumentNames = new Map(instrumentCatalog.map(group => [group.instrument, group.name]))

type RowRefs = { row: HTMLElement; fill: HTMLElement; value: HTMLElement }

// Debug readout of the offline activity profile at the current transport
// time. Not part of the map visualization.
export function InstrumentActivityPanel() {
  const rows = useRef(new Map<OrchestraInstrument, RowRefs>())

  useEffect(() => {
    let frame = requestAnimationFrame(function draw() {
      frame = requestAnimationFrame(draw)
      const activity = listeningEngine.instrumentActivity()
      for (const [instrument, refs] of rows.current) {
        const entry = activity.get(instrument)
        const intensity = entry?.intensity ?? 0
        const active = entry?.active ?? false
        refs.fill.style.transform = `scaleX(${intensity})`
        refs.fill.style.backgroundColor = active ? '#7affc0' : '#ffd97a'
        refs.value.textContent = intensity.toFixed(2)
        refs.row.style.opacity = active ? '1' : '0.55'
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(var(--map-footer-height)+0.5rem)] left-4 z-[4] box-border w-[min(15rem,calc(100vw-2rem))] max-h-[calc(50dvh-2rem)] overflow-y-auto rounded border border-stone bg-[rgb(20_21_19/88%)] px-[0.85rem] py-[0.7rem] text-[0.7rem] text-ash"
      aria-hidden="true"
    >
      <p className="m-0 mb-2 text-[0.65rem] tracking-[0.08em] text-dust uppercase">Instrument activity</p>
      <ul className="m-0 grid list-none gap-[0.3rem] p-0">
        {excerptStems.map(stem => (
          <li key={stem.instrument} className="grid grid-cols-[4.5rem_1fr_2.4rem] items-center gap-2 opacity-55"
            ref={element => {
              if (!element) { rows.current.delete(stem.instrument); return }
              const fill = element.querySelector<HTMLElement>('.instrument-activity__bar-fill')
              const value = element.querySelector<HTMLElement>('.instrument-activity__value')
              if (fill && value) rows.current.set(stem.instrument, { row: element, fill, value })
            }}>
            <span className="truncate">{instrumentNames.get(stem.instrument) ?? stem.instrument}</span>
            <span className="block h-[5px] overflow-hidden rounded-[3px] bg-[rgb(255_255_255/12%)]">
              <span className="instrument-activity__bar-fill block size-full origin-left scale-x-0 bg-[#ffd97a]" />
            </span>
            <span className="instrument-activity__value text-right text-mist tabular-nums">0.00</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
