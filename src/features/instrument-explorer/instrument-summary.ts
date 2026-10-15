import { previewInstrumentContent } from './preview-instrument-content'
import type { OrchestraInstrument } from '../orchestra-map/config'

// Short orientation lines, in the same spirit as the part descriptions in
// instrument-anatomy.ts. Additional draft summaries live with preview content.
const summaries: Partial<Record<OrchestraInstrument, string>> = {
  violin: 'The violin is the smallest and highest-pitched member of the orchestral string family, played with a bow or plucked. Its brilliant, expressive tone carries melodies and adds richness to the orchestra.',
  timpani: 'Timpani are large, bowl-shaped drums played with mallets and tuned to distinct pitches using foot pedals. Their deep, resonant sound adds weight, tension, and drama to the orchestra.',
}

export function instrumentSummary(instrumentId: OrchestraInstrument): string | undefined {
  return summaries[instrumentId] ?? previewInstrumentContent[instrumentId]?.summary
}
