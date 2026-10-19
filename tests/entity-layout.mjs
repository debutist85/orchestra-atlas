import assert from 'node:assert/strict'
import * as THREE from 'three'

export async function verifyEntityLayout(server) {
  const { layoutEntities, overlap, pickEntity, pickEntityNearMarks, labelGap, labelCornerFor, resolveLabelCorner } = await server.ssrLoadModule('/src/features/orchestra-map/utils/entity-layout.ts')
  const {
    compactMapLabelWidth,
    layoutOrchestraFamilyLabels,
    orchestraFamilyLabelPositions,
    orchestraLabelViewportPadding,
    resolveNormalizedMapPosition,
  } = await server.ssrLoadModule('/src/features/orchestra-map/utils/orchestra-family-label-layout.ts')
  const viewport = { x: 0, y: 0, width: 200, height: 200 }
  const box = { x: 20, y: 20, width: 40, height: 40 }
  const chip = { width: 80, height: 36 }
  const [spacedGroup] = layoutEntities([{ id: 'violin', nodes: [
    { x: 20, y: 80, width: 20, height: 20 },
    { x: 160, y: 80, width: 20, height: 20 },
  ], labelSize: chip }], viewport)
  assert.equal(pickEntity([spacedGroup], { x: 100, y: 90 }), 'violin', 'broad group box covers the gap')
  assert.equal(pickEntityNearMarks([spacedGroup], { x: 100, y: 90 }), undefined, 'gap withdraws at family depth')
  assert.equal(pickEntityNearMarks([spacedGroup], { x: 45, y: 90 }), 'violin', 'near-light margin remains selectable')
  assert.equal(pickEntityNearMarks([spacedGroup], { x: spacedGroup.label.x + 1, y: spacedGroup.label.y + 1 }), 'violin', 'label remains selectable')
  const [unlabeledGroup] = layoutEntities([{ id: 'violin', nodes: [{ x: 20, y: 80, width: 20, height: 20 }], labelSize: { width: 0, height: 0 } }], viewport)
  const phantomLabel = { ...unlabeledGroup, label: { x: 100, y: 100, width: 1, height: 1 } }
  assert.equal(pickEntityNearMarks([phantomLabel], { x: 100, y: 100 }), undefined,
    'removed instrument captions have no phantom hit target')

  assert.equal(resolveLabelCorner(box, chip, 'bottom-left', viewport), 'bottom-left')
  assert.equal(resolveLabelCorner({ x: 10, y: 160, width: 40, height: 30 }, chip, 'bottom-left', viewport), 'top-left')
  assert.equal(resolveLabelCorner({ x: 10, y: 5, width: 40, height: 30 }, chip, 'top-right', viewport), 'bottom-left')
  assert.equal(labelCornerFor('violin'), 'bottom-left')
  assert.equal(labelCornerFor('violin', 'top-right'), 'top-right')
  assert.equal(labelCornerFor('cello'), 'bottom-right')
  assert.equal(labelCornerFor('viola'), 'bottom-left')
  assert.equal(labelCornerFor('viola', 'top-left'), 'top-left')
  assert.equal(labelCornerFor('strings'), 'bottom-left')
  assert.equal(labelCornerFor('woodwinds'), 'top-right')
  assert.equal(labelCornerFor('brass'), 'bottom-right')
  const { orchestraSceneConfig } = await server.ssrLoadModule('/src/features/orchestra-map/config.ts')
  const { createOrchestraPositions } = await server.ssrLoadModule('/src/features/orchestra-map/three/seating.ts')
  const {
    cameraFocus, projectedNodeBounds, instrumentPortraitShiftViewportFraction, orchestraPortraitShiftViewportFraction, orchestraLiftViewportFraction, orchestraLandscapeLiftViewportFraction,
    isMobilePortraitViewport, maxFramingViewport, maxOrchestraFramingViewport,
    familyFramingPullbackShare, maxLandscapeFramingAspect, maxMobileLandscapeFramingAspect, maxPortraitFramingAspect,
  } = await server.ssrLoadModule('/src/features/orchestra-map/three/camera-focus.ts')
  const { mapLabels, familySections, familyIds } = await server.ssrLoadModule('/src/features/orchestra-map/utils/navigation.ts')
  const config = orchestraSceneConfig
  const positions = createOrchestraPositions(config)
  const viewports = [[1440, 900], [1024, 768], [768, 1024], [320, 568], [375, 667], [390, 844], [430, 932], [844, 390]]
  for (const [width, height] of viewports) {
    const nodeBounds = projectedNodeBounds(positions, { level: 'orchestra' }, { width, height }, config.camera.fov)
    assert.ok(nodeBounds.width > 0 && nodeBounds.height > 0)
    assert.ok(nodeBounds.left >= 0 && nodeBounds.top >= 0)
    assert.ok(nodeBounds.left + nodeBounds.width <= width + 0.001)
    assert.ok(nodeBounds.top + nodeBounds.height <= height + 0.001)
    for (const state of [{ level: 'orchestra' }, ...familyIds.map(familyId => ({ level: 'family', familyId })), { level: 'instrument', familyId: 'woodwinds', instrumentId: 'flute' }]) {
      const camera = new THREE.PerspectiveCamera(config.camera.fov, width / height, .1, 200)
      const focus = cameraFocus(positions, state, width / height, config.camera.fov, width, height)
      camera.position.copy(focus.position)
      camera.lookAt(focus.center)
      camera.updateMatrixWorld()
      const project = (x, y, z) => {
        const p = new THREE.Vector3(x, y, z).project(camera)
        return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 }
      }
      const projectNode = node => {
        const p = project(...node.position)
        const ex = project(node.position[0] + node.radius, node.position[1], node.position[2])
        const ey = project(node.position[0], node.position[1] + node.radius, node.position[2])
        const rx = Math.max(2, Math.abs(ex.x - p.x)), ry = Math.max(2, Math.abs(ey.y - p.y))
        return { x: p.x - rx, y: p.y - ry, width: 2 * rx, height: 2 * ry }
      }
      const entities = mapLabels(config, state).map(target => ({ id: target.id, corner: labelCornerFor(target.placementId),
        labelSize: { width: Math.min(220, target.name.length * 8 + 22), height: width <= compactMapLabelWidth ? 28 : 44 },
        nodes: positions.filter(node => node.visible !== false && familySections(target.state.familyId).includes(node.sectionId)
          && (target.state.level !== 'instrument' || node.instrument === target.state.instrumentId)).map(projectNode),
      }))
      const viewport = { x: 0, y: 0, width, height }
      const orchestraNodes = positions.filter(node => node.visible !== false && node.id !== 'conductor').map(projectNode)
      const layouts = state.level === 'orchestra'
        ? layoutOrchestraFamilyLabels(entities, orchestraNodes, viewport)
        : layoutEntities(entities.filter(entity => entity.nodes.length), viewport)
      assert.equal(layouts.length, entities.filter(entity => entity.nodes.length).length)
      if (state.level === 'orchestra') {
        const orchestraBounds = layouts[0] && {
          x: Math.min(...orchestraNodes.map(node => node.x)),
          y: Math.min(...orchestraNodes.map(node => node.y)),
          width: Math.max(...orchestraNodes.map(node => node.x + node.width)) - Math.min(...orchestraNodes.map(node => node.x)),
          height: Math.max(...orchestraNodes.map(node => node.y + node.height)) - Math.min(...orchestraNodes.map(node => node.y)),
        }
        for (const entity of layouts) {
          const placement = orchestraFamilyLabelPositions[entity.id]
          const normalized = width <= compactMapLabelWidth && placement.compact ? placement.compact : placement.default
          const anchor = resolveNormalizedMapPosition(normalized, orchestraBounds)
          const expectedX = Math.max(orchestraLabelViewportPadding, Math.min(width - entity.label.width - orchestraLabelViewportPadding, anchor.x - entity.label.width / 2))
          const expectedY = Math.max(orchestraLabelViewportPadding, Math.min(height - entity.label.height - orchestraLabelViewportPadding, anchor.y - entity.label.height / 2))
          assert.ok(Math.abs(entity.label.x - expectedX) < 0.01, `normalized x: ${width}x${height} ${entity.id}`)
          assert.ok(Math.abs(entity.label.y - expectedY) < 0.01, `normalized y: ${width}x${height} ${entity.id}`)
          for (const other of layouts) {
            if (other.id > entity.id) assert.equal(overlap(entity.label, other.label), 0, `root label separation: ${width}x${height} ${entity.id}/${other.id}`)
          }
          const gapPoint = {
            x: (entity.label.x + entity.label.width / 2 + entity.centroid.x) / 2,
            y: (entity.label.y + entity.label.height / 2 + entity.centroid.y) / 2,
          }
          const inside = (rect, point) => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
          if (!inside(entity.label, gapPoint) && !inside(entity.region, gapPoint)) {
            assert.notEqual(pickEntity(layouts, gapPoint), entity.id, `separate label/constellation targets: ${width}x${height} ${entity.id}`)
          }
        }
      }
      if (state.level === 'family' && state.familyId === 'strings' && width >= 768) {
        assert.equal(layouts.find(entity => entity.id === 'violin')?.corner, 'bottom-left')
        assert.equal(layouts.find(entity => entity.id === 'viola')?.corner, 'bottom-left')
        assert.equal(layouts.find(entity => entity.id === 'cello')?.corner, 'bottom-right')
        assert.equal(layouts.find(entity => entity.id === 'doubleBass')?.corner, 'top-right')
      }
      if (state.level === 'instrument') assert.equal(layouts.length, 0, 'Explore belongs to the identity group')
      for (const entity of layouts) {
        const r = entity.label
        const context = `${width}x${height} ${state.familyId ?? state.level}: ${entity.id}`
        assert.ok(r.width >= 1 && r.height >= 1, context)
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= width && r.y + r.height <= height, context)
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2
        if (state.level !== 'orchestra') {
          const right = entity.corner.includes('right')
          const bottom = entity.corner.includes('bottom')
          const cornerX = right ? entity.bounds.x + entity.bounds.width - r.width : entity.bounds.x
          const cornerY = bottom ? entity.bounds.y + entity.bounds.height + labelGap : entity.bounds.y - r.height - labelGap
          const fits = cornerX >= 2 && cornerY >= 2 && cornerX + r.width <= width - 2 && cornerY + r.height <= height - 2
          if (fits) {
            const edgeX = right ? r.x + r.width : r.x
            const boxX = right ? entity.bounds.x + entity.bounds.width : entity.bounds.x
            const edgeY = bottom ? r.y : r.y + r.height
            const boxY = bottom ? entity.bounds.y + entity.bounds.height : entity.bounds.y
            assert.ok(Math.abs(edgeX - boxX) < 0.6, `${entity.corner} x: ${context}`)
            assert.ok(Math.abs(edgeY - boxY - (bottom ? labelGap : -labelGap)) < 0.6, `${entity.corner} y: ${context}`)
          }
        }
        const point = { x: cx, y: cy }
        const inside = (r, p) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height
        const onForeignNode = layouts.some(other => other.id !== entity.id && other.nodes.some(node => inside(node, point)))
        if (!onForeignNode) {
          assert.equal(pickEntity(layouts, point), entity.id, context)
          assert.equal(pickEntity([...layouts].reverse(), point), entity.id, `DOM-order independence: ${context}`)
        }
        for (const node of entity.nodes) {
          const p = { x: node.x + node.width / 2, y: node.y + node.height / 2 }
          assert.equal(pickEntity(layouts, p), entity.id, `Node target: ${context}`)
        }
      }
    }
  }
  const cello = { level: 'instrument', familyId: 'strings', instrumentId: 'cello' }
  const portrait = cameraFocus(positions, cello, 390 / 844, config.camera.fov, 390, 844)
  const landscape = cameraFocus(positions, cello, 844 / 390, config.camera.fov, 844, 390)
  const tabletPortrait = cameraFocus(positions, cello, 768 / 1024, config.camera.fov, 768, 1024)
  const desktop = cameraFocus(positions, cello, 1440 / 900, config.camera.fov, 1440, 900)
  const family = { level: 'family', familyId: 'strings' }
  const familyPortrait = cameraFocus(positions, family, 390 / 844, config.camera.fov, 390, 844)
  const familyLandscape = cameraFocus(positions, family, 844 / 390, config.camera.fov, 844, 390)
  const portraitDistance = portrait.position.z - portrait.center.z
  const expectedShift = portraitDistance * Math.tan(THREE.MathUtils.degToRad(config.camera.fov / 2)) * 2 * instrumentPortraitShiftViewportFraction
  assert.equal(isMobilePortraitViewport(390, 844), true)
  assert.equal(isMobilePortraitViewport(844, 390), false)
  assert.equal(isMobilePortraitViewport(768, 1024), false)
  assert.ok(Math.abs(portrait.center.y - landscape.center.y - expectedShift) < 1e-6, 'instrument mobile portrait framing shifts down 10% of the viewport')
  assert.ok(Math.abs(landscape.center.y - desktop.center.y) < 1e-6, 'instrument landscape and desktop keep the selected-group center')
  assert.ok(Math.abs(tabletPortrait.center.y - landscape.center.y) < 1e-6, 'tablet portrait does not use the mobile instrument shift')
  assert.ok(Math.abs(familyPortrait.center.y - familyLandscape.center.y) < 1e-6, 'family framing does not use the instrument portrait shift')
  const framingDistance = (focus) => focus.position.z - focus.center.z
  const capped = cameraFocus(positions, cello, maxFramingViewport.width / maxFramingViewport.height, config.camera.fov, maxFramingViewport.width, maxFramingViewport.height)
  const doubledViewport = cameraFocus(positions, cello, maxFramingViewport.width / maxFramingViewport.height, config.camera.fov, maxFramingViewport.width * 2, maxFramingViewport.height * 2)
  assert.ok(Math.abs(framingDistance(doubledViewport) / framingDistance(capped) - 2) < 1e-6, 'zoom stops growing past the maximum framing viewport')
  const insideCap = cameraFocus(positions, cello, 1024 / 640, config.camera.fov, 1024, 640)
  assert.ok(Math.abs(framingDistance(insideCap) - framingDistance(cameraFocus(positions, cello, 800 / 500, config.camera.fov, 800, 500))) < 1e-6, 'viewports inside the framing cap keep the same zoom at the same aspect')
  assert.ok(Math.abs(framingDistance(desktop) / framingDistance(cameraFocus(positions, cello, 1280 / 800, config.camera.fov, 1280, 800)) - 1440 / 1280) < 1e-6, 'a desktop wider than the cap pulls the instrument zoom back')
  // Violin spans most of the strings family's own footprint, so instrument's
  // full pullback (vs. family's partial pullback) could otherwise push its
  // zoom back further than the family view it came from on a large screen.
  const violin = { level: 'instrument', familyId: 'strings', instrumentId: 'violin' }
  for (const [w, h] of [[1920, 1080], [2560, 1440], [1440, 900], [844, 390]]) {
    const violinFocus = cameraFocus(positions, violin, w / h, config.camera.fov, w, h)
    const stringsFocus = cameraFocus(positions, family, w / h, config.camera.fov, w, h)
    assert.ok(framingDistance(violinFocus) <= framingDistance(stringsFocus) + 1e-6,
      `violin instrument zoom never pulls back past the strings family zoom at ${w}x${h}`)
  }
  const orchestra = { level: 'orchestra' }
  // Isolate the new portrait shift from both the pre-existing lift and from
  // portrait/landscape using different occupancy tiers (which give different
  // distances) by reconstructing the expected center.y from the actual
  // returned distance, rather than comparing portrait and landscape directly.
  const orchestraVisiblePositions = positions.filter(node => node.visible !== false)
  const orchestraBoundsCenterY = new THREE.Box3().setFromPoints(orchestraVisiblePositions.map(node => new THREE.Vector3(...node.position)))
    .getCenter(new THREE.Vector3()).y
  const orchestraTangent = Math.tan(THREE.MathUtils.degToRad(config.camera.fov / 2))
  const expectedOrchestraCenterY = (focus, narrowPortrait, landscape = false) => {
    const distance = focus.position.z - focus.center.z
    const lift = distance * orchestraTangent * 2 * (orchestraLiftViewportFraction + (landscape ? orchestraLandscapeLiftViewportFraction : 0))
    const shift = narrowPortrait ? distance * orchestraTangent * 2 * orchestraPortraitShiftViewportFraction : 0
    return orchestraBoundsCenterY - lift + shift
  }
  const orchestraPortrait = cameraFocus(positions, orchestra, 390 / 844, config.camera.fov, 390, 844)
  const orchestraLandscape = cameraFocus(positions, orchestra, 844 / 390, config.camera.fov, 844, 390)
  const orchestraTabletPortrait = cameraFocus(positions, orchestra, 768 / 1024, config.camera.fov, 768, 1024)
  assert.ok(Math.abs(orchestraPortrait.center.y - expectedOrchestraCenterY(orchestraPortrait, true)) < 1e-6,
    'full orchestra portrait framing shifts down toward the bottom on top of the existing lift')
  assert.ok(Math.abs(orchestraTabletPortrait.center.y - expectedOrchestraCenterY(orchestraTabletPortrait, true)) < 1e-6,
    'tablet portrait also shifts the full orchestra down, unlike the instrument-only mobile shift')
  assert.ok(Math.abs(orchestraLandscape.center.y - expectedOrchestraCenterY(orchestraLandscape, false, true)) < 1e-6,
    'full orchestra landscape framing does not get the portrait shift')
  const orchestraAspect = maxOrchestraFramingViewport.width / maxOrchestraFramingViewport.height
  const orchestraBelowCap = cameraFocus(positions, orchestra, orchestraAspect, config.camera.fov, 1600, 900)
  const orchestraAtCap = cameraFocus(positions, orchestra, orchestraAspect, config.camera.fov, maxOrchestraFramingViewport.width, maxOrchestraFramingViewport.height)
  const orchestraBeyondCap = cameraFocus(positions, orchestra, orchestraAspect, config.camera.fov, maxOrchestraFramingViewport.width * 2, maxOrchestraFramingViewport.height * 2)
  const familyLarge = cameraFocus(positions, family, maxFramingViewport.width / maxFramingViewport.height, config.camera.fov, maxFramingViewport.width * 2, maxFramingViewport.height * 2)
  const familyFit = cameraFocus(positions, family, maxFramingViewport.width / maxFramingViewport.height, config.camera.fov, maxFramingViewport.width, maxFramingViewport.height)
  assert.ok(Math.abs(framingDistance(orchestraBelowCap) - framingDistance(orchestraAtCap)) < 1e-6,
    'the full orchestra keeps filling screens up to its own maximum framing viewport')
  assert.ok(Math.abs(framingDistance(orchestraBeyondCap) / framingDistance(orchestraAtCap) - 2) < 1e-6,
    'the full orchestra zoom stops growing past its own maximum framing viewport')
  // Desktop-landscape framing clamps to [minLandscapeFramingAspect, maxLandscapeFramingAspect]:
  // screens outside the band should match the band edge exactly (letterboxed), not drift with extremity.
  // Dimensions here stay well inside maxOrchestraFramingViewport so that separate
  // "giant screen" pullback doesn't contaminate the comparison.
  const atMaxAspect = cameraFocus(positions, orchestra, maxLandscapeFramingAspect, config.camera.fov, 600 * maxLandscapeFramingAspect, 600)
  const beyondMaxAspect = cameraFocus(positions, orchestra, 2.4, config.camera.fov, 600 * 2.4, 600)
  const wellBeyondMaxAspect = cameraFocus(positions, orchestra, 3.2, config.camera.fov, 600 * 3.2, 600)
  assert.ok(Math.abs(framingDistance(beyondMaxAspect) - framingDistance(atMaxAspect)) < 1e-6
    && Math.abs(beyondMaxAspect.center.y - atMaxAspect.center.y) < 1e-6,
    'an ultrawide screen frames the full orchestra identically to the max-aspect band edge')
  assert.ok(Math.abs(framingDistance(wellBeyondMaxAspect) - framingDistance(atMaxAspect)) < 1e-6,
    'framing past the max-aspect band stays pinned regardless of how much wider the screen gets')
  // Below minLandscapeFramingAspect, the camera can't both stay pinned to the
  // band edge AND avoid clipping on an arbitrarily squarer screen (a
  // perspective camera's horizontal reach scales with aspect, but its
  // vertical reach doesn't, so there's no single fixed reference that's safe
  // at every degree of narrowness). Framing instead degrades smoothly:
  // horizontal fill grows toward a safe ceiling as the screen narrows, then
  // vertical fill alone keeps shrinking (more letterboxing) beyond that —
  // verified here by confirming nothing clips past the real viewport edges,
  // and that the horizontal fill fraction plateaus (does not keep growing)
  // once a screen is well past the band.
  const orchestraVisible = positions.filter(node => node.visible !== false)
  const achievedFill = (focus, squareAspect, squareWidth, squareHeight) => {
    const camera = new THREE.PerspectiveCamera(config.camera.fov, squareAspect, .1, 200)
    camera.position.copy(focus.position)
    camera.lookAt(focus.center)
    camera.updateMatrixWorld()
    const xs = [], ys = []
    for (const node of orchestraVisible) {
      const p = new THREE.Vector3(...node.position).project(camera)
      xs.push((p.x + 1) * squareWidth / 2)
      ys.push((1 - p.y) * squareHeight / 2)
    }
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
  }
  for (const narrowAspect of [1.2, 1.05, 1.01]) {
    const width = 1100, height = width / narrowAspect
    const focus = cameraFocus(positions, orchestra, narrowAspect, config.camera.fov, width, height)
    const bounds = achievedFill(focus, narrowAspect, width, height)
    assert.ok(bounds.minX >= 0 && bounds.maxX <= width && bounds.minY >= 0 && bounds.maxY <= height,
      `full orchestra stays within a ${narrowAspect}-aspect viewport, not clipped by the min-aspect clamp`)
  }
  const belowMinFill = achievedFill(
    cameraFocus(positions, orchestra, 1.2, config.camera.fov, 1100, 1100 / 1.2), 1.2, 1100, 1100 / 1.2)
  const wellBelowMinFill = achievedFill(
    cameraFocus(positions, orchestra, 1.05, config.camera.fov, 1100, 1100 / 1.05), 1.05, 1100, 1100 / 1.05)
  assert.ok(Math.abs((belowMinFill.maxX - belowMinFill.minX) / 1100 - (wellBelowMinFill.maxX - wellBelowMinFill.minX) / 1100) < 1e-3,
    'horizontal fill plateaus once a screen is well past the min-aspect band, rather than growing without bound')
  const midBand = cameraFocus(positions, orchestra, 1.7, config.camera.fov, 1700, 1000)
  assert.ok(Math.abs(framingDistance(midBand) - framingDistance(cameraFocus(positions, orchestra, 1.7, config.camera.fov, 1360, 800))) < 1e-6,
    'in-band desktop landscape screens keep the same zoom at the same aspect regardless of resolution')
  // Mirrors the desktop-landscape band, in mobile landscape's own range.
  const midMobileLandscapeBand = cameraFocus(positions, orchestra, 2.0, config.camera.fov, 800, 400)
  assert.ok(Math.abs(framingDistance(midMobileLandscapeBand) - framingDistance(cameraFocus(positions, orchestra, 2.0, config.camera.fov, 600, 300))) < 1e-6,
    'in-band mobile landscape screens keep the same zoom at the same aspect regardless of resolution')
  const atMaxMobileLandscapeAspect = cameraFocus(positions, orchestra, maxMobileLandscapeFramingAspect, config.camera.fov, 350 * maxMobileLandscapeFramingAspect, 350)
  const beyondMaxMobileLandscapeAspect = cameraFocus(positions, orchestra, 2.8, config.camera.fov, 350 * 2.8, 350)
  assert.ok(Math.abs(framingDistance(beyondMaxMobileLandscapeAspect) - framingDistance(atMaxMobileLandscapeAspect)) < 1e-6
    && Math.abs(beyondMaxMobileLandscapeAspect.center.y - atMaxMobileLandscapeAspect.center.y) < 1e-6,
    'a taller-than-band phone in landscape frames the full orchestra identically to the max-aspect band edge')
  for (const narrowMobileLandscapeAspect of [1.5, 1.3, 1.1]) {
    const width = 800, height = width / narrowMobileLandscapeAspect
    const focus = cameraFocus(positions, orchestra, narrowMobileLandscapeAspect, config.camera.fov, width, height)
    const bounds = achievedFill(focus, narrowMobileLandscapeAspect, width, height)
    assert.ok(bounds.minX >= 0 && bounds.maxX <= width && bounds.minY >= 0 && bounds.maxY <= height,
      `full orchestra stays within a ${narrowMobileLandscapeAspect}-aspect mobile landscape viewport, not clipped by the min-aspect clamp`)
  }
  // Mirrors the desktop-landscape band, in mobile portrait's much narrower range.
  const midPortraitBand = cameraFocus(positions, orchestra, 0.5, config.camera.fov, 375, 750)
  assert.ok(Math.abs(framingDistance(midPortraitBand) - framingDistance(cameraFocus(positions, orchestra, 0.5, config.camera.fov, 300, 600))) < 1e-6,
    'in-band mobile portrait screens keep the same zoom at the same aspect regardless of resolution')
  const atMaxPortraitAspect = cameraFocus(positions, orchestra, maxPortraitFramingAspect, config.camera.fov, 600 * maxPortraitFramingAspect, 600)
  const beyondMaxPortraitAspect = cameraFocus(positions, orchestra, 0.75, config.camera.fov, 600 * 0.75, 600)
  assert.ok(Math.abs(framingDistance(beyondMaxPortraitAspect) - framingDistance(atMaxPortraitAspect)) < 1e-6
    && Math.abs(beyondMaxPortraitAspect.center.y - atMaxPortraitAspect.center.y) < 1e-6,
    'a stouter-than-band phone frames the full orchestra identically to the max-aspect band edge')
  // A 768x1024 tablet (e.g. iPad Mini) is squarer than any phone and sits
  // between the phone (<768) and desktop (>=1024) width tiers; the band
  // still applies so it doesn't render a taller-than-intended formation
  // (which previously pushed the identity caption toward the top of the screen).
  // Both viewports below share the same [768, 1024) occupancy tier and real
  // height, isolating the band's effect from the separate occupancy tiering.
  const iPadMiniPortrait = cameraFocus(positions, orchestra, 768 / 1024, config.camera.fov, 768, 1024)
  const widerTabletPortrait = cameraFocus(positions, orchestra, 1000 / 1024, config.camera.fov, 1000, 1024)
  assert.ok(Math.abs(framingDistance(iPadMiniPortrait) - framingDistance(widerTabletPortrait)) < 1e-6
    && Math.abs(iPadMiniPortrait.center.y - widerTabletPortrait.center.y) < 1e-6,
    'tablet-width portrait screens past the max-aspect band frame the full orchestra identically, not at their own wider true aspect')
  for (const narrowPortraitAspect of [0.35, 0.3, 0.25, 0.15]) {
    const width = 400, height = width / narrowPortraitAspect
    const focus = cameraFocus(positions, orchestra, narrowPortraitAspect, config.camera.fov, width, height)
    const bounds = achievedFill(focus, narrowPortraitAspect, width, height)
    assert.ok(bounds.minX >= 0 && bounds.maxX <= width && bounds.minY >= 0 && bounds.maxY <= height,
      `full orchestra stays within a ${narrowPortraitAspect}-aspect portrait viewport, not clipped by the min-aspect clamp`)
  }
  assert.ok(Math.abs(framingDistance(familyLarge) / framingDistance(familyFit) - (1 + familyFramingPullbackShare)) < 1e-6, 'family zoom pulls back partway on a large screen')
  assert.ok(framingDistance(familyLarge) / framingDistance(familyFit) < framingDistance(doubledViewport) / framingDistance(capped), 'family zoom stays closer than the instrument cap')
  console.log(`Passed root normalized captions, nested corner captions, viewport clamp, and picking across ${viewports.length} viewports and all families.`)
}
