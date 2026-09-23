import type { ScoreWindow, MeasureTime } from './score-window'
import type { ScoreAnchor } from './score-playhead'

export type WindowRequest = { type: 'render'; generation: number; window: ScoreWindow; partIds: string[]; width: number; reason: string }
export type WorkerRequest = { type: 'initialize'; url: string } | WindowRequest
export type ScoreFragment = { svg: string; x: number; y: number; width: number; height: number }
export type MeasureRegion = { measure: number; timeSeconds: number; x: number; y: number; width: number; height: number }
export type WindowResult = {
  type: 'window'; generation: number; window: ScoreWindow; fragments: ScoreFragment[];
  anchors: ScoreAnchor[]; regions: MeasureRegion[]; tracks: string[]; staves: number;
  width: number; height: number; fontSize: number; renderMs: number; anchorsMs: number; workerMs: number;
  renderedMeasures: number[]; thread: 'worker';
}
export type WorkerResponse = {
  type: 'ready'; moduleMs: number; fetchMs: number; parseMs: number; timingMs: number; bytes: number;
  timing: MeasureTime[]; duration: number; tracks: number; thread: 'worker';
} | WindowResult | { type: 'error'; generation?: number; message: string }
