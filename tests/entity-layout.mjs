import assert from 'node:assert/strict'
import * as THREE from 'three'

export async function verifyEntityLayout(server) {
  const { layoutEntities, pickEntity, overlap } = await server.ssrLoadModule('/src/features/orchestra-installation/entity-layout.ts')
  const { orchestraScenePresets } = await server.ssrLoadModule('/src/features/orchestra-installation/config.ts')
  const { createOrchestraPositions } = await server.ssrLoadModule('/src/features/orchestra-installation/seating.ts')
  const { cameraFocus } = await server.ssrLoadModule('/src/features/orchestra-installation/camera-focus.ts')
  const { navigationTargets, familySections, familyIds } = await server.ssrLoadModule('/src/features/orchestra-installation/navigation.ts')
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
      const entities = navigationTargets(config, state).map(target => ({ id: target.id,
        labelSize: { width: Math.min(220, target.name.length * 8 + 22), height: 44 },
        nodes: positions.filter(node => node.visible !== false && familySections(target.state.familyId).includes(node.sectionId)
          && (target.state.level !== 'instrument' || node.instrument === target.state.instrumentId)).map(node => {
          const p = project(...node.position)
          const e = project(node.position[0] + node.radius, node.position[1], node.position[2])
          const r = Math.abs(e.x - p.x)
          return { x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r }
        }),
      }))
      const exclusions = [{ x: 20, y: 20, width: 190, height: 55 }, { x: 16, y: height - 130, width: width - 32, height: 110 }]
      const layouts = layoutEntities(entities, { x: 0, y: 0, width, height }, exclusions)
      assert.equal(layouts.length, entities.length)
      for (const entity of layouts) {
        const r = entity.label
        const context = `${width}x${height} ${state.familyId ?? state.level}: ${entity.id}`
        assert.ok(r.width >= 44 && r.height >= 44, context)
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= width && r.y + r.height <= height, context)
        assert.ok(exclusions.every(exclusion => overlap(r, exclusion) === 0), `UI collision: ${context}`)
        assert.ok(layouts.every(other => other === entity || overlap(r, other.label) === 0), `Label collision: ${context}`)
        const point = { x: r.x + r.width / 2, y: r.y + r.height / 2 }
        assert.equal(pickEntity(layouts, point), entity.id, context)
        assert.equal(pickEntity([...layouts].reverse(), point), entity.id, `DOM-order independence: ${context}`)
        for (const node of entity.nodes) {
          const p = { x: node.x + node.width / 2, y: node.y + node.height / 2 }
          assert.equal(pickEntity(layouts, p), entity.id, `Node target: ${context}`)
        }
      }
    }
  }
  console.log('Passed annotation bounds, UI/label collisions, minimum target sizes, constellation picking and ordering across seven viewports and all families.')
}
