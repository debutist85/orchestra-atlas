import assert from 'node:assert/strict'

export async function verifyTechniqueAudio(server) {
  const { techniqueById, techniquesForAnatomyPart, techniqueHasAudio, techniqueHasVideo } = await server.ssrLoadModule('/src/features/instrument-explorer/technique.ts')
  assert.deepEqual(techniquesForAnatomyPart('Anchor_Bow', 'violin').map(item => item.id), ['col-legno', 'arco'])
  assert.deepEqual(techniquesForAnatomyPart('Anchor_Bridge', 'violin').map(item => item.id), ['sul-ponticello', 'chords', 'pizzicato'])
  assert.deepEqual(techniquesForAnatomyPart('Anchor_Fingerboard', 'violin').map(item => item.id), ['harmonics'])
  assert.ok(techniqueHasVideo(techniqueById('arco')))
  assert.equal(techniqueHasVideo(techniqueById('pizzicato')), true, 'pizzicato reuses labeled arco footage')
  assert.equal(techniqueById('pizzicato').mediaIntent, 'video')
  for (const id of ['col-legno', 'harmonics', 'chords', 'sul-ponticello', 'stroke']) assert.ok(techniqueHasAudio(techniqueById(id)))
  const { toggleTechniqueAudio, stopTechniqueAudio, useTechniqueAudioStore } = await server.ssrLoadModule('/src/features/instrument-explorer/technique-audio-store.ts')
  const { useAnatomyStore } = await server.ssrLoadModule('/src/store/anatomy-store.ts')
  const previousAudio = globalThis.Audio
  const players = []
  class FakeAudio {
    listeners = new Map()
    paused = false
    duration = 20
    currentTime = 0
    constructor(src) { this.src = src; players.push(this) }
    addEventListener(name, callback) { this.listeners.set(name, callback) }
    removeEventListener(name, callback) { if (this.listeners.get(name) === callback) this.listeners.delete(name) }
    async play() { if (this.src.includes('fail')) throw new Error('unsupported') }
    pause() { this.paused = true }
    removeAttribute() {}
    load() {}
  }
  globalThis.Audio = FakeAudio
  try {
    await toggleTechniqueAudio(techniqueById('chords'))
    assert.equal(useTechniqueAudioStore.getState().status, 'playing')
    assert.match(players[0].src, /audio\/instruments\/violin\/chords\.ogg$/)
    const oldEnded = players[0].listeners.get('ended')
    await toggleTechniqueAudio(techniqueById('harmonics'))
    assert.equal(players[0].paused, true, 'changing techniques stops the old player')
    assert.equal(useTechniqueAudioStore.getState().techniqueId, 'harmonics')
    oldEnded()
    assert.equal(useTechniqueAudioStore.getState().techniqueId, 'harmonics', 'old completion cannot stop new sample')
    await toggleTechniqueAudio(techniqueById('harmonics'))
    assert.equal(useTechniqueAudioStore.getState().status, 'paused', 'same control pauses playback')
    const pausedPlayer = players.at(-1)
    pausedPlayer.currentTime = 5
    pausedPlayer.listeners.get('timeupdate')()
    assert.equal(useTechniqueAudioStore.getState().progress, 0.25, 'progress uses real media position')
    pausedPlayer.duration = Infinity
    pausedPlayer.currentTime = (385540 / 44100) / 2
    pausedPlayer.listeners.get('timeupdate')()
    assert.equal(useTechniqueAudioStore.getState().progress, 0.5, 'Ogg duration fallback keeps progress visible')
    pausedPlayer.duration = 20
    pausedPlayer.currentTime = 5
    pausedPlayer.listeners.get('timeupdate')()
    await toggleTechniqueAudio(techniqueById('harmonics'))
    assert.equal(players.at(-1), pausedPlayer, 'resume retains the same player')
    assert.equal(useTechniqueAudioStore.getState().status, 'playing')
    assert.equal(useTechniqueAudioStore.getState().progress, 0.25)

    useAnatomyStore.getState().selectAnatomyPart('Anchor_Bridge')
    useAnatomyStore.getState().openTechniqueNote('chords')
    await toggleTechniqueAudio(techniqueById('chords'))
    players.at(-1).listeners.get('ended')()
    assert.equal(useAnatomyStore.getState().techniqueNoteId, 'chords', 'completion preserves reading time')
    useAnatomyStore.getState().closeTechniqueNote()
    assert.equal(useAnatomyStore.getState().techniqueNoteId, null)
    assert.equal(useTechniqueAudioStore.getState().status, 'idle')
    await toggleTechniqueAudio(techniqueById('chords'))
    players.at(-1).listeners.get('error')()
    assert.equal(useTechniqueAudioStore.getState().status, 'error')
    await toggleTechniqueAudio(techniqueById('chords'))
    assert.equal(useTechniqueAudioStore.getState().status, 'playing', 'errors can be retried')
    useAnatomyStore.getState().selectAnatomyPart('Anchor_Bow')
    assert.equal(useTechniqueAudioStore.getState().status, 'idle')
    await toggleTechniqueAudio(techniqueById('col-legno'))
    useAnatomyStore.getState().openPerformance('arco', 'violin')
    assert.equal(useTechniqueAudioStore.getState().status, 'idle', 'video opening stops audio')
  } finally {
    stopTechniqueAudio()
    useAnatomyStore.getState().returnToInstrument()
    globalThis.Audio = previousAudio
  }
  console.log('Passed technique media assignments, shared audio exclusivity, stop/replay, errors and navigation cleanup.')
}
