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
  assert.equal(byId.flute?.creator, 'AmstadDigital', 'the replacement flute uses the pack credits')
  assert.equal(byId.flute?.license, 'Royalty Free License (no AI)')
  assert.equal(byId.horn?.creator, 'AmstadDigital')
  assert.equal(byId.horn?.license, 'Royalty Free License (no AI)')
  assert.notEqual(byId.horn, byId.trumpet, 'credits follow the instrument')
  assert.equal(byId.violin?.creator, 'Virtual Museums of Małopolska', 'the shared scan credits follow its embedded source metadata')
  assert.equal(byId.viola?.creator, byId.violin?.creator, 'the temporary viola visual uses the same source credits')

  // One record per model: its asset path is the model URL, and (when its
  // rights are known) it is the displayed credit itself.
  const licenses = new URL('../public/licenses/', import.meta.url)
  const records = await Promise.all((await readdir(licenses, { recursive: true }))
    .filter(file => file.endsWith('.json'))
    .map(async file => JSON.parse(await readFile(new URL(file, licenses), 'utf8'))))
  const modelled = instrumentCatalog.map(experienceOf).filter(experience => experience?.modelUrl)
  assert.equal(modelled.length, 17)
  for (const { instrumentId, modelUrl, modelAttribution } of modelled) {
    const matches = records.filter(record => record.instrumentId === instrumentId && modelUrl.endsWith(`/${record.assetPath}`) && (!modelAttribution || JSON.stringify(record) === JSON.stringify(modelAttribution)))
    assert.equal(matches.length, 1, `${instrumentId} has exactly one license record for its model`)
    const [record] = matches
    assert.equal(record.schemaVersion, 1)
    if (record.license === null) assert.equal(modelAttribution, undefined, `${instrumentId} has unknown rights and no credits`)
    else assert.deepEqual(modelAttribution, record, `${instrumentId} displays its own public record`)
  }
  assert.equal(new Set(modelled.map(model => model.modelUrl)).size, 16, 'only Violin and Viola share their temporary model')

  console.log('Passed model attribution: required fields, https links, review status, per-instrument credits from each model record, and absence without metadata.')
}
