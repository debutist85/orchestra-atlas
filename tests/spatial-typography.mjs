import assert from 'node:assert/strict'

export async function verifySpatialTypography(server) {
  const {
    spatialTypographyConfig: config, orbitDeflection, spatialTextOffset, parallaxScale, planePosition, planeAnchorPoint, layoutPlanes, availablePlaneWidth, planeReach, measureLabelSpace, composeInstrumentFrame, composeStage, labelSideFor, withModelGap, labelAreaAround, dampTowards,
  } = await server.ssrLoadModule('/src/features/instrument-explorer/typography/spatial-typography.ts')
  const { createInstrumentViewSignal, frontView } = await server.ssrLoadModule('/src/features/instrument-explorer/instrument-view.ts')
  const { instrumentExperience } = await server.ssrLoadModule('/src/features/instrument-explorer/content/explorable-instruments.ts')

  // The front view is the neutral pose: no text is displaced.
  const neutral = orbitDeflection(frontView)
  for (const id of Object.keys(config.text)) {
    const offset = spatialTextOffset(id, neutral, 1)
    assert.ok(Math.abs(offset.x) < 1e-9 && Math.abs(offset.y) < 1e-9, id)
  }

  // A quarter turn reaches each plane's configured maximum; the foreground
  // title moves further than the background one, in the opposite direction
  // (they sit on opposite sides of the instrument), and the description
  // follows its title's direction with restrained travel.
  const quarter = orbitDeflection({ azimuth: Math.PI / 2, polar: Math.PI / 2 })
  const instrument = spatialTextOffset('instrumentTitle', quarter, 1)
  const family = spatialTextOffset('familyTitle', quarter, 1)
  assert.equal(Math.abs(instrument.x), config.planes.instrument.parallax.x)
  assert.equal(Math.abs(family.x), config.planes.family.parallax.x)
  assert.ok(Math.abs(instrument.x) > Math.abs(family.x))
  assert.ok(Math.sign(instrument.x) === -Math.sign(family.x))

  // Free rotation stays bounded and continuous across the ±π wrap.
  for (let azimuth = -Math.PI; azimuth <= Math.PI; azimuth += Math.PI / 24) {
    const offset = spatialTextOffset('instrumentTitle', orbitDeflection({ azimuth, polar: Math.PI / 2 }), 1)
    assert.ok(Math.abs(offset.x) <= config.planes.instrument.parallax.x + 1e-9)
  }
  const justBefore = spatialTextOffset('instrumentTitle', orbitDeflection({ azimuth: Math.PI - 1e-6, polar: Math.PI / 2 }), 1)
  const justAfter = spatialTextOffset('instrumentTitle', orbitDeflection({ azimuth: -Math.PI + 1e-6, polar: Math.PI / 2 }), 1)
  assert.ok(Math.abs(justBefore.x - justAfter.x) < 1e-3)

  // Narrow stages scale the motion down, never below the floor.
  assert.equal(parallaxScale(config.parallaxReferenceWidth * 2), 1)
  assert.equal(parallaxScale(10), config.parallaxMinScale)

  // The label side follows the stage, never the model's shape, so every
  // instrument gets the same composition: beside it on a landscape stage,
  // on top on a portrait one.
  assert.equal(labelSideFor('landscape'), 'right')
  assert.equal(labelSideFor('portrait'), 'top')

  // The title gap moves the plane that faces the model away from it: right
  // of the model's box beside it, up from the labels' bottom edge (which
  // meets the box) above it. The family title rides on the instrument
  // title, so it follows rather than taking the gap itself.
  const instrumentRight = planePosition('instrument', 'right')
  assert.deepEqual(withModelGap(instrumentRight, 'right', 48).offset, [instrumentRight.offset[0] + 48, instrumentRight.offset[1]])
  const instrumentTop = planePosition('instrument', 'top')
  assert.deepEqual(withModelGap(instrumentTop, 'top', 20).offset, [instrumentTop.offset[0], instrumentTop.offset[1] - 20])
  assert.equal(withModelGap(planePosition('family', 'right'), 'right', 48), planePosition('family', 'right'))
  assert.equal(withModelGap(planePosition('family', 'top'), 'top', 20), planePosition('family', 'top'))
  // Laid out above a model box, the title's bottom edge sits exactly the gap above it.
  const box = { left: 40, top: 300, width: 300, height: 400 }
  const above = layoutPlanes([{ id: 'instrument', position: withModelGap(instrumentTop, 'top', 20), reach: { x: 0, y: 0 }, measure: () => ({ width: 200, height: 60 }) }],
    box, { left: 16, top: 66, right: 374, bottom: box.top }, 120)
  assert.equal(above.boxes.instrument.top + above.boxes.instrument.height, box.top - 20)

  // Positions resolve per instrument and side, falling back to the plane
  // default for that side.
  const override = { ...config, instrumentPlanePositions: { violin: { instrument: { right: { anchor: [1, 0.4], alignX: 'start', alignY: 'start' } } } } }
  assert.equal(planePosition('instrument', 'right', 'violin', override), override.instrumentPlanePositions.violin.instrument.right)
  assert.equal(planePosition('instrument', 'top', 'violin', override), config.planes.instrument.position.top, 'side without an override uses the default')
  assert.equal(planePosition('instrument', 'right', 'cello'), config.planes.instrument.position.right)
  assert.equal(planePosition('family', 'top', 'violin').relativeTo, 'instrument', 'family sits on the instrument title by default')
  assert.ok(config.planes.instrument.position.right.anchor[0] >= 1)
  // On top: right-aligned, flush with the labels' side, growing upward.
  assert.equal(config.planes.instrument.position.top.relativeTo, 'labels')
  assert.equal(config.planes.instrument.position.top.alignX, 'end')
  assert.equal(config.planes.family.position.top.alignX, 'end')

  // Anchors are relative to a reference box, plus px offset.
  const bounds = { left: 500, top: 100, width: 200, height: 600 }
  assert.deepEqual(planeAnchorPoint({ anchor: [0, 0], alignX: 'start', alignY: 'start' }, bounds), { x: 500, y: 100 })
  assert.deepEqual(planeAnchorPoint({ anchor: [1.1, 0.5], offset: [12, -6], alignX: 'start', alignY: 'end' }, bounds), { x: 732, y: 394 })

  const area = { left: 16, top: 66, right: 1424, bottom: 714 }
  const none = { x: 0, y: 0 }
  // Fixed-size block, or text that wraps: a fixed amount of "ink" that gets
  // taller as it is given less width.
  const fixed = (width, height) => () => ({ width, height })
  const wrapping = (naturalWidth, lineHeight, ink) => maxWidth => {
    const width = Math.min(naturalWidth, maxWidth)
    return { width, height: Math.ceil(ink / width) * lineHeight }
  }
  const instrumentAt = (anchor, measure = fixed(300, 200), reach = none) => ({ id: 'instrument', position: { anchor, alignX: 'start', alignY: 'start' }, reach, measure })
  const familyOnInstrument = (reach = none) => ({ id: 'family', position: { relativeTo: 'instrument', anchor: [0, 0], offset: [12, -6], alignX: 'start', alignY: 'end' }, reach, measure: fixed(100, 30) })

  // Fits: untouched, family stacked on the instrument title.
  let result = layoutPlanes([familyOnInstrument(), instrumentAt([1.1, 0.4])], bounds, area, 200)
  assert.deepEqual(result.points.instrument, { x: 720, y: 340 })
  assert.deepEqual(result.points.family, { x: 732, y: 334 })

  // Short landscape stage: the instrument plane doesn't fit below its
  // anchor and is pushed up — the family title travels with it rather than
  // ending up behind it.
  const short = { left: 16, top: 66, right: 840, bottom: 314 }
  result = layoutPlanes([familyOnInstrument(), instrumentAt([1.1, 0.2])], { left: 300, top: 60, width: 200, height: 300 }, short, 200)
  assert.equal(result.points.instrument.y + 200, 314, 'instrument plane contained at the bottom')
  assert.equal(result.points.family.y, result.points.instrument.y - 6, 'family still sits on the instrument title')
  assert.ok(result.points.family.y - 30 >= short.top, 'whole group inside the area')

  // Width is capped to the space between the anchor and the area edge, so
  // text wraps in place rather than shifting over the model.
  const offered = []
  result = layoutPlanes([instrumentAt([1.1, 0], maxWidth => { offered.push(maxWidth); return wrapping(500, 20, 500 * 3)(maxWidth) })], { left: 900, top: 100, width: 200, height: 400 }, area, 200)
  assert.equal(offered[0], 1424 - 1120)
  assert.equal(result.points.instrument.x, 1120, 'not shifted: it wrapped instead')

  // Too little room even for the minimum width: keeps the minimum, shifts.
  result = layoutPlanes([instrumentAt([1, 0], wrapping(500, 20, 1500))], { left: 1300, top: 100, width: 100, height: 400 }, area, 200)
  assert.equal(result.points.instrument.x, 1424 - 200)

  // Parallax reach is reserved on top of the area, per plane.
  result = layoutPlanes([instrumentAt([0, 0], fixed(300, 100), { x: 24, y: 9 })], { left: 0, top: 0, width: 10, height: 10 }, area, 200)
  assert.deepEqual(result.points.instrument, { x: 16 + 24, y: 66 + 9 })
  result = layoutPlanes([instrumentAt([1, 1], fixed(300, 100), { x: 24, y: 9 })], { left: 1400, top: 700, width: 10, height: 10 }, area, 200)
  assert.deepEqual(result.points.instrument, { x: 1424 - 24 - 300, y: 714 - 9 - 100 })

  // A group taller than the area pins to its top.
  result = layoutPlanes([familyOnInstrument({ x: 10, y: 4 }), instrumentAt([0, 0], fixed(300, 400), { x: 24, y: 9 })], bounds, short, 200)
  assert.equal(result.points.family.y - 30, short.top + 4, 'family title pinned below the top margin')

  // End alignment and horizontal containment.
  result = layoutPlanes([{ id: 'instrument', position: { anchor: [0, 0], alignX: 'end', alignY: 'start' }, reach: none, measure: fixed(300, 100) }], { left: 100, top: 300, width: 10, height: 10 }, area, 200)
  assert.deepEqual(result.points.instrument, { x: 316, y: 300 })

  // Missing or cyclic references fall back to the model bounds.
  result = layoutPlanes([familyOnInstrument()], { ...bounds, top: 300 }, area, 200)
  assert.deepEqual(result.points.family, { x: 512, y: 294 })
  result = layoutPlanes([
    { id: 'family', position: { relativeTo: 'instrument', anchor: [0, 0], alignX: 'start', alignY: 'start' }, reach: none, measure: fixed(10, 10) },
    { id: 'instrument', position: { relativeTo: 'family', anchor: [0, 0], alignX: 'start', alignY: 'start' }, reach: none, measure: fixed(10, 10) },
  ], bounds, area, 200)
  assert.ok(result.points.family && result.points.instrument)

  // Available width never exceeds the area, and never drops below the
  // minimum unless the area itself is narrower.
  assert.equal(availablePlaneWidth({ x: 0 }, 'start', area, 200), 1408)
  assert.equal(availablePlaneWidth({ x: 1400 }, 'start', area, 200), 200)
  assert.equal(availablePlaneWidth({ x: 1400 }, 'end', area, 200), 1384)
  assert.equal(availablePlaneWidth({ x: 0 }, 'start', { left: 0, top: 0, right: 120, bottom: 100 }, 200), 120)
  assert.deepEqual(planeReach('instrument', config.parallaxReferenceWidth), config.planes.instrument.parallax)

  // Center alignment: centered on the anchor, width from the nearer edge.
  result = layoutPlanes([{ id: 'instrument', position: { anchor: [0.5, 0], offset: [0, -20], alignX: 'center', alignY: 'end' }, reach: none, measure: wrapping(600, 20, 600 * 2) }], { left: 400, top: 500, width: 200, height: 100 }, area, 200)
  assert.deepEqual(result.points.instrument, { x: 500, y: 480 })
  assert.equal(result.boxes.instrument.left + result.boxes.instrument.width / 2, 500)
  assert.equal(availablePlaneWidth({ x: 500 }, 'center', area, 200), 2 * (500 - 16))

  // Label space: landscape measures how far right of the model the group
  // reaches (position gap + width + parallax reach); portrait how far up.
  const viewport = { left: 16, top: 66, right: 1424, bottom: 714 }
  const landscapeLabels = [
    { id: 'instrument', position: { anchor: [1, 0.5], offset: [32, 0], alignX: 'start', alignY: 'center' }, reach: { x: 24, y: 9 }, measure: fixed(300, 160) },
    { ...familyOnInstrument({ x: 10, y: 4 }) },
  ]
  assert.equal(measureLabelSpace(landscapeLabels, viewport, 'right', 0.45, 200), 32 + 300 + 24)
  const portraitLabels = [
    { id: 'instrument', position: { anchor: [0.5, 0], offset: [0, -20], alignX: 'center', alignY: 'end' }, reach: { x: 24, y: 9 }, measure: fixed(300, 160) },
    { id: 'family', position: { relativeTo: 'instrument', anchor: [0.5, 0], offset: [0, -6], alignX: 'center', alignY: 'end' }, reach: { x: 10, y: 4 }, measure: fixed(100, 30) },
  ]
  assert.equal(measureLabelSpace(portraitLabels, viewport, 'top', 0.45, 200), 20 + 160 + 6 + 30 + 4)
  // Capped at the share the labels may claim.
  assert.equal(measureLabelSpace([{ ...landscapeLabels[0], measure: fixed(2000, 160) }], viewport, 'right', 0.45, 200), (1424 - 16) * 0.45)

  // Composition: the model frame keeps the model's aspect, never overlaps
  // the labels' side, and model + labels are centered together.
  const tall = 0.45
  let composition = composeInstrumentFrame(viewport, 'right', 356, tall)
  assert.equal(composition.model.height, 648, 'height-limited: full area height')
  assert.ok(Math.abs(composition.model.width / composition.model.height - tall) < 0.01)
  assert.equal(composition.labels.left, composition.model.left + composition.model.width)
  const spare = (1408 - composition.model.width - 356) / 2
  assert.ok(Math.abs(composition.model.left - (16 + spare)) <= 1, 'composition centered')
  // Narrow landscape: shrunk horizontally to leave the labels their room.
  composition = composeInstrumentFrame({ left: 16, top: 66, right: 840, bottom: 314 }, 'right', 356, 3)
  assert.ok(composition.model.width <= 824 - 356 + 1)
  assert.ok(composition.model.height < 248)
  // Portrait: shrunk vertically, labels above, model below them.
  const phone = { left: 16, top: 66, right: 374, bottom: 714 }
  composition = composeInstrumentFrame(phone, 'top', 220, tall)
  assert.ok(composition.model.height <= 648 - 220 + 1)
  assert.equal(composition.labels.bottom, composition.model.top)
  assert.equal(composition.labels.top, phone.top)
  assert.ok(composition.model.top + composition.model.height <= phone.bottom + 1)
  assert.ok(Math.abs(composition.model.left + composition.model.width / 2 - (16 + 374) / 2) <= 1, 'centered horizontally')
  // A wide model (the horn) on a landscape screen gets the violin's
  // composition: labels beside it, and the full height when the width allows.
  composition = composeInstrumentFrame(viewport, labelSideFor('landscape'), 220, 1.34)
  assert.equal(composition.labels.left, composition.model.left + composition.model.width, 'labels start where the model frame ends')
  assert.equal(composition.model.height, Math.round(viewport.bottom - viewport.top), 'the wide model keeps the full height')
  assert.ok(Math.abs(composition.model.width / composition.model.height - 1.34) < 0.02)
  // Labels on top (a portrait stage) with a wide model: model shortened
  // below them and centered.
  composition = composeInstrumentFrame(viewport, 'top', 220, 2.5)
  assert.equal(composition.labels.bottom, composition.model.top)
  assert.ok(composition.model.height <= 648 - 220 + 1)
  assert.ok(Math.abs(composition.model.width / composition.model.height - 2.5) < 0.02)
  // The minimap holds the top-left: with labels on top the title may still
  // use the full width, and only the model frame starts below the minimap;
  // beside the model it's ignored.
  const minimap = { left: 16, top: 38, width: 130, height: 90 }
  const around = labelAreaAround(phone, 'top', minimap, 16)
  assert.deepEqual(around.labelArea, phone, 'labels on top keep the full width')
  assert.equal(around.minLabelSpace, 38 + 90 + 16 - phone.top)
  assert.deepEqual(labelAreaAround(phone, 'right', minimap, 16), { labelArea: phone, minLabelSpace: 0 })
  assert.deepEqual(labelAreaAround(phone, 'top', undefined, 16), { labelArea: phone, minLabelSpace: 0 })
  composition = composeInstrumentFrame(phone, 'top', Math.max(around.minLabelSpace, 40), tall)
  assert.ok(composition.model.top >= minimap.top + minimap.height + 16 - 1, 'model frame clear of the minimap')

  // 'labels' reference: right-aligned against the labels' side.
  const labelSide = { ...phone, left: around.labelArea.left, bottom: 300 }
  result = layoutPlanes([
    { id: 'instrument', position: config.planes.instrument.position.top, reach: { x: 10, y: 4 }, measure: wrapping(400, 20, 400 * 2) },
    { id: 'family', position: config.planes.family.position.top, reach: { x: 5, y: 2 }, measure: fixed(80, 24) },
  ], composition.model, labelSide, 120)
  assert.equal(result.boxes.instrument.left + result.boxes.instrument.width, 374 - 10, 'flush right, less parallax reach')
  assert.ok(result.boxes.instrument.left >= labelSide.left + 10, 'inside the stage, less parallax reach')
  assert.ok(result.boxes.instrument.left < minimap.left + minimap.width, 'a wide title may extend past the minimap')
  assert.equal(result.boxes.family.left + result.boxes.family.width, result.boxes.instrument.left + result.boxes.instrument.width, 'family right-aligned with the title')
  assert.ok(result.boxes.instrument.top + result.boxes.instrument.height <= 300 - 4)

  // composeStage: labels on the right, the centered composition moves clear
  // of the minimap only when the model frame would run under it.
  const sideways = { left: 16, top: 66, right: 651, bottom: 289 }
  const map = { left: 16, top: 38, width: 225, height: 118 }
  let staged = composeStage(landscapeLabels, sideways, sideways, 'right', tall, map, config)
  assert.ok(staged.model.left >= map.left + map.width + config.minimapGap - 1, 'model clear of the minimap')
  assert.ok(staged.labels.left >= staged.model.left + staged.model.width)
  const wide = composeStage(landscapeLabels, viewport, viewport, 'right', tall, { left: 16, top: 38, width: 120, height: 60 }, config)
  assert.deepEqual(wide, composeStage(landscapeLabels, viewport, viewport, 'right', tall, undefined, config), 'no overlap: stays centered')
  // Labels on top: the full width, minimap or not; only the model goes below it.
  staged = composeStage(portraitLabels, phone, phone, 'top', tall, minimap, config)
  assert.equal(staged.labels.left, phone.left, 'labels span the full width')
  assert.equal(staged.labels.right, phone.right)
  assert.ok(staged.model.top >= minimap.top + minimap.height + config.minimapGap - 1)

  // The model frame has its own, smaller margin: on a short landscape stage
  // it gets nearly the full height between the bars, while the labels keep
  // theirs and still fit beside it.
  const safe = { left: 0, top: 50, right: 868, bottom: 330 }
  const inset = margin => ({ left: safe.left + margin, top: safe.top + margin, right: safe.right - margin, bottom: safe.bottom - margin })
  staged = composeStage(landscapeLabels, inset(16), inset(4), 'right', tall, undefined, config)
  assert.equal(staged.model.height, 280 - 8, 'model uses the height inside its own margin')
  assert.ok(staged.labels.top >= 66 && staged.labels.bottom <= 314, 'labels keep the larger margin')
  assert.ok(staged.labels.right <= 852)
  assert.ok(staged.labels.right - staged.labels.left >= 32 + 300 + 24 - 1, 'room for the labels as measured')

  // Whole px, so recomposition is stable.
  assert.ok(Object.values(composition.model).every(Number.isInteger))

  // Labels laid out in their side stay clear of the model frame.
  composition = composeInstrumentFrame(viewport, 'right', 356, tall)
  result = layoutPlanes(landscapeLabels, composition.model, composition.labels, 200)
  for (const box of Object.values(result.boxes)) assert.ok(box.left >= composition.model.left + composition.model.width, 'right of the model frame')
  for (const box of Object.values(result.boxes)) assert.ok(box.top + box.height <= composition.labels.bottom + 1e-9)

  // Damping converges without overshoot and is frame-rate independent.
  const oneStep = dampTowards(0, 10, config.damping, 1 / 30)
  const twoSteps = dampTowards(dampTowards(0, 10, config.damping, 1 / 60), 10, config.damping, 1 / 60)
  assert.ok(oneStep > 0 && oneStep < 10)
  assert.ok(Math.abs(oneStep - twoSteps) < 1e-9)

  // The signal only notifies on a real change.
  const signal = createInstrumentViewSignal()
  let notifications = 0
  const unsubscribe = signal.subscribe(() => notifications++)
  signal.set(frontView.azimuth, frontView.polar)
  signal.set(0.4, 1.2)
  signal.set(0.4, 1.2)
  signal.setModelBounds(bounds)
  signal.setModelBounds({ ...bounds })
  assert.deepEqual(signal.getModelBounds(), bounds)
  signal.setModelAspect(0.45)
  signal.setModelAspect(0.45)
  signal.setModelFrame(bounds)
  signal.setModelFrame({ ...bounds })
  assert.equal(signal.getModelAspect(), 0.45)
  assert.deepEqual(signal.getModelFrame(), bounds)
  unsubscribe()
  signal.set(0.5, 1.2)
  assert.equal(notifications, 4)
  assert.deepEqual(signal.get(), { azimuth: 0.5, polar: 1.2 })

  // Content comes from data, not the component. The description stays in
  // the data for its separate, asynchronous presentation.
  const violin = instrumentExperience({ level: 'instrument', familyId: 'strings', instrumentId: 'violin' })
  assert.equal(violin.familyName, 'Strings')
  assert.ok(violin.description)
  assert.deepEqual(Object.keys(config.text).sort(), ['familyTitle', 'instrumentTitle'], 'only the titles are laid out here')

  console.log('Passed spatial typography offsets, wrap continuity, model- and plane-relative per-instrument positions, width capping, parallax-reserved margins, group containment, label space and stage composition, viewport scaling, damping, view signal, and content.')
}
