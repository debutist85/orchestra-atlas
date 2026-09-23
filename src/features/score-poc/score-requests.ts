// At most one job executes and one latest job waits. Correctness never relies on
// interrupting synchronous engraving already executing in the worker.
export class ScoreRequests<T> {
  generation = 0
  private active: number | null = null
  private queued?: { generation: number; value: T }
  private send: (generation: number, value: T) => void
  constructor(send: (generation: number, value: T) => void) { this.send = send }
  invalidate() { this.generation++; this.queued = undefined }
  request(value: T) {
    const generation = ++this.generation
    this.queued = { generation, value }
    this.flush()
    return generation
  }
  isCurrent(generation: number) { return generation === this.generation }
  finish(generation: number) {
    if (generation !== this.active) return
    this.active = null
    this.flush()
  }
  private flush() {
    if (this.active !== null || !this.queued) return
    const { generation, value } = this.queued
    this.queued = undefined
    this.active = generation
    this.send(generation, value)
  }
}
