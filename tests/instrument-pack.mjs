import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'
import { verifyExperienceMode } from './experience-mode.mjs'
import { verifyModelAttribution } from './model-attribution.mjs'
import { verifyTechnique } from './technique.mjs'
import { verifyInstrumentPerformance } from './instrument-performance.mjs'

for (const baseUrl of [undefined, '', '/3d/instrument-pack-staging/', 'https://pub-1e69fc096336415dadb5875dd346a3ba.r2.dev/orchestra-atlas/3d/']) {
  const server = await createServer({
    configFile: false,
    mode: 'test',
    define: { 'import.meta.env.VITE_INSTRUMENT_PACK_URL': baseUrl === undefined ? 'undefined' : JSON.stringify(baseUrl) },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  try {
    await verifyTechnique(server)
    await verifyInstrumentPerformance(server)
    if (baseUrl === '') {
      await verifyExperienceMode(server)
      await verifyModelAttribution(server)
      continue
    }
    const { instrumentExperience } = await server.ssrLoadModule('/src/features/instrument-explorer/content/explorable-instruments.ts')
    const { mediaUrl } = await server.ssrLoadModule('/src/lib/media-url.ts')
    const effectiveBase = (baseUrl ?? mediaUrl('3d')).replace(/\/+$/, '')
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
      assert.equal(experience.modelUrl, `${effectiveBase}/${name}/${name}.glb`)
      assert.deepEqual(experience.modelRotation, id === 'horn' ? [Math.PI, 0, 0] : [0, 0, 0], `${id} uses its pack-specific pose`)
      assert.deepEqual(experience.initialCamera, id === 'trumpet'
        ? { target: [0, 0, 0], position: [3.8354, -1.1959, 2.6253] }
        : id === 'trombone'
          ? { target: [0, 0, 0], position: [4.5950, 3.5221, 1.9918] }
          : id === 'horn'
            ? { target: [0, 0, 0], position: [3.4504, 1.3227, 0.5287] }
            : id === 'tuba'
              ? { target: [0, 0, 0], position: [4.4713, 2.9708, 2.3578] }
              : id === 'bassoon'
                ? { target: [0, 0, 0], position: [3.3919, 1.2637, -3.4655] }
                : id === 'clarinet'
                  ? { target: [0, 0, 0], position: [3.6401, 2.6530, -2.1600] }
                  : id === 'oboe'
                    ? { target: [0, 0, 0], position: [5.3870, 1.8539, -2.4230] }
                    : undefined, `${id} uses only its pack-specific opening camera`)
      const record = JSON.parse(await readFile(new URL(`../public/licenses/instrument-pack/${name}.json`, import.meta.url), 'utf8'))
      assert.deepEqual(experience.modelAttribution, record, `${id} displays its own public attribution record`)
      assert.equal(record.creator, 'AmstadDigital')
      assert.equal(record.license, 'Royalty Free License (no AI)')
      assert.equal(record.verificationStatus, 'requires-review')
      for (const field of ['creatorUrl', 'sourceUrl', 'licenseUrl']) assert.equal(new URL(record[field]).protocol, 'https:')
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
