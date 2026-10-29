import { verifyPerformance } from './map-performance.mjs'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createServer } from 'vite'

const server = await createServer({
  mode: 'test', configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false }, appType: 'custom',
})
try {
  const { createLiquidNodes } = await server.ssrLoadModule('/src/features/orchestra-map/three/liquid-node-material.ts')
  const { createOrchestraPositions } = await server.ssrLoadModule('/src/features/orchestra-map/three/seating.ts')
  const { nodeBaseColor } = await server.ssrLoadModule('/src/features/orchestra-map/three/section-palette.ts')
  const { orchestraSceneConfig: config } = await server.ssrLoadModule('/src/features/orchestra-map/config.ts')
  const { liquidOrbConfig } = await server.ssrLoadModule('/src/features/liquid-orb/index.ts')
  const positions = createOrchestraPositions(config)
  const nodes = positions.filter(node => node.visible !== false && node.instrument === 'violin').slice(0, 2)
  assert.equal(nodes.length, 2)
  const originalPositions = structuredClone(nodes)
  const geometry = new THREE.CylinderGeometry(1, 1, .12, 32).rotateX(Math.PI / 2)
  const palette = new THREE.InstancedBufferAttribute(new Float32Array(nodes.length * 3), 3)
  nodes.forEach((node, i) => {
    const color = new THREE.Color(nodeBaseColor(node, config))
    palette.setXYZ(i, color.r, color.g, color.b)
  })
  geometry.setAttribute('nodePalette', palette)
  geometry.setAttribute('nodeFocus', new THREE.InstancedBufferAttribute(new Float32Array(nodes.length).fill(1), 1))
  geometry.setAttribute('nodeIdle', new THREE.InstancedBufferAttribute(new Float32Array(nodes.length).fill(1), 1))
  const proxy = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), nodes.length)
  const matrix = new THREE.Matrix4()
  nodes.forEach((node, i) => proxy.setMatrixAt(i, matrix.makeScale(node.radius, node.radius, node.radius).setPosition(...node.position)))
  const originalMatrices = [...proxy.instanceMatrix.array]
  const orbs = createLiquidNodes(proxy, nodes, config.visuals.interaction)
  const light = orbs.mesh.geometry.getAttribute('orbLight')
  const state = { opacity: 1, emphasis: 0, activity: 0 }
  assert.equal(orbs.mesh.instanceMatrix, proxy.instanceMatrix, 'loading motion and seating share the original transforms')
  assert.equal(orbs.mesh.geometry.getAttribute('nodePalette'), palette, 'signature colors come from the existing palette')
  assert.equal(orbs.mesh.material.transparent, true)
  assert.equal(orbs.mesh.material.premultipliedAlpha, true)
  assert.equal(orbs.mesh.material.depthWrite, false, 'transparent glow cannot occlude later lights')
  orbs.update(0, state, false, new Map())
  const base = light.getX(0)
  assert.ok(Math.abs(base - liquidOrbConfig.filled.brightness) < 1e-6)
  assert.equal(light.getY(0), 0, 'idle has no corona')
  const idleVersion = light.version
  for (let i = 0; i < 10; i++) orbs.update(1 / 30, state, false, new Map())
  assert.equal(light.version, idleVersion, 'unchanged light data is not uploaded')
  assert.equal(orbs.discMesh.instanceMatrix, proxy.instanceMatrix)
  assert.notEqual(orbs.discMesh.geometry, orbs.mesh.geometry)
  assert.ok(orbs.discMesh.geometry.parameters.width < orbs.mesh.geometry.parameters.width)
  assert.equal(orbs.discMesh.geometry.getAttribute('orbLight'), light)
  assert.equal(orbs.mesh.geometry.getAttribute('orbFlow'), undefined)
  assert.equal(orbs.discMesh.material.defines.PROTOTYPE_DISC_ONLY, 1)
  assert.equal(orbs.discMesh.layers.mask, 1 << 1)
  assert.equal(orbs.foreground.discMesh.layers.mask, 1 << 2)
  assert.equal(orbs.bloomMesh.instanceMatrix, proxy.instanceMatrix)
  assert.equal(orbs.bloomMesh.geometry, orbs.mesh.geometry)
  assert.equal(orbs.bloomMesh.material.defines.ORB_BLOOM_SOURCE, 1)
  const music = new Map([['violin', { active: true, intensity: 1, attack: 1 }]])
  for (let i = 0; i < 60; i++) orbs.update(1 / 60, state, false, music)
  assert.ok(light.getY(0) > .99 && light.getY(0) <= 1, 'bounded activity drives corona thickness')
  assert.ok(light.getX(0) > base, 'music increases fill brightness')
  orbs.update(0, { ...state, emphasis: -.2 }, false, music)
  assert.equal(light.getY(0), 0, 'dimmed nodes suppress activity rings while music is active')
  orbs.update(0, state, false, new Map())
  assert.equal(light.getY(0), 0, 'inactive nodes suppress release-tail rings')
  orbs.reset()
  const empty = new Map()
  orbs.update(0, state, false, empty, { level: 'instrument', familyId: 'strings', instrumentId: 'violin' })
  assert.ok(Math.abs(light.getX(0) - base * 2) < 1e-6, 'selected doubles brightness')
  assert.equal(light.getZ(0), 1, 'selection does not boost bloom')
  orbs.update(0, { ...state, emphasis: 1 }, false, empty, { level: 'orchestra' }, true)
  assert.ok(Math.abs(light.getZ(0) - 1.8) < 1e-6, 'highlight adds 0.08 bloom to base 0.1')
  assert.ok(light.getX(0) > base)
  // Withdrawal switches navigation before the family emphasis/focus finish easing.
  const focus = geometry.getAttribute('nodeFocus')
  focus.setX(0, 1.3)
  orbs.update(0, { ...state, emphasis: .5 }, false, empty, { level: 'orchestra' })
  assert.ok(Math.abs(light.getX(0) - base) < 1e-6, 'residual family emphasis/focus cannot flash a root highlight')
  assert.equal(light.getZ(0), 1, 'withdrawal does not add highlight bloom')
  focus.setX(0, config.visuals.interaction.selectedInstrumentHoveredIntensity / config.visuals.interaction.familyIntensity)
  orbs.update(0, state, false, empty, { level: 'instrument', familyId: 'strings', instrumentId: 'violin' })
  const scale = liquidOrbConfig.constellation.instrumentHighlightMultiplier
  assert.ok(Math.abs(light.getX(0) - base * 2 * (1 + liquidOrbConfig.filled.activeBrightness * scale)) < 1e-5, 'instrument hover uses its own brightness multiplier')
  assert.ok(Math.abs(light.getZ(0) - (1 + liquidOrbConfig.filled.highlightBloomBoost * scale / .1)) < 1e-5, 'instrument bloom boost follows the same multiplier')
  orbs.update(0, state, false, empty, { level: 'family', familyId: 'strings' })
  assert.ok(Math.abs(light.getX(0) - base * 2 * (1 + liquidOrbConfig.filled.activeBrightness)) < 1e-5, 'family hover retains full intensity')
  focus.setX(0, 1)
  orbs.update(0, { ...state, emphasis: -1 }, false, empty)
  assert.ok(light.getX(0) < base, 'unrelated nodes dim')
  orbs.update(0, { ...state, opacity: 0 }, false, empty)
  assert.equal(light.getW(0), 0, 'reveal opacity applies to both passes')
  orbs.update(1, state, true, music)
  assert.equal(light.getY(0), 0, 'reduced motion suppresses music pulses')
  assert.deepEqual([...proxy.instanceMatrix.array], originalMatrices, 'appearance does not move nodes')
  assert.deepEqual(nodes, originalPositions)
  // Invisible proxies must remain raycastable without adopting the glow quad's size.
  proxy.visible = false
  proxy.updateMatrixWorld(true)
  const center = new THREE.Vector3(...nodes[0].position)
  const ray = new THREE.Raycaster(center.clone().add(new THREE.Vector3(0, 0, 10)), new THREE.Vector3(0, 0, -1))
  assert.ok(ray.intersectObject(proxy, false).some(hit => hit.instanceId === 0), 'invisible original geometry still picks the node')
  const mixedNodes = nodes.map((node, i) => ({ ...node, instrument: i === 0 ? 'violin' : 'cello' }))
  const layered = createLiquidNodes(proxy, mixedNodes, config.visuals.interaction)
  const layer = layered.mesh.geometry.getAttribute('orbForeground')
  const selected = { level: 'instrument', familyId: 'strings', instrumentId: 'violin' }
  layered.update(0, state, false, empty, selected)
  assert.deepEqual([...layer.array], [1, 0], 'only the selected instrument enters the foreground')
  for (const [pass, batch] of Object.entries(layered.foreground)) {
    assert.equal(batch.instanceMatrix, proxy.instanceMatrix, `${pass} shares loading transforms`)
    assert.equal(batch.geometry.getAttribute('orbForeground'), layer)
    assert.equal(batch.material.depthTest, false, 'inactive geometry cannot occlude foreground nodes')
    assert.ok(batch.renderOrder > layered[pass].renderOrder)
    assert.equal(batch.visible, true)
  }
  assert.equal(layered.mesh.visible, true, 'mixed sections retain a background draw')
  const layerVersion = layer.version
  layered.update(0, state, false, empty, selected)
  assert.equal(layer.version, layerVersion, 'stable layer membership does not upload every frame')
  layered.update(0, state, false, empty, selected, false, 'cello')
  assert.deepEqual([...layer.array], [1, 1], 'a departing waving instrument stays in front while settling')
  assert.equal(layered.mesh.visible, false, 'empty background batches do not submit draws')
  layered.update(0, state, false, empty)
  assert.equal(layered.foreground.mesh.visible, false, 'foreground draws stop after selection and wave end')
  assert.equal(layered.mesh.visible, true)
  for (const orb of [orbs, layered]) {
    for (const batch of Object.values(orb.foreground)) { batch.material.dispose(); batch.dispose() }
    orb.discMesh.geometry.dispose(); orb.discMesh.material.dispose(); orb.discMesh.dispose()
    orb.bloomMesh.material.dispose(); orb.bloomMesh.dispose(); orb.mesh.dispose()
    orb.mesh.geometry.dispose(); orb.mesh.material.dispose()
  }
  proxy.geometry.dispose(); proxy.material.dispose()
  await verifyPerformance(server)
  console.log('Passed instanced liquid constellation: signature colors, stable transforms/picking, filled/eclipse/playback/selection/hover/dim states, transparency, and reduced motion.')
} finally {
  await server.close()
}
