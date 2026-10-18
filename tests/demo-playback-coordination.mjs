import assert from 'node:assert/strict'

export async function verifyDemoPlaybackCoordination(server) {
  const { usePlaybackStore } = await server.ssrLoadModule('/src/store/playback-store.ts')
  const { pauseMainPlaybackForDemo, resumeMainPlaybackAfterDemo } = await server.ssrLoadModule('/src/features/instrument-explorer/demonstration/demo-playback-coordination.ts')

  // Was playing -> demo pauses it -> close resumes it.
  usePlaybackStore.getState().play()
  pauseMainPlaybackForDemo()
  assert.equal(usePlaybackStore.getState().status, 'paused', 'starting a demonstration pauses active main playback')
  resumeMainPlaybackAfterDemo()
  assert.equal(usePlaybackStore.getState().status, 'playing', 'closing the demonstration restores playback that was running')

  // Was already paused -> demo pausing it is a no-op -> close does not start it.
  usePlaybackStore.getState().pause()
  pauseMainPlaybackForDemo()
  assert.equal(usePlaybackStore.getState().status, 'paused')
  resumeMainPlaybackAfterDemo()
  assert.equal(usePlaybackStore.getState().status, 'paused', 'never starts playback that was not already running')

  // Was playing -> demo pauses it -> the visitor explicitly resumes and then
  // re-pauses main playback themselves while the demonstration is still
  // open -> closing it must not override that explicit decision.
  usePlaybackStore.getState().play()
  pauseMainPlaybackForDemo()
  usePlaybackStore.getState().toggle() // visitor presses play again themselves
  usePlaybackStore.getState().pause() // then pauses it again themselves
  resumeMainPlaybackAfterDemo()
  assert.equal(usePlaybackStore.getState().status, 'paused', 'does not resume against an explicit user pause made while the demo was open')

  console.log('Passed demonstration/main-playback coordination: pause-on-start, no-op when already paused, and no override of an explicit user decision.')
}
