import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  const { audioSelection, backgroundGainFor } = await server.ssrLoadModule('/src/features/listening/audio-selection.ts')
  const { createListeningEngine } = await server.ssrLoadModule('/src/features/listening/listening-engine.ts')
  const cello = { selectedInstrumentIds: ['cello'], effectiveListeningMode: 'highlight', isolated: true }
  assert.equal(backgroundGainFor(cello, undefined, true), 0, 'solo has no audible orchestra bed')
  assert.equal(backgroundGainFor(cello, undefined, false), 0, 'a loading or missing stem never unmutes the orchestra')
  const normal = audioSelection({ level: 'orchestra' })
  assert.equal(backgroundGainFor(normal), 1)
  assert.ok(backgroundGainFor({ ...cello, isolated: false }) > 0, 'map focus retains its normal quiet bed')
  const engine = createListeningEngine()
  engine.setPreviewSelection(cello)
  assert.deepEqual([...engine.diagnostics().stems], ['cello'])
  engine.applySelection(normal)
  assert.deepEqual([...engine.diagnostics().stems], ['cello'], 'engine load/navigation cannot overwrite prototype selection')
  engine.setPreviewSelection({ ...cello, selectedInstrumentIds: ['doubleBass'] })
  assert.deepEqual([...engine.diagnostics().stems], ['contrabass'], 'instrument IDs resolve to authored stem IDs')
  engine.setPreviewSelection(normal)
  assert.deepEqual([...engine.diagnostics().stems], [], 'Full orchestra restores the complete mix')
  engine.setPreviewSelection(cello)
  engine.setPreviewSelection(null)
  assert.deepEqual([...engine.diagnostics().stems], [], 'leaving the prototype restores navigation audio')
} finally { await server.close() }
console.log('Passed prototype solo selection, zero bed during loading, authored stem mapping, override persistence and navigation cleanup.')
