import assert from 'node:assert/strict'

export async function verifyInstrumentPreviews(server) {
  const { instrumentCatalog } = await server.ssrLoadModule('/src/store/catalog.ts')
  const { instrumentExperience } = await server.ssrLoadModule('/src/features/instrument-explorer/explorable-instruments.ts')
  const { anatomyLabel, anatomyDescription, isAnchorIntentionallyHidden } = await server.ssrLoadModule('/src/features/instrument-explorer/instrument-anatomy.ts')
  const { instrumentSummary } = await server.ssrLoadModule('/src/features/instrument-explorer/instrument-summary.ts')
  const { previewInstrumentContent } = await server.ssrLoadModule('/src/features/instrument-explorer/preview-instrument-content.ts')
  const { techniquesForAnatomyPart, techniqueById, demonstrationById, techniqueHasVideo } = await server.ssrLoadModule('/src/features/instrument-explorer/technique.ts')
  const { useAnatomyStore } = await server.ssrLoadModule('/src/store/anatomy-store.ts')
  const modelUrls = new Set()
  for (const item of instrumentCatalog) {
    const id = item.instrument
    const experience = instrumentExperience({ level: 'instrument', familyId: item.familyId, instrumentId: id })
    assert.ok(experience.modelUrl)
    modelUrls.add(experience.modelUrl)
    assert.equal(experience.placeholderModel, id !== 'violin')
    assert.ok(instrumentSummary(id)?.length > 30, `${id}: overview copy`)
    if (id === 'violin') continue
    const content = previewInstrumentContent[id]
    assert.ok(content, `${id}: explicit content, no violin fallback`)
    assert.equal(content.reviewStatus, 'draft')
    assert.ok(content.sourceUrl.startsWith('https://'))
    assert.ok(Object.keys(content.parts).length >= 2)
    for (const [anchor, part] of Object.entries(content.parts)) {
      assert.equal(anatomyLabel(anchor, id), part.label)
      assert.ok(anatomyDescription(anchor, id))
      assert.equal(isAnchorIntentionallyHidden(anchor, id), false)
      const techniques = techniquesForAnatomyPart(anchor, id)
      assert.ok(techniques.length, `${id}/${anchor}: linked techniques`)
      for (const technique of techniques) {
        assert.equal(techniqueById(technique.id)?.id, technique.id)
        assert.notEqual(technique.id, 'sul-ponticello', 'unrelated violin technique must not leak')
        for (const demoId of technique.demonstrationIds) assert.ok(demonstrationById(demoId))
        const store = useAnatomyStore.getState()
        store.selectAnatomyPart(anchor)
        store.openPerformance(technique.id, id)
        assert.equal(useAnatomyStore.getState().demonstrationOpen, techniqueHasVideo(technique))
        store.returnToInstrument()
      }
    }
    assert.equal(anatomyLabel('Anchor_Unknown', id), undefined)
    assert.deepEqual(techniquesForAnatomyPart('Anchor_Unknown', id), [])
  }
  assert.equal(modelUrls.size, 1, 'all previews share one cached model URL')
  assert.match(demonstrationById('prototype-violin-video').title, /test footage.*not a demonstration/i)
  console.log(`Passed model, copy, hotspot, technique and performance flow checks for ${instrumentCatalog.length} instruments.`)
}
