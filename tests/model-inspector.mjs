import assert from 'node:assert/strict'
import * as THREE from 'three'

export async function verifyModelInspector(server) {
  const { createModelSession } = await server.ssrLoadModule('/src/lib/model-inspector/model-session.ts')
  const frames = new Set()
  const errors = new Set()
  const stage = {
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), renderer: {},
    size: () => ({ width: 640, height: 480 }),
    beginPreparation() {}, finishPreparation() {},
    onError(listener) { errors.add(listener); return () => errors.delete(listener) },
    onRender(listener) { frames.add(listener); return () => frames.delete(listener) },
  }
  const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
  const requests = new Map()
  const session = createModelSession(stage, url => {
    const result = deferred(); requests.set(url, result); return result.promise
  }, async (_renderer, _model, _scene, _camera, cancelled) => !cancelled())
  const statuses = []
  session.onState(state => statuses.push(state.status))
  const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }
  const frame = () => { for (const listener of frames) listener() }

  const first = session.loadModel('first')
  const second = session.loadModel('second')
  const oldModel = new THREE.Group(), currentModel = new THREE.Group()
  requests.get('first').resolve(oldModel)
  requests.get('second').resolve(currentModel)
  await flush()
  assert.equal(await first, undefined, 'superseded loads never attach')
  assert.equal(oldModel.parent, null)
  assert.equal(session.getState().status, 'preparing', 'GPU preparation alone is not readiness')
  frame()
  assert.equal(await second, currentModel)
  assert.equal(session.getState().status, 'ready')

  const pendingFrame = session.loadModel('cancel-before-frame')
  requests.get('cancel-before-frame').resolve(new THREE.Group())
  await flush()
  session.cancelModel()
  assert.equal(await pendingFrame, undefined)
  frame()
  assert.equal(session.getState().status, 'idle')
  assert.equal(stage.scene.children.length, 0)
  assert.equal(frames.size, 0, 'cancellation removes readiness listeners')

  const failed = session.loadModel('failure')
  requests.get('failure').reject(new Error('failure'))
  await assert.rejects(failed)
  assert.equal(session.getState().status, 'error')
  const retry = session.loadModel('failure')
  requests.get('failure').resolve(new THREE.Group())
  await flush(); frame(); await retry
  assert.equal(session.getState().status, 'ready')

  const renderFailure = session.loadModel('render-error')
  requests.get('render-error').resolve(new THREE.Group())
  await flush()
  for (const listener of errors) listener(new Error('render failed'))
  await assert.rejects(renderFailure)
  assert.equal(session.getState().status, 'error')
  assert.equal(frames.size, 0)
  assert.equal(errors.size, 0)

  // Detaching a model releases its shared, cached resources from the
  // renderer exactly once each (gpu-resources.ts), so a disposed renderer is
  // not kept reachable through the cache's dispose listeners.
  const texture = new THREE.Texture()
  const geometry = new THREE.BoxGeometry()
  const material = new THREE.MeshStandardMaterial({ map: texture })
  const shared = new THREE.Group()
  shared.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, [material, material]))
  const released = { geometry: 0, material: 0, texture: 0 }
  geometry.addEventListener('dispose', () => released.geometry++)
  material.addEventListener('dispose', () => released.material++)
  texture.addEventListener('dispose', () => released.texture++)
  const sharedLoad = session.loadModel('shared')
  requests.get('shared').resolve(shared)
  await flush(); frame(); await sharedLoad
  assert.deepEqual(released, { geometry: 0, material: 0, texture: 0 }, 'nothing released while in use')
  session.cancelModel()
  assert.deepEqual(released, { geometry: 1, material: 1, texture: 1 }, 'each shared resource released once')
  assert.ok(geometry.attributes.position.count > 0, 'CPU data kept for the cache')

  const late = session.loadModel('dispose')
  session.dispose(); session.dispose()
  const lateModel = new THREE.Group()
  requests.get('dispose').resolve(lateModel)
  assert.equal(await late, undefined)
  assert.equal(lateModel.parent, null)
  assert.equal(await session.loadModel('after-dispose'), undefined)
  assert.ok(statuses.includes('error'))
  console.log('Passed inspector load replacement, first-frame readiness, cancellation, failure/retry, and disposal.')
}
