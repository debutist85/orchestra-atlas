import type { OrchestraInstrument } from '../orchestra-map/config'

// Short orientation lines, in the same spirit as the part descriptions in
// instrument-anatomy.ts. Only instruments with an explorer model (or the
// timpani stand-in) have one so far.
const summaries: Partial<Record<OrchestraInstrument, string>> = {
  violin: 'The highest of the string instruments, with four strings played by bow or by plucking.',
  timpani: 'Large pitched drums, played with mallets. The player tunes each drum with a pedal.',
}

export function instrumentSummary(instrumentId: OrchestraInstrument): string | undefined {
  return summaries[instrumentId]
}
