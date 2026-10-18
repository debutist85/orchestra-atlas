import assert from 'node:assert/strict'

export async function verifyAnatomyStore(server) {
  const { useAnatomyStore } = await server.ssrLoadModule('/src/store/anatomy-store.ts')
  const state = () => {
    const { selectedPartId, selectedActionId, demonstrationOpen } = useAnatomyStore.getState()
    return { selectedPartId, selectedActionId, demonstrationOpen }
  }
  const store = () => useAnatomyStore.getState()

  assert.deepEqual(state(), { selectedPartId: null, selectedActionId: null, demonstrationOpen: false }, 'starts fully deselected')

  // No part selected: actions are ignored.
  store().selectAction('discover', 'violin')
  assert.equal(state().selectedActionId, null)

  store().selectAnatomyPart('Anchor_Bow')
  assert.deepEqual(state(), { selectedPartId: 'Anchor_Bow', selectedActionId: null, demonstrationOpen: false })

  // Only the selected part's actions, on this instrument, are accepted.
  store().selectAction('pizzicato', 'violin')
  assert.equal(state().selectedActionId, null, 'an action of another part is ignored')
  store().selectAction('stroke', 'violin')
  assert.equal(state().selectedActionId, null, 'an action of another instrument is ignored')
  store().selectAction('discover', 'violin')
  assert.equal(state().selectedActionId, null, 'Discover is no longer an action')

  // A removed action cannot open a demonstration.
  store().openDemonstration('violin')
  assert.equal(state().demonstrationOpen, false)

  store().selectAction('arco', 'violin', 'audio')
  assert.equal(state().selectedActionId, null, 'invalid medium is ignored')
  store().selectAction('arco', 'violin', 'video')
  assert.equal(store().selectedMedia, 'video')
  assert.equal(state().selectedActionId, 'arco')
  store().openDemonstration('violin')
  assert.equal(state().demonstrationOpen, true, 'arco opens its video')
  store().closeDemonstration()
  assert.equal(state().demonstrationOpen, false)

  // Audio is inline and cannot open the sliding video panel.
  store().selectAction('col-legno', 'violin', 'audio')
  store().openDemonstration('violin')
  assert.equal(state().demonstrationOpen, false)
  assert.equal(state().selectedActionId, 'col-legno')

  store().clearAction()
  assert.equal(store().selectedMedia, null)
  assert.equal(state().selectedActionId, null, 'Discover restores anatomy text by clearing the technique')
  assert.deepEqual(state(), { selectedPartId: 'Anchor_Bow', selectedActionId: null, demonstrationOpen: false }, 'clearing the action keeps the part')

  // Selecting a different part clears action and demonstration.
  store().selectAction('arco', 'violin')
  store().openDemonstration('violin')
  store().selectAnatomyPart('Anchor_Scroll')
  assert.deepEqual(state(), { selectedPartId: 'Anchor_Scroll', selectedActionId: null, demonstrationOpen: false })

  store().returnToInstrument()
  assert.deepEqual(state(), { selectedPartId: null, selectedActionId: null, demonstrationOpen: false }, 'returnToInstrument clears everything')

  console.log('Passed anatomy-store selection, part-action validity, demonstration availability, and reset transitions.')
}
