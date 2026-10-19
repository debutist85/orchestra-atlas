import assert from 'node:assert/strict'

export async function verifyNodeIntensity(server) {
  const { orchestraSceneConfig } = await server.ssrLoadModule('/src/features/orchestra-map/config.ts')
  const { neutralIntensity, hoveredIntensity, familyIntensity, instrumentHoveredIntensity, selectedInstrumentHoveredIntensity, highlightedIntensity, dimmedIntensity } = orchestraSceneConfig.visuals.interaction

  // Each hover step is brighter than the last: the full map at rest < a
  // family hovered on the full map < an instrument hovered at family depth
  // < the selected instrument hovered at instrument depth.
  assert.ok(neutralIntensity < hoveredIntensity, 'full map < full-map family hover')
  assert.ok(hoveredIntensity < instrumentHoveredIntensity, 'full-map family hover < family-level instrument hover')
  assert.ok(instrumentHoveredIntensity < selectedInstrumentHoveredIntensity, 'family-level hover < instrument-level hover')
  // A selection rests at the family glow, so hovering it is always visible,
  // and nothing exceeds the emphasis ceiling.
  assert.ok(familyIntensity < instrumentHoveredIntensity)
  assert.ok(selectedInstrumentHoveredIntensity <= highlightedIntensity)
  assert.ok(dimmedIntensity < neutralIntensity)

  console.log('Passed node intensity: ordered hover steps from the full map to the selected instrument.')
}
