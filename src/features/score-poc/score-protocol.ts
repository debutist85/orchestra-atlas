import type { ScoreWindow, MeasureTime } from './score-window'
import type { ScoreAnchor } from './score-playhead'

export type WindowRequest = {
  type: 'render'; generation: number; startMeasure: number; targetWidth: number; maxMeasures: number; partIds: string[]; reason: string
}
export type WorkerRequest = { type: 'initialize'; url: string } | WindowRequest
export type ScoreFragment = { svg: string; x: number; y: number; width: number; height: number }
export type MeasureRegion = { measure: number; timeSeconds: number; x: number; y: number; width: number; height: number }
// One label per rendered track/instrument, its natural (unscaled) vertical
// extent within the sheet — used to keep instrument names visible outside
// the horizontally-paging notation (score-adapter.ts's label overlay).
export type StaveBounds = { name: string; shortName: string; y: number; height: number }
export type WindowResult = {
  type: 'window'; generation: number; window: ScoreWindow; fragments: ScoreFragment[];
  anchors: ScoreAnchor[]; regions: MeasureRegion[]; tracks: string[]; staves: number; staveBounds: StaveBounds[];
  width: number; height: number; fontSize: number; stretchFactor: number;
  renderMs: number; anchorsMs: number; measureMs: number; workerMs: number;
  renderedMeasures: number[]; thread: 'worker';
}
export type WorkerResponse = {
  type: 'ready'; moduleMs: number; fetchMs: number; parseMs: number; timingMs: number; bytes: number;
  timing: MeasureTime[]; duration: number; tracks: number; thread: 'worker';
} | WindowResult | { type: 'error'; generation?: number; message: string }
