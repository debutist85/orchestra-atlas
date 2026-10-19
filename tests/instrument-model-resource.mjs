import assert from 'node:assert/strict'

export async function verifyInstrumentModelResource(server) {
  const { instantiateInstrumentModel } = await server.ssrLoadModule('/src/features/instrument-explorer/scene/instrument-model-resource.ts')
  const { clearModelCache } = await server.ssrLoadModule('/src/lib/model-inspector/model-resource.ts')
  const previousWindow = globalThis.window
  const previousFetch = globalThis.fetch
  globalThis.window = { location: { href: 'http://localhost/' } }
  let requests = 0
  let fail = false
  globalThis.fetch = async () => {
    requests++
    if (fail) return new Response('', { status: 503 })
    return new Response(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'Instrument' }] }))
  }
  try {
    const [first, second] = await Promise.all([instantiateInstrumentModel('/test-model.gltf'), instantiateInstrumentModel('/test-model.gltf')])
    assert.equal(requests, 1, 'concurrent preparations share one resource')
    assert.notEqual(first, second, 'each viewer owns its own scene graph')
    clearModelCache('/test-model.gltf')
    const reloaded = await instantiateInstrumentModel('/test-model.gltf')
    assert.equal(requests, 2, 'explicit eviction causes a new fetch')
    assert.equal(first.children[0].name, 'Instrument', 'eviction preserves existing instances')
    assert.notEqual(first, reloaded)
    fail = true
    await assert.rejects(instantiateInstrumentModel('/retry-model.gltf'))
    fail = false
    const recovered = await instantiateInstrumentModel('/retry-model.gltf')
    assert.equal(recovered.children[0].name, 'Instrument')
    assert.equal(requests, 4, 'failed resources are evicted so Retry fetches again')
    console.log('Passed model resource deduplication and retry after failure.')
  } finally {
    clearModelCache()
    globalThis.fetch = previousFetch
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
}
