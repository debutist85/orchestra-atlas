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
        refs.fill.style.transform = `scaleX(${intensity})`
        refs.value.textContent = intensity.toFixed(2)
        refs.row.classList.toggle('instrument-activity__row--active', entry?.active ?? false)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="instrument-activity-panel" aria-hidden="true">
      <p className="instrument-activity-panel__title">Instrument activity</p>
      <ul className="instrument-activity-panel__list">
        {excerptStems.map(stem => (
          <li key={stem.instrument} className="instrument-activity__row"
            ref={element => {
              if (!element) { rows.current.delete(stem.instrument); return }
              const fill = element.querySelector<HTMLElement>('.instrument-activity__bar-fill')
              const value = element.querySelector<HTMLElement>('.instrument-activity__value')
              if (fill && value) rows.current.set(stem.instrument, { row: element, fill, value })
            }}>
            <span className="instrument-activity__name">{instrumentNames.get(stem.instrument) ?? stem.instrument}</span>
            <span className="instrument-activity__bar"><span className="instrument-activity__bar-fill" /></span>
            <span className="instrument-activity__value">0.00</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
