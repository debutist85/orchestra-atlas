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
  const { liquidOrbConfig, applyOrbState } = await server.ssrLoadModule('/src/features/liquid-orb/index.ts')
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
  const flow = orbs.mesh.geometry.getAttribute('orbFlow')
  const light = orbs.mesh.geometry.getAttribute('orbLight')
  const state = { opacity: 1, emphasis: 0, activity: 0 }
  assert.equal(orbs.mesh.instanceMatrix, proxy.instanceMatrix, 'loading motion and seating share the original transforms')
  assert.equal(orbs.mesh.geometry.getAttribute('nodePalette'), palette, 'signature colors come from the existing palette')
  assert.equal(orbs.mesh.material.transparent, true)
  assert.equal(orbs.mesh.material.premultipliedAlpha, true)
  assert.equal(orbs.mesh.material.depthWrite, false, 'transparent glow cannot occlude later lights')
  orbs.update(0, state, false, new Map())
  const idle = { ...liquidOrbConfig.material }
  applyOrbState(idle, liquidOrbConfig.material, 'playing', 0, 0)
  assert.ok(Math.abs(flow.getY(0) - idle.complexity) < 1e-6)
  assert.ok(Math.abs(flow.getZ(0) - idle.distortion) < 1e-6, 'rest uses zero-intensity flow')
  const startingPhase = flow.getX(0)
  const music = new Map([['violin', { active: true, intensity: 1, attack: 1 }]])
  for (let i = 0; i < 60; i++) orbs.update(1 / 60, state, false, music)
  assert.ok(flow.getX(0) > startingPhase, 'phase advances continuously')
  assert.ok(flow.getZ(0) > idle.distortion, 'music and attacks increase amplitude')
  assert.ok(flow.getW(0) > idle.strands, 'music increases density')
  assert.ok(flow.getW(0) <= liquidOrbConfig.rendering.maxStrands)
  const normalGlow = light.getY(0)
  orbs.update(0, { ...state, emphasis: 1 }, false, music)
  assert.ok(light.getY(0) > normalGlow, 'hover increases glow')
  orbs.update(0, { ...state, emphasis: -1 }, false, music)
  assert.ok(light.getW(0) < 1 && light.getY(0) < normalGlow, 'navigation dimming recedes')
  orbs.update(0, { ...state, opacity: 0 }, false, music)
  assert.equal(light.getW(0), 0, 'launch/reveal opacity applies to the orbs')
  orbs.update(0, state, true, music)
  const frozenPhase = flow.getX(0)
  orbs.update(1, state, true, music)
  assert.equal(flow.getX(0), frozenPhase, 'reduced motion freezes flow phase')
  assert.ok(Math.abs(flow.getZ(0) - idle.distortion) < 1e-6, 'reduced motion suppresses transient deformation')
  assert.deepEqual([...proxy.instanceMatrix.array], originalMatrices, 'appearance does not move nodes')
  assert.deepEqual(nodes, originalPositions)
  // Invisible proxies must remain raycastable without adopting the glow quad's size.
  proxy.visible = false
  proxy.updateMatrixWorld(true)
  const center = new THREE.Vector3(...nodes[0].position)
  const ray = new THREE.Raycaster(center.clone().add(new THREE.Vector3(0, 0, 10)), new THREE.Vector3(0, 0, -1))
  assert.ok(ray.intersectObject(proxy, false).some(hit => hit.instanceId === 0), 'invisible original geometry still picks the node')
  orbs.mesh.geometry.dispose(); orbs.mesh.material.dispose()
  proxy.geometry.dispose(); proxy.material.dispose()
  console.log('Passed instanced liquid constellation: signature colors, stable transforms/picking, idle/playback/attack/hover/dim states, transparency, and reduced motion.')
} finally {
  await server.close()
}
