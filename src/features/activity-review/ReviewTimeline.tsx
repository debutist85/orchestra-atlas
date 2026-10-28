import { useEffect, useRef, useState } from 'react'
import type { ReviewReport } from './analysis'
import type { ActivityProfile } from '../listening/activity-profile'
import { intensityAt, orchestraIntensityAt } from '../listening/activity-profile'

type Props = { report: ReviewReport; legacy: ActivityProfile | null; start: number; span: number; position: number; onSeek: (time: number) => void }
const HEIGHT = 420
export function ReviewTimeline({ report, legacy, start, span, position, onSeek }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(800)
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(Math.max(1, entries[0].contentRect.width)))
    observer.observe(canvas.current!)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const element = canvas.current!, ratio = Math.min(devicePixelRatio, 2)
    element.width = width * ratio; element.height = HEIGHT * ratio
    const context = element.getContext('2d')!
    context.scale(ratio, ratio); context.fillStyle = '#080e16'; context.fillRect(0, 0, width, HEIGHT)
    const m = report.measurements, hop = m.hopSeconds
    const x = (time: number) => (time - start) / span * width
    const text = (label: string, y: number, color = '#a9bdcf') => { context.fillStyle = color; context.font = '11px sans-serif'; context.fillText(label, 8, y) }
    const line = (values: number[], top: number, bottom: number, min: number, max: number, color: string) => {
      context.strokeStyle = color; context.lineWidth = 1; context.beginPath()
      for (let px = 0; px <= width; px++) {
        const i = Math.min(values.length - 1, Math.max(0, Math.round((start + px / width * span) / hop)))
        const y = bottom - Math.max(0, Math.min(1, (values[i] - min) / (max - min))) * (bottom - top)
        if (!px) context.moveTo(px, y); else context.lineTo(px, y)
      }
      context.stroke()
    }
    text('Waveform · combined channel peaks', 14)
    context.strokeStyle = '#5686a4'; context.beginPath()
    for (let px = 0; px < width; px++) {
      const first = Math.floor((start + px / width * span) / hop), last = Math.ceil((start + (px + 1) / width * span) / hop)
      let low = 0, high = 0
      for (let i = first; i <= last && i < m.waveformMax.length; i++) { low = Math.min(low, m.waveformMin[i] ?? 0); high = Math.max(high, m.waveformMax[i] ?? 0) }
      context.moveTo(px, 49 - high * 28); context.lineTo(px, 49 - low * 28)
    }
    context.stroke()
    text('Raw RMS (cyan) / peak (blue) · −100 to 0 dBFS', 97)
    line(m.peakDb, 105, 170, -100, 0, '#315c8b'); line(m.rmsDb, 105, 170, -100, 0, '#64dfec')
    context.strokeStyle = '#a3b953'; context.setLineDash([4, 4]); context.beginPath()
    const gateY = 170 - (report.parameters.gateDb + 100) / 100 * 65
    context.moveTo(0, gateY); context.lineTo(width, gateY); context.stroke(); context.setLineDash([])
    text('Spectrogram · log frequency, low → high · −100 to 0 dB', 190)
    const spect = m.spectrogram
    for (let px = 0; px < width; px++) {
      const frame = Math.floor((start + px / width * span) / hop / spect.stride)
      for (let band = 0; band < spect.bands; band++) {
        const value = spect.values[frame * spect.bands + band] ?? 0
        context.fillStyle = `rgb(${Math.round(value * .3)},${Math.round(value * .8)},${value})`
        context.fillRect(px, 200 + (spect.bands - 1 - band) * 65 / spect.bands, 1, 65 / spect.bands + 1)
      }
    }
    text('Spectral onset strength · amber markers = unreviewed candidates', 284)
    const peak = Math.max(.001, ...m.flux.slice(Math.floor(start / hop), Math.ceil((start + span) / hop)))
    line(m.flux, 294, 340, 0, peak, '#f4c16e')
    text('Sounding spans (green) / current 50 ms profile (violet, 0–1)', 359)
    context.fillStyle = '#5cbd7f55'
    for (let i = 0; i < report.gates.length; i += 2) context.fillRect(x(report.gates[i]), 369, (report.gates[i + 1] - report.gates[i]) / span * width, 28)
    if (legacy) {
      context.strokeStyle = '#c2a4ef'; context.beginPath()
      for (let px = 0; px <= width; px++) {
        const time = start + px / width * span
        const value = report.source.track === 'orchestra' ? orchestraIntensityAt(legacy, time) : intensityAt(legacy, report.source.track, time)
        const y = 397 - Math.max(0, Math.min(1, value)) * 26
        if (!px) context.moveTo(px, y); else context.lineTo(px, y)
      }
      context.stroke()
    }
    for (const onset of report.onsets) {
      if (onset.time < start || onset.time > start + span) continue
      context.strokeStyle = onset.status === 'rejected' ? '#d7656570' : onset.status === 'unreviewed' ? '#f4c16eaa' : '#83ecb7'
      context.setLineDash(onset.status === 'rejected' ? [2, 4] : [])
      context.beginPath(); context.moveTo(x(onset.time), 20); context.lineTo(x(onset.time), 398); context.stroke()
    }
    context.setLineDash([])
    // Time labels need their own x coordinates.
    context.fillStyle = '#080e16'; context.fillRect(0, 400, width, 20)
    for (let i = 0; i <= 5; i++) { context.fillStyle = '#a9bdcf'; context.fillText(`${(start + i * span / 5).toFixed(2)}s`, Math.min(width - 48, i * width / 5 + 3), 416) }
  }, [report, legacy, start, span, width])
  const cursor = (position - start) / span * 100
  return <div className="relative overflow-hidden rounded-lg border border-white/15">
    <canvas ref={canvas} className="block w-full" style={{ height: HEIGHT }} aria-hidden="true" onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect(); onSeek(start + (event.clientX - rect.left) / rect.width * span)
    }} />
    {cursor >= 0 && cursor <= 100 && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-white" style={{ left: `${cursor}%` }} />}
    <p className="sr-only">Waveform, raw RMS and peak dB, log-frequency spectrogram, spectral onset strength, sounding spans, and existing profile. Use the seek slider and onset table for keyboard access.</p>
  </div>
}
