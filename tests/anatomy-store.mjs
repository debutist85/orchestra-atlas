import assert from 'node:assert/strict'

export async function verifyAnatomyStore(server) {
  const { useAnatomyStore } = await server.ssrLoadModule('/src/store/anatomy-store.ts')

  const store = useAnatomyStore.getState()
  assert.deepEqual(
    { selectedPartId: store.selectedPartId, selectedTechniqueId: store.selectedTechniqueId, demonstrationOpen: store.demonstrationOpen },
    { selectedPartId: null, selectedTechniqueId: null, demonstrationOpen: false },
    'starts fully deselected',
  )

  useAnatomyStore.getState().selectAnatomyPart('Anchor_Bridge')
  assert.equal(useAnatomyStore.getState().selectedPartId, 'Anchor_Bridge')
  assert.equal(useAnatomyStore.getState().selectedTechniqueId, null)

  // Selecting a technique not linked to the selected part is a no-op.
  useAnatomyStore.getState().selectTechnique('not-a-real-technique')
  assert.equal(useAnatomyStore.getState().selectedTechniqueId, null, 'an unlinked technique id is ignored')

  useAnatomyStore.getState().selectTechnique('sul-ponticello')
  assert.equal(useAnatomyStore.getState().selectedTechniqueId, 'sul-ponticello', 'a technique linked to the selected part is accepted')

  // Opening a demonstration with no demonstrationIds (sul ponticello, today) is a no-op.
  useAnatomyStore.getState().openDemonstration()
  assert.equal(useAnatomyStore.getState().demonstrationOpen, false, 'a technique with no demonstrations cannot be opened')

  useAnatomyStore.getState().clearTechnique()
  assert.equal(useAnatomyStore.getState().selectedTechniqueId, null)
  assert.equal(useAnatomyStore.getState().selectedPartId, 'Anchor_Bridge', 'clearing the technique keeps the part selected')

  // Selecting a different part clears any technique/demonstration state.
  useAnatomyStore.getState().selectTechnique('sul-ponticello')
  useAnatomyStore.getState().selectAnatomyPart('Anchor_Scroll')
  assert.equal(useAnatomyStore.getState().selectedPartId, 'Anchor_Scroll')
  assert.equal(useAnatomyStore.getState().selectedTechniqueId, null, 'selecting a new part clears the previous technique')

  useAnatomyStore.getState().returnToInstrument()
  assert.deepEqual(
    { selectedPartId: useAnatomyStore.getState().selectedPartId, selectedTechniqueId: useAnatomyStore.getState().selectedTechniqueId, demonstrationOpen: useAnatomyStore.getState().demonstrationOpen },
    { selectedPartId: null, selectedTechniqueId: null, demonstrationOpen: false },
    'returnToInstrument clears everything',
  )

  console.log('Passed anatomy-store selection, technique/demonstration validity, and reset transitions.')
}
