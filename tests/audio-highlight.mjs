import assert from 'node:assert/strict'

export async function verifyAudioHighlight(server) {
  const { ringTarget, easeRingActivity } = await server.ssrLoadModule('/src/features/orchestra-map/three/audio-highlight.ts')
  const { orchestraSceneConfig } = await server.ssrLoadModule('/src/features/orchestra-map/config.ts')
  const easing = orchestraSceneConfig.visuals.nodes.audioHighlight
  const floor = easing.minActivity

  assert.equal(ringTarget(false, 0.8, floor), 0, 'a closed gate hides the ring')
  assert.equal(ringTarget(true, 0, floor), floor, 'an open gate shows at least the floor')
  assert.equal(ringTarget(true, 0.9, floor), 0.9)
  assert.equal(ringTarget(true, 2, floor), 1)

  const frame = 1 / 60
  assert.equal(easeRingActivity(0, floor, frame, easing), floor, 'an onset reaches the floor on its first frame')
  const loud = easeRingActivity(0, 1, frame, easing)
  assert.ok(loud > floor && loud < 1, 'a loud onset jumps to the floor, then eases up')
  const falling = easeRingActivity(0.8, 0, frame, easing)
  assert.ok(falling < 0.8 && falling > 0.6, 'release lingers instead of cutting')
  assert.equal(easeRingActivity(0.5, 0.2, frame, easing, true), 0.2, 'instant snaps')
  assert.equal(easeRingActivity(0.2, 0.2, frame, easing), 0.2)

  console.log('Passed audio highlight: gate-driven ring targets, floor on onset, attack and release easing.')
}
