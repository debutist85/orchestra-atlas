import assert from 'node:assert/strict'

export async function verifyGhostIdle(server) {
  const { ghostFocusFor, ghostIdleFor, ghostPresentFor, ghostLiveWeight, familyGhostFocus, instrumentGhostFocus } = await server.ssrLoadModule('/src/features/orchestra-map/three/ghost-idle.ts')
  const { orchestraScenePresets } = await server.ssrLoadModule('/src/features/orchestra-map/config.ts')
  const { createOrchestraPositions } = await server.ssrLoadModule('/src/features/orchestra-map/three/seating.ts')
  const { isIdlePlayer } = await server.ssrLoadModule('/src/features/orchestra-map/three/idle-animation.ts')
  const seating = createOrchestraPositions(orchestraScenePresets['classical-wide'])
    .filter(node => node.visible !== false)
  const cello = seating.find(node => node.instrument === 'cello')
  const flute = seating.find(node => node.instrument === 'flute')
  const viola = seating.find(node => node.instrument === 'viola')
  const conductor = seating.find(node => node.sectionId === 'conductor')
  assert.ok(cello && flute && viola && conductor)
  const orchestra = { level: 'orchestra' }
  const strings = { level: 'family', familyId: 'strings' }
  const celloView = { level: 'instrument', familyId: 'strings', instrumentId: 'cello' }
  assert.equal(ghostFocusFor(orchestra, cello), 0)
  assert.equal(ghostIdleFor(orchestra, cello), 1)
  assert.equal(ghostIdleFor(orchestra, conductor), 0)
  assert.ok(seating.filter(isIdlePlayer).every(node => ghostIdleFor(orchestra, node) === 1))
  assert.equal(ghostFocusFor(strings, cello), familyGhostFocus)
  assert.equal(ghostIdleFor(strings, cello), 0)
  assert.equal(ghostFocusFor(strings, flute), 0)
  assert.equal(ghostIdleFor(strings, flute), 0)
  assert.equal(ghostFocusFor(celloView, cello), instrumentGhostFocus)
  assert.ok(ghostFocusFor(celloView, cello) > ghostFocusFor(strings, cello))
  assert.equal(ghostFocusFor(celloView, viola), 0)
  assert.equal(ghostIdleFor(celloView, viola), 0)
  assert.equal(ghostIdleFor(celloView, flute), 0)
  assert.equal(ghostFocusFor(celloView, flute), 0)
  assert.equal(ghostPresentFor(orchestra, cello), 1)
  assert.equal(ghostPresentFor(strings, cello), 1)
  assert.equal(ghostPresentFor(strings, flute), 0)
  assert.equal(ghostPresentFor(celloView, cello), 1)
  assert.equal(ghostPresentFor(celloView, viola), 0)
  assert.equal(ghostPresentFor(celloView, flute), 0)
  const bassoon = seating.find(node => node.instrument === 'bassoon')
  const clarinet = seating.find(node => node.instrument === 'clarinet')
  const oboe = seating.find(node => node.instrument === 'oboe')
  assert.ok(bassoon && clarinet && oboe)
  const bassoonView = { level: 'instrument', familyId: 'woodwinds', instrumentId: 'bassoon' }
  assert.equal(ghostPresentFor(bassoonView, bassoon), 1)
  assert.equal(ghostPresentFor(bassoonView, clarinet), 0)
  assert.equal(ghostPresentFor(bassoonView, oboe), 0)
  assert.equal(ghostPresentFor(bassoonView, flute), 0)
  assert.ok(seating.filter(node => node.sectionId === 'woodwinds' && node.instrument !== 'bassoon')
    .every(node => ghostPresentFor(bassoonView, node) === 0))
  const interaction = orchestraScenePresets['classical-wide'].visuals.interaction
  const dimmedFocus = interaction.dimmedIntensity / interaction.familyIntensity
  assert.equal(ghostLiveWeight(clarinet, 1, 0.2, interaction), 1)
  assert.ok(ghostLiveWeight(clarinet, dimmedFocus, 0.2, interaction) < 0.01)
  assert.equal(ghostLiveWeight(bassoon, 1, 0.2, interaction), 1)
  assert.ok(ghostLiveWeight(flute, 1, -1, interaction) < 0.01)
  assert.equal(ghostLiveWeight(cello, 1, 0, interaction), 1)
  assert.equal(ghostLiveWeight(conductor, 1, 0, interaction), 0)
  const ghost = orchestraScenePresets['classical-wide'].visuals.nodes.ghost
  assert.ok(ghost.opacity < ghost.familyOpacity)
  assert.ok(ghost.familyOpacity < ghost.selectedOpacity)
  // There is only one intervalSeconds (the clock/period), shared by every
  // level, so navigating between levels never jumps the wave's phase. Idle's
  // longer duration only makes each pulse linger, independent of that shared
  // clock, for a slower feel while zoomed all the way out.
  assert.ok(ghost.durationSeconds > ghost.familyDurationSeconds, 'idle lingers longer than family/instrument')
  assert.equal(ghost.familyDurationSeconds, ghost.selectedDurationSeconds)

  // A group that stays present across the whole trip (the family/instrument
  // being zoomed into or out of, as opposed to one fading in or out) takes
  // the lower of its live and not-yet-arrived focus. An increase (approaching
  // a stronger look) is the not-yet-arrived value, so it holds at the weaker
  // pre-travel look until arrival. A decrease (withdrawing to a weaker look)
  // is already the live value, so it eases down through the travel instead of
  // holding then dropping abruptly right when the camera settles — avoiding a
  // sudden-looking pop on arrival. OrchestraScene mirrors this exactly via
  // #ghostFocusForNode.
  const capped = (liveNav, deferredNav, node) => {
    const liveFocus = ghostFocusFor(liveNav, node)
    if (ghostPresentFor(deferredNav, node) <= 0 || ghostPresentFor(liveNav, node) <= 0) return liveFocus
    return Math.min(liveFocus, ghostFocusFor(deferredNav, node))
  }
  assert.equal(capped(strings, orchestra, cello), 0, 'family node holds idle look mid-approach into family')
  assert.equal(capped(strings, strings, cello), familyGhostFocus, 'family node reaches family look once settled')
  assert.equal(capped(celloView, strings, cello), familyGhostFocus, 'elected instrument holds family look mid-approach into instrument')
  assert.equal(capped(celloView, celloView, cello), instrumentGhostFocus, 'elected instrument reaches instrument look once settled')
  assert.equal(capped(celloView, strings, viola), 0, 'sibling still drops immediately mid-approach, not deferred')
  assert.equal(capped(strings, celloView, cello), familyGhostFocus, 'withdrawing instrument eases toward family look mid-travel, not held at instrument look')
  assert.equal(capped(strings, strings, cello), familyGhostFocus, 'withdrawing instrument reaches family look once settled')
  assert.equal(capped(strings, celloView, viola), familyGhostFocus, 'reappearing sibling rises immediately on withdraw, not deferred')
  assert.equal(capped(orchestra, strings, cello), 0, 'family eases toward idle look mid-withdraw to orchestra, not held at family look')
  assert.equal(capped(orchestra, orchestra, cello), 0, 'family reaches idle look once withdrawal to orchestra settles')
  console.log('Passed idle ghosts on every player, family/instrument intensity, and silent inactive groups.')
}