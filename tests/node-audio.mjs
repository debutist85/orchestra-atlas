import assert from 'node:assert/strict'

export async function verifyNodeAudio(server) {
  const { createNodeAudio } = await server.ssrLoadModule('/src/features/instrument-explorer/node-audio.ts')
  const { usePlaybackStore } = await server.ssrLoadModule('/src/store/playback-store.ts')
  class FakeAudio extends EventTarget {
    src = ''; preload = ''; currentTime = 0; duration = 10; ended = false; paused = true
    reject = false
    play() {
      if (this.reject) return Promise.reject(new Error('blocked'))
      this.paused = false
      this.ended = false
      this.dispatchEvent(new Event('play'))
      return Promise.resolve()
    }
    pause() { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event('pause')) } }
    removeAttribute() { this.src = '' }
    load() {}
  }
  const recordings = [], states = [], progress = []
  let pendingFrame
  const player = createNodeAudio({
    createMedia: () => { const media = new FakeAudio(); recordings.push(media); return media },
    onState: state => states.push(state), onProgress: (id, fraction) => progress.push([id, fraction]),
    requestFrame: callback => { pendingFrame = callback; return 1 },
    cancelFrame: () => { pendingFrame = undefined },
  })
  player.toggle('chords', '/chords.ogg')
  assert.equal(states.at(-1).playing, true)
  const audio = recordings[0]
  audio.currentTime = 4
  pendingFrame()
  assert.deepEqual(progress.at(-1), ['chords', 0.4])
  player.toggle('chords', '/chords.ogg')
  assert.equal(states.at(-1).playing, false)
  assert.equal(audio.currentTime, 4, 'pause retains playback position')
  assert.equal(pendingFrame, undefined)
  player.toggle('chords', '/chords.ogg')
  assert.equal(recordings.length, 1, 'resume reuses the recording')
  assert.equal(audio.currentTime, 4)
  audio.ended = true; audio.paused = true; audio.currentTime = 10
  audio.dispatchEvent(new Event('ended'))
  assert.equal(states.at(-1).playing, false)
  assert.deepEqual(progress.at(-1), ['chords', 1])
  player.toggle('chords', '/chords.ogg')
  assert.equal(audio.currentTime, 0, 'completed recording replays from the start')
  player.toggle('harmonics', '/chords.ogg')
  assert.equal(audio.paused, true)
  assert.equal(audio.src, '', 'switch releases previous media')
  assert.equal(recordings.length, 2)
  player.stop()
  assert.equal(recordings[1].paused, true)
  assert.equal(pendingFrame, undefined)
  assert.deepEqual(progress.at(-1), ['harmonics', 0])
  player.toggle('chords', '/chords.ogg')
  recordings[2].pause(); recordings[2].reject = true
  player.toggle('chords', '/chords.ogg')
  await Promise.resolve()
  assert.equal(states.at(-1).playing, false)
  assert.ok(states.at(-1).error)
  player.stop()

  // Use the real transport coordination for pause/resume and user override.
  usePlaybackStore.setState({ status: 'playing' })
  player.toggle('chords', '/chords.ogg')
  assert.equal(usePlaybackStore.getState().status, 'paused')
  player.toggle('chords', '/chords.ogg')
  assert.equal(usePlaybackStore.getState().status, 'playing')
  player.toggle('chords', '/chords.ogg')
  usePlaybackStore.getState().play()
  usePlaybackStore.getState().pause()
  player.stop()
  assert.equal(usePlaybackStore.getState().status, 'paused', 'explicit transport change is respected')
  console.log('Passed node audio play/pause, progress, resume, replay, switching, cleanup, rejected playback, and transport coordination.')
}
