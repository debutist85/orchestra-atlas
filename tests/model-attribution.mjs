import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'

export async function verifyModelAttribution(server) {
  const { instrumentExperience } = await server.ssrLoadModule('/src/features/instrument-explorer/content/explorable-instruments.ts')
  const { instrumentCatalog } = await server.ssrLoadModule('/src/store/catalog.ts')
  const experienceOf = instrument => instrumentExperience({ level: 'instrument', familyId: instrument.familyId, instrumentId: instrument.instrument })

  const required = ['title', 'creator', 'creatorUrl', 'sourceUrl', 'license', 'licenseUrl', 'modifications']
  const credited = instrumentCatalog.map(experienceOf).filter(experience => experience?.modelAttribution)
  for (const { instrumentId, modelUrl, modelAttribution } of credited) {
    assert.ok(modelUrl, `${instrumentId} has credits only alongside a model`)
    for (const field of required) assert.ok(typeof modelAttribution[field] === 'string' && modelAttribution[field].trim(), `${instrumentId} attribution has ${field}`)
    // Every link opens off-site, so only plain https links are accepted.
    for (const field of ['creatorUrl', 'sourceUrl', 'licenseUrl']) assert.equal(new URL(modelAttribution[field]).protocol, 'https:', `${instrumentId} ${field} is https`)
    // An agent never marks rights as approved (docs/architecture.md).
    assert.ok(['discovered', 'researched', 'requires-review', 'approved', 'rejected'].includes(modelAttribution.verificationStatus))
  }

  const byId = Object.fromEntries(credited.map(experience => [experience.instrumentId, experience.modelAttribution]))
  assert.equal(byId.flute?.creator, 'Tealfox64', 'the flute keeps its Basic Flute credits')
  assert.equal(byId.flute?.license, 'CC BY 4.0')
  assert.equal(byId.horn?.creator, 'AmstadDigital')
  assert.equal(byId.horn?.license, 'Royalty Free License (no AI)')
  assert.notEqual(byId.horn, byId.trumpet, 'credits follow the instrument')
  assert.equal(byId.violin, undefined, 'no credits (and no button) without verified provenance')

  // One record per model: its asset path is the model URL, and (when its
  // rights are known) it is the displayed credit itself.
  const licenses = new URL('../public/licenses/', import.meta.url)
  const records = await Promise.all((await readdir(licenses, { recursive: true }))
    .filter(file => file.endsWith('.json'))
    .map(async file => JSON.parse(await readFile(new URL(file, licenses), 'utf8'))))
  const modelled = instrumentCatalog.map(experienceOf).filter(experience => experience?.modelUrl)
  assert.ok(modelled.length >= 12)
  for (const { instrumentId, modelUrl, modelAttribution } of modelled) {
    const matches = records.filter(record => record.instrumentId === instrumentId && modelUrl.endsWith(`/${record.assetPath}`))
    assert.equal(matches.length, 1, `${instrumentId} has exactly one license record for its model`)
    const [record] = matches
    assert.equal(record.schemaVersion, 1)
    if (record.license === null) assert.equal(modelAttribution, undefined, `${instrumentId} has unknown rights and no credits`)
    else assert.deepEqual(modelAttribution, record, `${instrumentId} displays its own public record`)
  }
  for (const record of records) {
    assert.ok(!record.assetPath.startsWith('3d/') || records.filter(other => other.assetPath === record.assetPath).length === 1, `${record.assetPath} has one license record`)
  }

  console.log('Passed model attribution: required fields, https links, review status, per-instrument credits from each model record, and absence without metadata.')
}
