import assert from 'node:assert/strict'

export async function verifyPlayback(server) {
  const { clampPlaybackPosition, formatPlaybackTime, pulseLevels, defaultPlayback } = await server.ssrLoadModule('/src/features/listening/playback.ts')
  const { usePlaybackStore } = await server.ssrLoadModule('/src/store/playback-store.ts')
  const { useListeningStore } = await server.ssrLoadModule('/src/store/listening-store.ts')

  assert.equal(formatPlaybackTime(0), '0:00')
  assert.equal(formatPlaybackTime(72.9), '1:12')
  assert.equal(formatPlaybackTime(-4), '0:00')
  assert.equal(clampPlaybackPosition(12, 10), 10)
  assert.equal(clampPlaybackPosition(-1, 10), 0)

  const rest = pulseLevels(0, { playing: false })
  assert.equal(rest.length, defaultPlayback.pulseCount)
  assert.ok(rest.every(level => level > 0 && level < 0.3))
  assert.deepEqual(pulseLevels(0, { playing: true, reducedMotion: true }), rest)

  const downbeat = pulseLevels(0, { playing: true, tempoBpm: 60 })
  const offbeat = pulseLevels(0.5, { playing: true, tempoBpm: 60 })
  assert.ok(downbeat[0] > offbeat[0], 'Pulse bars follow the beat, not a flat shimmer')
  assert.ok(downbeat.some(level => Math.abs(level - downbeat[0]) > 0.05), 'Bars stay staggered on the same pulse')
  assert.deepEqual(pulseLevels(0, { playing: true, tempoBpm: 60 }), downbeat)

  const listeningBefore = useListeningStore.getState().selectedInstrumentIds
  const playback = usePlaybackStore.getState()
  playback.pause()
  playback.seek(0)
  assert.equal(usePlaybackStore.getState().status, 'paused')
  playback.play()
  assert.equal(usePlaybackStore.getState().status, 'playing')
  playback.seek(12.5)
  assert.equal(usePlaybackStore.getState().position, 12.5)
  playback.seek(999)
  assert.equal(usePlaybackStore.getState().position, usePlaybackStore.getState().duration)
  playback.setClock(usePlaybackStore.getState().duration)
  assert.equal(usePlaybackStore.getState().status, 'paused')
  playback.toggle()
  assert.equal(usePlaybackStore.getState().status, 'playing')
  assert.equal(usePlaybackStore.getState().position, 0)
  playback.pause()
  assert.deepEqual(useListeningStore.getState().selectedInstrumentIds, listeningBefore)

  console.log('Passed playback time, beat pulses, transport controls, and listening independence.')
}
