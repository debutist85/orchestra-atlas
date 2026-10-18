import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

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
  assert.equal(byId.horn?.creator, 'Bethanycrandallart')
  assert.equal(byId.horn?.license, 'CC BY 4.0')
  assert.equal(byId.trumpet?.creator, 'Kagelok')
  assert.equal(byId.flute?.creator, 'Tealfox64')
  assert.equal(byId.trombone?.creator, 'sethgordon')
  assert.notEqual(byId.horn, byId.trumpet, 'credits follow the instrument')
  assert.equal(byId.violin, undefined, 'no credits (and no button) without verified provenance')

  const licensesByInstrument = Object.fromEntries(await Promise.all(['violin', 'horn', 'trumpet', 'flute', 'trombone'].map(async instrumentId => {
    const license = JSON.parse(await readFile(new URL(`../public/licenses/${instrumentId}.json`, import.meta.url), 'utf8'))
    assert.equal(license.schemaVersion, 1)
    assert.equal(license.instrumentId, instrumentId)
    return [instrumentId, license]
  })))
  for (const instrumentId of ['violin', 'horn', 'trumpet', 'flute', 'trombone']) {
    const experience = experienceOf(instrumentCatalog.find(instrument => instrument.instrument === instrumentId))
    assert.ok(licensesByInstrument[instrumentId], `${instrumentId} has a public license record`)
    assert.ok(experience.modelUrl.endsWith(`/${licensesByInstrument[instrumentId].assetPath}`), `${instrumentId} license record matches its model`)
  }
  for (const instrumentId of ['horn', 'trumpet', 'flute', 'trombone']) {
    const attribution = byId[instrumentId]
    const license = licensesByInstrument[instrumentId]
    for (const field of required) assert.equal(license[field], attribution[field], `${instrumentId} public ${field} matches its displayed credit`)
    assert.equal(license.verificationStatus, attribution.verificationStatus)
    assert.equal(license.attributionRequired, true)
  }
  assert.equal(licensesByInstrument.violin.license, null, 'unknown violin rights are explicit')
  assert.equal(licensesByInstrument.violin.verificationStatus, 'requires-review')

  console.log('Passed model attribution: required fields, https links, review status, per-instrument credits, and absence without metadata.')
}
