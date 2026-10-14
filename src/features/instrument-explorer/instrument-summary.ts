import type { OrchestraInstrument } from '../orchestra-map/config'

// Short orientation lines, in the same spirit as the part descriptions in
// instrument-anatomy.ts. Only instruments with an explorer model (or the
// timpani stand-in) have one so far.
const summaries: Partial<Record<OrchestraInstrument, string>> = {
  violin: 'The violin is the smallest and highest-pitched instrument of the orchestral string family. Its four strings are usually played with a bow, but they can also be plucked to produce short, delicate sounds. With its expressive range and brilliant tone, the violin carries melodies, creates rich textures, and plays a central role in the orchestra.',
  timpani: 'Timpani are large, bowl-shaped drums that produce distinct musical pitches. The player strikes their drumheads with mallets and adjusts the pitch of each drum using a foot pedal. Their deep, resonant sound adds weight, tension, and dramatic impact to the orchestra.',
}

export function instrumentSummary(instrumentId: OrchestraInstrument): string | undefined {
  return summaries[instrumentId]
}
