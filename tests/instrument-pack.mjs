import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { verifyExperienceMode } from './experience-mode.mjs'
import { verifyModelAttribution } from './model-attribution.mjs'
import { verifyTechnique } from './technique.mjs'
import { verifyInstrumentPerformance } from './instrument-performance.mjs'

for (const baseUrl of ['', '/3d/instrument-pack-staging/', 'https://pub-1e69fc096336415dadb5875dd346a3ba.r2.dev/orchestra-atlas/3d/']) {
  const server = await createServer({
    configFile: false,
    mode: 'test',
    define: { 'import.meta.env.VITE_INSTRUMENT_PACK_URL': JSON.stringify(baseUrl) },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  try {
    await verifyTechnique(server)
    await verifyInstrumentPerformance(server)
    if (!baseUrl) {
      await verifyExperienceMode(server)
      await verifyModelAttribution(server)
      continue
    }
    const { instrumentExperience } = await server.ssrLoadModule('/src/features/instrument-explorer/content/explorable-instruments.ts')
    const { configuredHotspots, hotspotConfigPath } = await server.ssrLoadModule('/src/features/instrument-explorer/content/hotspots.ts')
    const { instrumentCatalog } = await server.ssrLoadModule('/src/store/catalog.ts')
    const models = {
      clarinet: 'clarinet', horn: 'horn', oboe: 'oboe',
      doubleBass: 'double-bass', timpani: 'timpani', trombone: 'trombone',
      trumpet: 'trumpet', tuba: 'tuba', bassoon: 'bassoon', cello: 'cello',
    }
    const experienceOf = id => {
      const entry = instrumentCatalog.find(item => item.instrument === id)
      assert.ok(entry, `${id} has a catalogue entry`)
      return instrumentExperience({ level: 'instrument', familyId: entry.familyId, instrumentId: id })
    }
    for (const [id, name] of Object.entries(models)) {
      const experience = experienceOf(id)
      assert.equal(experience.modelUrl, `${baseUrl.replace(/\/+$/, '')}/${name}/${name}.glb`)
      assert.deepEqual(experience.modelRotation, [0, 0, 0], `${id} retains its authored pose`)
      assert.equal(experience.initialCamera, undefined, `${id} does not inherit another model's camera`)
      assert.equal(experience.modelAttribution, undefined, `${id} does not inherit another model's credits`)
      assert.deepEqual(configuredHotspots(id), [], `${id} does not inherit incompatible coordinates`)
      assert.ok(hotspotConfigPath(id).endsWith(`/hotspots/instrument-pack/${id}.json`))
    }
    assert.match(experienceOf('violin').modelUrl, /\/3d\/violin\/violin-web-anchors.glb$/)
    assert.deepEqual(experienceOf('violin').modelRotation, [Math.PI / 2, 0, 0])
    const flute = experienceOf('flute')
    assert.match(flute.modelUrl, /\/3d\/flute\/flute.glb$/)
    assert.ok(!flute.modelUrl.includes('instrument-pack-staging'))
    assert.deepEqual(flute.modelRotation, [0, Math.PI / 2, 0])
    assert.equal(flute.modelAttribution.creator, 'Tealfox64')
    assert.equal(flute.modelAttribution.title, 'Basic Flute')
    assert.ok(hotspotConfigPath('flute').endsWith('/hotspots/flute.json'))
    assert.equal(experienceOf('unpitchedPercussion').modelUrl, undefined, 'snare does not replace the whole percussion category')

    // Existing editor drafts must not attach to a replacement model either.
    const previousStorage = globalThis.localStorage
    const values = new Map([['orchestra-atlas:hotspot-draft:horn', JSON.stringify({ hotspots: [
      { id: 'old-bell', title: 'Old bell', description: '', position: [9, 9, 9] },
    ] })]])
    globalThis.localStorage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key),
    }
    try {
      const { useHotspotStore } = await server.ssrLoadModule('/src/store/hotspot-store.ts')
      useHotspotStore.getState().load('horn', { persistDraft: true })
      assert.deepEqual(useHotspotStore.getState().hotspots, [])
      const hotspot = useHotspotStore.getState().add([0, 1, 0])
      useHotspotStore.getState().load('horn', { persistDraft: true })
      assert.equal(useHotspotStore.getState().hotspots[0].id, hotspot.id)
      assert.ok(values.get('orchestra-atlas:hotspot-draft:horn').includes('old-bell'))
    } finally {
      if (previousStorage === undefined) delete globalThis.localStorage
      else globalThis.localStorage = previousStorage
    }
    console.log('Passed instrument-pack mappings, poses, credits, fallback, and hotspot isolation.')
  } finally {
    await server.close()
  }
}
