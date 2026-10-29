import assert from 'node:assert/strict'
import * as THREE from 'three'

export async function verifyPerformance(server) {
  const { disposeGroup } = await server.ssrLoadModule('/src/features/orchestra-map/three/dispose-group.ts')
  const { CachedBloomPass, RenderInputCache } = await server.ssrLoadModule('/src/features/orchestra-map/three/cached-bloom.ts')
  const { LayerRenderPass } = await server.ssrLoadModule('/src/features/orchestra-map/three/layer-render-pass.ts')
  const { createNodeGhosts } = await server.ssrLoadModule('/src/features/orchestra-map/three/node-ghost.ts')
  const { orchestraSceneConfig } = await server.ssrLoadModule('/src/features/orchestra-map/config.ts')
  const geometry = new THREE.BufferGeometry(), material = new THREE.LineBasicMaterial()
  const group = new THREE.Group()
  group.add(new THREE.Line(geometry, material), new THREE.Line(geometry, material))
  let geometriesDisposed = 0, materialsDisposed = 0
  geometry.addEventListener('dispose', () => geometriesDisposed++)
  material.addEventListener('dispose', () => materialsDisposed++)
  disposeGroup(group)
  assert.equal(geometriesDisposed, 1, 'shared debug guide geometry disposed once')
  assert.equal(materialsDisposed, 1, 'shared debug guide material disposed once')

  const ghosts = createNodeGhosts([{ id: 'test', radius: 1, position: [0, 0, 0] }], orchestraSceneConfig, [new THREE.Color('red')])
  ghosts.setActivity([1], [1]); ghosts.update(0, 1)
  const matrixVersion = ghosts.mesh.instanceMatrix.version, colorVersion = ghosts.mesh.instanceColor.version
  assert.equal(ghosts.mesh.visible, true)
  assert.equal(ghosts.setActivity([1], [1]), false)
  assert.equal(ghosts.mesh.instanceMatrix.version, matrixVersion)
  assert.equal(ghosts.mesh.instanceColor.version, colorVersion)
  ghosts.update(1, 0)
  assert.equal(ghosts.mesh.visible, false, 'zero-strength batches do not submit ghost draws')
  ghosts.mesh.geometry.dispose(); ghosts.mesh.material.dispose(); ghosts.mesh.dispose()

  const key = new RenderInputCache(), matrix = new THREE.Matrix4()
  const track = version => { key.begin(); key.matrix(matrix.elements); key.value(version); return key.end() }
  assert.equal(track(0), true)
  assert.equal(track(0), false)
  matrix.elements[12] = 2
  assert.equal(track(0), true, 'camera/matrix changes invalidate bloom')
  assert.equal(track(1), true, 'attribute changes invalidate bloom')

  let draws = 0
  const renderer = {
    autoClear: true, getClearColor: color => color.set(0), getClearAlpha: () => 0,
    setClearColor() {}, setRenderTarget() {}, clear() {}, render() { draws++ },
  }
  const read = new THREE.WebGLRenderTarget(32, 32), write = read.clone()
  const bloom = new CachedBloomPass(new THREE.Vector2(32, 32), .1, .2, .8)
  bloom.render(renderer, write, read, 0, false)
  assert.equal(draws, 13, 'first frame extracts, blurs, composites and blends')
  draws = 0
  bloom.render(renderer, write, read, 0, false)
  assert.equal(draws, 1, 'unchanged bloom only reapplies its additive texture')
  assert.equal(renderer.autoClear, true)
  bloom.setSize(64, 64)
  draws = 0
  bloom.render(renderer, write, read, 0, false)
  assert.equal(draws, 13, 'resize regenerates cached blur')
  const camera = new THREE.Camera()
  const layerPass = new LayerRenderPass(new THREE.Scene(), camera, 1 << 2)
  let renderedMask
  const layerRenderer = { ...renderer, clearDepth() {}, render(scene, currentCamera) { renderedMask = currentCamera.layers.mask } }
  layerPass.render(layerRenderer, write, read, 0, false)
  assert.equal(renderedMask, 1 << 2, 'disc compositing selects only its designated layer')
  assert.equal(camera.layers.mask, 1, 'later passes and picking retain the original camera layers')
  layerRenderer.render = () => { throw Error('test render failure') }
  assert.throws(() => layerPass.render(layerRenderer, write, read, 0, false), /test render failure/)
  assert.equal(camera.layers.mask, 1, 'camera layers restore even when rendering fails')
  layerPass.dispose()
  bloom.dispose(); read.dispose(); write.dispose()
  console.log('Passed map performance checks: debug disposal, stable ghost buffers, invisible batches and bloom cache/resize invalidation.')
}
