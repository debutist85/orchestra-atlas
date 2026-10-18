import assert from 'node:assert/strict'

export async function verifyInstrumentDescription(server) {
  const { descriptionZoomed, reserveDescriptionArea, placeDescription } = await server.ssrLoadModule('/src/features/instrument-explorer/typography/instrument-description.ts')
  const { createInstrumentViewSignal } = await server.ssrLoadModule('/src/features/instrument-explorer/instrument-view.ts')
  const { composeStage } = await server.ssrLoadModule('/src/features/instrument-explorer/typography/spatial-typography.ts')

  let hidden = false
  for (const ratio of [1, 0.98, 0.95, 0.941]) {
    hidden = descriptionZoomed(hidden, ratio)
    assert.equal(hidden, false)
  }
  hidden = descriptionZoomed(hidden, 0.939)
  assert.equal(hidden, true)
  for (const ratio of [0.95, 0.97, 0.945, 0.979]) {
    hidden = descriptionZoomed(hidden, ratio)
    assert.equal(hidden, true, 'zoom noise inside the hysteresis band keeps copy hidden')
  }
  assert.equal(descriptionZoomed(hidden, 0.98), false)
  const view = createInstrumentViewSignal()
  let changes = 0
  view.subscribe(() => changes++)
  for (const azimuth of [-Math.PI, -1, 0, 1, Math.PI]) {
    view.set(azimuth, 0.8)
    assert.equal(view.getZoomed(), false, 'orbit cannot hide the description')
  }
  const before = changes
  view.setZoomed(true)
  view.setZoomed(true)
  assert.equal(changes, before + 1, 'zoom state only notifies on transitions')

  for (const [area, portrait, copy, map] of [
    [{ left: 16, top: 66, right: 374, bottom: 714 }, true, { width: 358, height: 170 }, { left: 16, top: 38, width: 130, height: 90 }],
    [{ left: 16, top: 66, right: 1264, bottom: 714 }, false, { width: 280, height: 210 }, { left: 16, top: 38, width: 170, height: 100 }],
    [{ left: 16, top: 66, right: 828, bottom: 314 }, false, { width: 280, height: 170 }, { left: 16, top: 38, width: 110, height: 60 }],
  ]) {
    const result = reserveDescriptionArea(area, portrait ? 'bottom' : 'left', copy, map)
    assert.ok(result.position.left >= area.left)
    assert.ok(result.position.top + copy.height <= area.bottom)
    if (portrait) assert.ok(result.available.bottom + 24 <= result.position.top)
    else {
      assert.ok(result.position.top >= map.top + map.height + 24)
      assert.ok(result.available.left >= result.position.left + copy.width + 24)
    }
    const composed = composeStage([], result.available, result.available, portrait ? 'top' : 'right', 0.3, map)
    if (portrait) assert.ok(composed.model.top + composed.model.height <= result.position.top - 24)
    else assert.ok(composed.model.left >= result.position.left + copy.width + 24)
  }
  const area = { left: 24, top: 66, right: 1256, bottom: 714 }
  const size = { width: 280, height: 150 }
  const model = { left: 700, top: 100, width: 200, height: 500 }
  const minimap = { left: 24, top: 38, width: 170, height: 100 }
  const placement = placeDescription(area, 'left', size, model, minimap)
  assert.equal(placement.x + size.width, model.left - 24,
    'sits directly beside the model with the minimum gap')
  assert.equal(placement.y, 225, 'sits near the upper quarter of the model')
  assert.ok(placement.minY >= minimap.top + minimap.height + 24)
  assert.ok(placement.maxX + size.width <= model.left - 24)
  const shifted = placeDescription(area, 'left', size, { ...model, left: 900 }, minimap)
  assert.equal(shifted.x - placement.x, 200, 'tracks the projected model edge, not a fixed left offset')
  const narrow = placeDescription(area, 'left', size, { ...model, left: 340 }, minimap)
  assert.ok(narrow.x >= area.left && narrow.x + size.width <= 340 - 24)
  const portrait = placeDescription({ left: 16, top: 66, right: 374, bottom: 714 }, 'bottom',
    { width: 342, height: 130 }, { left: 140, top: 160, width: 100, height: 350 }, minimap)
  assert.equal(portrait.y, 584, 'portrait retains bottom alignment')
  assert.equal(portrait.x, 24, 'portrait retains its horizontal breathing room')
  assert.ok(portrait.minY >= 510 + 24)
  // A wide model (the horn) keeps its copy on the left too, beside its box.
  const wideModel = { left: 500, top: 180, width: 600, height: 300 }
  const wide = placeDescription(area, 'left', size, wideModel, minimap)
  assert.equal(wide.x + size.width, wideModel.left - 24, 'wide-model copy sits beside the box, not below it')
  // The gap to the model is per instrument; the clearance below the
  // minimap is separate and doesn't move with it.
  const roomy = placeDescription(area, 'left', size, model, minimap, 80, 24)
  assert.equal(roomy.x + size.width, model.left - 80, 'the description gap is measured from the model box')
  assert.equal(roomy.minY, placement.minY, 'the minimap clearance ignores the description gap')
  const roomyReservation = reserveDescriptionArea(area, 'left', size, minimap, 80, 24)
  assert.equal(roomyReservation.available.left, area.left + size.width + 80)
  assert.equal(roomyReservation.position.top, reserveDescriptionArea(area, 'left', size, minimap).position.top)
  const wideComposition = composeStage([], roomyReservation.available, roomyReservation.available, 'right', 1.34, minimap)
  assert.ok(wideComposition.model.left >= roomyReservation.available.left, 'the model frame starts after the reserved copy and gap')
  console.log('Passed instrument description hysteresis, orbit independence, signal, and responsive frame reservation.')
}
