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
  const { cameraFocus, instrumentPortraitShiftViewportFraction, isMobilePortraitViewport, maxFramingViewport, familyFramingPullbackShare } = await server.ssrLoadModule('/src/features/orchestra-map/three/camera-focus.ts')
  const { mapLabels, familySections, familyIds } = await server.ssrLoadModule('/src/features/orchestra-map/utils/navigation.ts')
  const config = orchestraSceneConfig
  const positions = createOrchestraPositions(config)
  const viewports = [[1440, 900], [1024, 768], [768, 1024], [320, 568], [375, 667], [390, 844], [430, 932], [844, 390]]
  for (const [width, height] of viewports) {
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
  const orchestra = { level: 'orchestra' }
  const orchestraFit = cameraFocus(positions, orchestra, maxFramingViewport.width / maxFramingViewport.height, config.camera.fov, maxFramingViewport.width, maxFramingViewport.height)
  const orchestraLarge = cameraFocus(positions, orchestra, maxFramingViewport.width / maxFramingViewport.height, config.camera.fov, maxFramingViewport.width * 2, maxFramingViewport.height * 2)
  const familyLarge = cameraFocus(positions, family, maxFramingViewport.width / maxFramingViewport.height, config.camera.fov, maxFramingViewport.width * 2, maxFramingViewport.height * 2)
  const familyFit = cameraFocus(positions, family, maxFramingViewport.width / maxFramingViewport.height, config.camera.fov, maxFramingViewport.width, maxFramingViewport.height)
  assert.ok(Math.abs(framingDistance(orchestraLarge) - framingDistance(orchestraFit)) < 1e-6, 'the full orchestra keeps filling a large screen')
  assert.ok(Math.abs(framingDistance(familyLarge) / framingDistance(familyFit) - (1 + familyFramingPullbackShare)) < 1e-6, 'family zoom pulls back partway on a large screen')
  assert.ok(framingDistance(familyLarge) / framingDistance(familyFit) < framingDistance(doubledViewport) / framingDistance(capped), 'family zoom stays closer than the instrument cap')
  console.log(`Passed root normalized captions, nested corner captions, viewport clamp, and picking across ${viewports.length} viewports and all families.`)
}
