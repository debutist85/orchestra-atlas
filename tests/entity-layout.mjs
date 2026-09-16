import assert from 'node:assert/strict'
import * as THREE from 'three'

export async function verifyEntityLayout(server) {
  const { layoutEntities, pickEntity, labelGap, labelCornerFor, resolveLabelCorner } = await server.ssrLoadModule('/src/features/orchestra-installation/entity-layout.ts')
  const viewport = { x: 0, y: 0, width: 200, height: 200 }
  const box = { x: 20, y: 20, width: 40, height: 40 }
  const chip = { width: 80, height: 36 }
  assert.equal(resolveLabelCorner(box, chip, 'bottom-left', viewport), 'bottom-left')
  assert.equal(resolveLabelCorner({ x: 10, y: 160, width: 40, height: 30 }, chip, 'bottom-left', viewport), 'top-left')
  assert.equal(resolveLabelCorner({ x: 10, y: 5, width: 40, height: 30 }, chip, 'top-right', viewport), 'bottom-left')
  assert.equal(labelCornerFor('violin'), 'bottom-left')
  assert.equal(labelCornerFor('violin', 'top-right'), 'top-right')
  assert.equal(labelCornerFor('cello'), 'bottom-right')
  assert.equal(labelCornerFor('viola'), 'bottom-left')
  assert.equal(labelCornerFor('viola', 'top-left'), 'top-left')
  assert.equal(labelCornerFor('explore:flute'), 'top-left')
  assert.equal(labelCornerFor('explore:cello'), 'bottom-right')
  assert.equal(labelCornerFor('strings'), 'bottom-left')
  assert.equal(labelCornerFor('woodwinds'), 'top-right')
  assert.equal(labelCornerFor('brass'), 'bottom-right')
  const { orchestraScenePresets } = await server.ssrLoadModule('/src/features/orchestra-installation/config.ts')
  const { createOrchestraPositions } = await server.ssrLoadModule('/src/features/orchestra-installation/seating.ts')
  const { cameraFocus } = await server.ssrLoadModule('/src/features/orchestra-installation/camera-focus.ts')
  const { mapLabels, familySections, familyIds } = await server.ssrLoadModule('/src/features/orchestra-installation/navigation.ts')
  const config = orchestraScenePresets['classical-wide']
  const positions = createOrchestraPositions(config)
  for (const [width, height] of [[1440, 900], [768, 1024], [320, 568], [375, 667], [390, 844], [430, 932], [844, 390]]) {
    for (const state of [{ level: 'orchestra' }, ...familyIds.map(familyId => ({ level: 'family', familyId })), { level: 'instrument', familyId: 'woodwinds', instrumentId: 'flute' }]) {
      const camera = new THREE.PerspectiveCamera(config.camera.fov, width / height, .1, 200)
      const focus = cameraFocus(positions, state, width / height, config.camera.fov)
      camera.position.copy(focus.position)
      camera.lookAt(focus.center)
      camera.updateMatrixWorld()
      const project = (x, y, z) => {
        const p = new THREE.Vector3(x, y, z).project(camera)
        return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 }
      }
      const entities = mapLabels(config, state).map(target => ({ id: target.id, corner: labelCornerFor(target.placementId),
        labelSize: { width: Math.min(220, target.name.length * 8 + 22), height: 44 },
        nodes: positions.filter(node => node.visible !== false && familySections(target.state.familyId).includes(node.sectionId)
          && (target.state.level !== 'instrument' || node.instrument === target.state.instrumentId)).map(node => {
          const p = project(...node.position)
          const e = project(node.position[0] + node.radius, node.position[1], node.position[2])
          const r = Math.abs(e.x - p.x)
          return { x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r }
        }),
      }))
      const layouts = layoutEntities(entities.filter(entity => entity.nodes.length), { x: 0, y: 0, width, height }, [])
      assert.equal(layouts.length, entities.filter(entity => entity.nodes.length).length)
      if (state.level === 'orchestra' && width >= 768) {
        assert.equal(layouts.find(entity => entity.id === 'strings')?.corner, 'bottom-left')
        assert.equal(layouts.find(entity => entity.id === 'woodwinds')?.corner, 'top-right')
        assert.equal(layouts.find(entity => entity.id === 'brass')?.corner, 'bottom-right')
      }
      if (state.level === 'family' && state.familyId === 'strings' && width >= 768) {
        assert.equal(layouts.find(entity => entity.id === 'violin')?.corner, 'bottom-left')
        assert.equal(layouts.find(entity => entity.id === 'viola')?.corner, 'bottom-left')
        assert.equal(layouts.find(entity => entity.id === 'cello')?.corner, 'bottom-right')
        assert.equal(layouts.find(entity => entity.id === 'doubleBass')?.corner, 'top-right')
      }
      if (state.level === 'instrument' && state.instrumentId === 'flute') {
        assert.equal(layouts.length, 1)
        assert.equal(layouts[0].id, 'explore:flute')
        assert.equal(layouts[0].corner, 'top-left')
      }
      for (const entity of layouts) {
        const r = entity.label
        const context = `${width}x${height} ${state.familyId ?? state.level}: ${entity.id}`
        assert.ok(r.width >= 1 && r.height >= 1, context)
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= width && r.y + r.height <= height, context)
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2
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
  console.log('Passed corner constellation captions, viewport clamp, minimum target sizes, and picking across seven viewports and all families.')
}
