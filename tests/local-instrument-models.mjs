import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { verifyWithThree } from '../scripts/lib/gltf-verify.mjs'
import { sha256 } from '../scripts/lib/gltf-inventory.mjs'
import { verifyExperienceMode } from './experience-mode.mjs'
import { verifyModelAttribution } from './model-attribution.mjs'

// Explicit local-asset check: GLBs are ignored by Git and supplied separately.
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  await verifyExperienceMode(server)
  await verifyModelAttribution(server)
  const { instrumentCatalog } = await server.ssrLoadModule('/src/store/catalog.ts')
  const { instrumentExperience } = await server.ssrLoadModule('/src/features/instrument-explorer/content/explorable-instruments.ts')
  const { parseNavigationPath } = await server.ssrLoadModule('/src/features/orchestra-map/utils/navigation-path.ts')
  assert.equal(instrumentCatalog.length, 17)
  assert.ok(!instrumentCatalog.some(row => row.instrument === 'celesta'))
  assert.equal(instrumentCatalog.find(row => row.instrument === 'piano').name, 'Piano')
  assert.equal(parseNavigationPath('/other/piano').navigation.instrumentId, 'piano')
  const special = { viola: 'violin', doubleBass: 'double-bass', pitchedPercussion: 'marimba', unpitchedPercussion: 'snare-drum' }
  for (const row of instrumentCatalog) {
    const folder = special[row.instrument] ?? row.instrument
    const model = instrumentExperience({ level: 'instrument', familyId: row.familyId, instrumentId: row.instrument })
    assert.equal(model.modelUrl, `/3d/${folder}/${folder}.glb`, 'development bypasses the media CDN')
    const bytes = await readFile(`public${model.modelUrl}`)
    const staged = await readFile(`public/3d/instrument-pack-staging/${folder}/${folder}.glb`)
    assert.equal(sha256(bytes), sha256(staged), `${folder}: runtime and optimized staging match`)
    if (row.instrument === 'viola') {
      const violaCopy = await readFile('public/3d/instrument-pack-staging/viola/viola.glb')
      assert.equal(sha256(bytes), sha256(violaCopy), 'the staged viola matches the shared scan')
      const runtimeCopy = await readFile('public/3d/viola/viola.glb')
      assert.equal(sha256(bytes), sha256(runtimeCopy), 'the spare runtime viola copy is also updated')
    }
    const record = JSON.parse(await readFile(`public/licenses/optimized/${folder}.json`, 'utf8'))
    assert.equal(record.assetSha256, sha256(bytes))
    const scenes = await verifyWithThree(`public${model.modelUrl}`)
    assert.equal(scenes.length, 1)
    assert.ok(scenes[0].triangles > 0)
    console.log(`${row.name}: ${model.modelUrl} — ${scenes[0].triangles.toLocaleString()} triangles`)
  }
  console.log('Passed all 17 local model slots, staging parity, credits, catalogue slots and piano navigation.')
} finally {
  await server.close()
}

// Preview builds must obey the explicit override; after upload it can be
// switched off without editing instrument mappings or affecting other media.
for (const local of [true, false]) {
  const preview = await createServer({
    configFile: false,
    define: {
      'import.meta.env.DEV': 'false',
      'import.meta.env.VITE_LOCAL_MODELS': JSON.stringify(String(local)),
      'import.meta.env.VITE_MEDIA_URL': JSON.stringify('https://example.invalid/media'),
    },
    server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
  })
  try {
    const { instrumentCatalog } = await preview.ssrLoadModule('/src/store/catalog.ts')
    const { instrumentExperience, modelAssetPath } = await preview.ssrLoadModule('/src/features/instrument-explorer/content/explorable-instruments.ts')
    for (const row of instrumentCatalog) {
      const experience = instrumentExperience({ level: 'instrument', familyId: row.familyId, instrumentId: row.instrument })
      const base = local ? '/' : 'https://example.invalid/media/'
      assert.equal(experience.modelUrl, base + modelAssetPath(row.instrument))
    }
  } finally { await preview.close() }
}
console.log('Passed explicit local/CDN selection for all model slots in production preview mode.')
