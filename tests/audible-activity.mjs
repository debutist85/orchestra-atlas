import assert from 'node:assert/strict'

export async function verifyAudibleActivity(server) {
  const { typicalActiveRms, windowRmsAt, activityFromRms, easeActivity } =
    await server.ssrLoadModule('/src/features/listening/audible-activity.ts')

  // typicalActiveRms: silence everywhere is silence.
  assert.equal(typicalActiveRms(new Float32Array(1000), 100), 0)

  // A steady tone's typical active RMS matches its amplitude closely.
  const amplitude = 0.6
  const steady = Float32Array.from({ length: 4000 }, (_, i) => amplitude * Math.sin(i * 0.3))
  const steadyTypical = typicalActiveRms(steady, 200)
  assert.ok(Math.abs(steadyTypical - amplitude / Math.SQRT2) < 0.05, 'RMS of a sine wave is ~amplitude/sqrt(2)')

  // A sparse instrument (e.g. timpani): a handful of similarly-loud bursts
  // amid mostly silence. The reference should track those bursts' own
  // loudness, not be dragged down by the long silence between them, unlike a
  // flat average over the whole buffer.
  const sparse = new Float32Array(40000)
  for (const offset of [5000, 15000, 25000, 35000]) {
    for (let i = offset; i < offset + 200; i++) sparse[i] = amplitude * Math.sin(i * 0.3)
  }
  const sparseTypical = typicalActiveRms(sparse, 200)
  const flatAverage = Math.sqrt(sparse.reduce((sum, v) => sum + v * v, 0) / sparse.length)
  assert.ok(sparseTypical > flatAverage * 5, 'reference is not dragged down by silence')
  assert.ok(Math.abs(sparseTypical - steadyTypical) < 0.05, 'repeated bursts read at their own true loudness')

  // A single, much louder outlier window (e.g. one fortissimo climax) must
  // not single-handedly crush the reference for all the other, quieter but
  // still genuinely-playing windows around it.
  const withOutlier = Float32Array.from(steady)
  for (let i = 2000; i < 2200; i++) withOutlier[i] = 1.0 * Math.sin(i * 0.3)
  const withOutlierTypical = typicalActiveRms(withOutlier, 200)
  assert.ok(Math.abs(withOutlierTypical - steadyTypical) < 0.05, 'one loud outlier window does not dominate the reference')

  // windowRmsAt: reads the local level around a sample index, ignoring silence elsewhere.
  assert.equal(windowRmsAt(sparse, 1000, 400), 0)
  const burstLevel = windowRmsAt(sparse, 5100, 400)
  assert.ok(burstLevel > 0.3, 'the burst is detected at its own position')
  // Boundary clamping: centering near the edges must not throw or wrap around.
  assert.equal(windowRmsAt(sparse, 0, 400), windowRmsAt(sparse, 0, 400))
  assert.doesNotThrow(() => windowRmsAt(sparse, sparse.length - 1, 400))
  assert.equal(windowRmsAt(new Float32Array(0), 10, 100), 0)

  // activityFromRms: normalized 0-1 relative to a channel's own reference level.
  assert.equal(activityFromRms(0.4, 0), 0, 'a channel with no signal ever has zero reference and reads silent')
  assert.equal(activityFromRms(0, 0.4), 0)
  assert.equal(activityFromRms(0.4, 0.4), 1)
  assert.equal(activityFromRms(0.8, 0.4), 1, 'activity clamps at full even above the reference')
  assert.equal(activityFromRms(0.2, 0.4), 0.5)

  // easeActivity: exponential step toward target, snapping once close enough.
  assert.equal(easeActivity(0, 1, 1), 1)
  assert.equal(easeActivity(0.5, 0.5, 0), 0.5)
  const midway = easeActivity(0, 1, 0.5)
  assert.ok(midway > 0 && midway < 1)
  assert.equal(easeActivity(0.9995, 1, 0.5), 1, 'snaps to target once within tolerance')

  console.log('Passed audible-activity typical-active-RMS reference, windowed RMS, normalization, and easing.')
}
