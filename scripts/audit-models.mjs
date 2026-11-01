import { readdir, readFile, mkdir, writeFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { analyzeModel, publicUri } from './lib/gltf-inventory.mjs'

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const relative = file => path.relative(project, file).split(path.sep).join('/')
const modelFormats = new Set(['.glb', '.gltf', '.fbx', '.obj', '.blend', '.dae', '.stl', '.ply', '.usdz', '.usd'])
const ordered = (a, b) => a < b ? -1 : a > b ? 1 : 0
async function filesIn(directory) {
  const files = []
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => ordered(a.name, b.name))) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesIn(file))
    else if (entry.isFile()) files.push(file)
  }
  return files
}

async function catalogue() {
  // Use the application's actual content/ID mapping; no second instrument list.
  // Vite is already a dev dependency and resolves its TS imports/glob records.
  const { createServer } = await import('vite')
  const server = await createServer({ root: project, configFile: false, mode: 'test', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    const { instrumentCatalog } = await server.ssrLoadModule('/src/store/catalog.ts')
    const { modelAssetPath } = await server.ssrLoadModule('/src/features/instrument-explorer/content/explorable-instruments.ts')
    return instrumentCatalog.map(instrument => ({ id: instrument.instrument, name: instrument.name, assetPath: modelAssetPath(instrument.instrument) ?? null }))
  } finally { await server.close() }
}

export async function discoverModels(root) {
  const warnings = [], files = (await filesIn(root)).filter(file => modelFormats.has(path.extname(file).toLowerCase()))
  let manifest = { instruments: [] }
  try { manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')) }
  catch { warnings.push('No readable staging manifest; recursive discovery still includes all model files.') }
  let instruments = []
  try { instruments = await catalogue() } catch { warnings.push('Application catalogue could not be loaded; canonical names/active model matching may be unknown.') }
  const records = []
  for (const file of (await filesIn(path.join(project, 'public/licenses'))).filter(file => file.endsWith('.json'))) {
    try { const record = JSON.parse(await readFile(file, 'utf8')); if (record.assetPath) records.push({ file, record }) }
    catch { warnings.push('Unreadable license record: ' + relative(file)) }
  }
  const manifestFiles = new Map()
  for (const entry of manifest.instruments ?? []) {
    if (typeof entry.instrument !== 'string' || typeof entry.file !== 'string') { warnings.push('Invalid staging manifest entry omitted.'); continue }
    const file = path.resolve(root, entry.instrument, path.basename(entry.file)), rel = path.relative(root, file)
    if (rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) { warnings.push('Out-of-scope staging manifest entry omitted.'); continue }
    manifestFiles.set(file, entry)
  }
  const sources = [...new Set([...files, ...manifestFiles.keys()])].sort(ordered).map(file => {
    const group = path.relative(root, file).split(path.sep)[0], entry = manifestFiles.get(file)
    const exactRecords = records.filter(({ record }) => [record.localAssetPath, record.assetPath].filter(Boolean).some(asset => path.resolve(project, 'public', asset) === file))
    const groupRecord = records.find(({ record }) => record.localAssetPath && path.dirname(path.resolve(project, 'public', record.localAssetPath)) === path.dirname(file))
      ?? records.find(({ record }) => path.dirname(path.resolve(project, 'public', record.assetPath)) === path.dirname(file))
    const id = exactRecords[0]?.record.instrumentId ?? groupRecord?.record.instrumentId ?? instruments.find(instrument => instrument.id === group)?.id ?? null
    const instrument = instruments.find(instrument => instrument.id === id)
    return {
      localPath: relative(file), group, instrumentId: id, instrumentName: instrument?.name ?? entry?.instrument ?? group,
      identitySource: exactRecords.length ? 'asset license record/catalogue' : groupRecord ? 'directory relationship; variant provenance unknown' : instrument ? 'catalogue ID matches directory; variant provenance unknown' : 'directory label only; canonical ID unknown',
      selectedApplicationAsset: instrument?.assetPath ?? null,
      sourceUrls: exactRecords.map(({ record }) => publicUri(record.assetUrl)).filter(Boolean).sort(),
      licenseRecords: exactRecords.map(({ file }) => relative(file)).sort(),
      recordedAssetPaths: exactRecords.map(({ record }) => record.assetPath).sort(),
      expectedSha256: exactRecords.find(({ record }) => record.assetSha256)?.record.assetSha256 ?? null,
      manifest: entry ? { instrument: entry.instrument, exportTriangles: entry.export_triangles ?? null, bytes: entry.bytes ?? null, geometryRatio: entry.geometry_ratio ?? null } : null,
      file,
    }
  })
  return { sources, warnings, instruments }
}

function redact(value, key = '') {
  if (/^(password|token|secret|authorization|credentials?|signature|access.?key)$/i.test(key)) return '[redacted]'
  if (typeof value === 'string') return value.replace(/(?:https?:\/\/|data:)[^\s"<>]+/g, uri => publicUri(uri))
  if (Array.isArray(value)) return value.map(entry => redact(entry))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, entry]) => [name, redact(entry, name)]))
  return value
}

const cells = value => value === null || value === undefined ? '' : String(value)
const csvCell = value => '"' + cells(value).replaceAll('"', '""') + '"'
const mb = bytes => bytes === null || bytes === undefined ? 'unknown' : (bytes / 1048576).toFixed(2)
const number = value => value === null || value === undefined ? 'unknown' : value.toLocaleString('en-US')
const label = model => model.localPath.replaceAll('|', '\\|')
const rank = (models, value) => models.filter(model => value(model) !== null && value(model) !== undefined).toSorted((a, b) => value(b) - value(a) || ordered(a.localPath, b.localPath)).slice(0, 5)

export function renderReports(report) {
  const columns = {
    instrument_id: model => model.instrumentId, instrument_name: model => model.instrumentName, model: model => model.localPath,
    status: model => model.status, format: model => model.format, file_bytes: model => model.fileBytes, external_bytes: model => model.externalBytes, total_transfer_bytes: model => model.totalTransferBytes,
    scenes: model => model.geometry?.sceneCount, nodes: model => model.geometry?.nodeCount, meshes: model => model.geometry?.meshCount, primitives: model => model.geometry?.primitiveCount, materials: model => model.geometry?.materialCount,
    unique_triangles: model => model.geometry?.uniqueTriangles, mesh_definition_triangles: model => model.geometry?.meshDefinitionTriangles, default_scene_triangles: model => model.geometry?.defaultSceneTriangles,
    unique_stored_position_vertices: model => model.geometry?.uniqueStoredPositionVertices, indexed_primitives: model => model.geometry?.indexedPrimitiveCount, nonindexed_primitives: model => model.geometry?.nonIndexedPrimitiveCount,
    primitive_draws_estimate: model => model.geometry?.defaultScenePrimitiveDrawsEstimate, images: model => model.textureSummary?.imageCount, textures: model => model.textureSummary?.textureCount,
    decoded_rgba_bytes_estimate: model => model.textureSummary?.decodedRgbaBytesEstimate, gpu_rgba_bytes_estimate: model => model.textureSummary?.gpuRgbaBytesEstimate,
    animations: model => model.geometry?.animationCount, skins: model => model.geometry?.skinCount, morph_primitives: model => model.geometry?.morphPrimitiveCount,
    alpha_blend_materials: model => model.materialsSummary?.alphaBlend, double_sided_materials: model => model.materialsSummary?.doubleSided,
    geometry_compression: model => model.compression?.geometry.join(';'), gpu_texture_extensions: model => model.compression?.gpuTextureExtensions.join(';'),
    sha256: model => model.sha256, active_asset_match: model => model.matchesSelectedApplicationAsset, warnings: model => model.warnings?.join('; '), error: model => model.error,
  }
  const csv = [Object.keys(columns).map(csvCell).join(','), ...report.models.map(model => Object.values(columns).map(get => csvCell(get(model))).join(','))].join('\n') + '\n'
  const good = report.models.filter(model => model.geometry), failed = report.models.filter(model => !model.geometry)
  const lines = ['# Instrument model inventory', '', 'Read-only baseline of `' + report.scope + '`. Rerun with `npm run audit:models`. No source assets, textures, R2 objects, or rendering settings are changed.', '',
    `Analyzed **${good.length}** models; **${failed.length}** failed/unsupported; **${good.filter(model => model.status === 'partial').length}** partial. All numeric sizes are bytes or explicitly labeled MiB (1,048,576 bytes). Unknown values are empty in CSV and null in JSON.`, '',
    '## Discovery and source mapping', '',
    'Recursive discovery is combined with the staging manifest, application catalogue and public license records. Every variant receives its own row. A directory relationship identifies an instrument but does not establish provenance, rights, active selection, or level of detail for alternate files. Staging/hosted paths are different; an active asset match requires a matching recorded SHA-256 or the exact configured local path. Remote bodies and current R2 headers were not inspected.', '',
    ...report.warnings.map(warning => '- ' + warning), '',
    '## Summary', '', '| Model | Status | Transfer MiB | Unique triangles | Default-scene triangles | Stored vertices | Primitives / materials | Images | RGBA image MiB (estimate) |', '|---|---|---:|---:|---:|---:|---:|---:|---:|',
    ...report.models.map(model => `| ${label(model)} | ${model.status} | ${mb(model.totalTransferBytes)} | ${number(model.geometry?.uniqueTriangles)} | ${number(model.geometry?.defaultSceneTriangles)} | ${number(model.geometry?.uniqueStoredPositionVertices)} | ${model.geometry ? model.geometry.primitiveCount + ' / ' + model.geometry.materialCount : 'unknown'} | ${number(model.textureSummary?.imageCount)} | ${mb(model.textureSummary?.decodedRgbaBytesEstimate)} |`), '',
    '## Models that could not be fully analyzed', '',
    ...report.models.filter(model => model.status !== 'ok').map(model => '- `' + label(model) + '`: ' + (model.error ?? model.warnings.join('; '))),
  ]
  if (report.models.every(model => model.status === 'ok')) lines.push('None. All discovered assets had readable glTF 2.0 metadata and image dimensions. This is not full glTF conformance or visual validation.')
  for (const [heading, get, unit] of [
    ['Largest transfers', model => model.totalTransferBytes, 'bytes'],
    ['Largest unique geometry counts', model => model.geometry?.uniqueTriangles, 'triangles'],
    ['Largest estimated decoded image footprints', model => model.textureSummary?.decodedRgbaBytesEstimate, 'bytes (RGBA equivalent)'],
    ['Most primitive definitions', model => model.geometry?.primitiveCount, 'primitives'],
    ['Most material definitions', model => model.geometry?.materialCount, 'materials'],
  ]) lines.push('', '## ' + heading, '', ...rank(good, get).map(model => '- `' + label(model) + '`: ' + number(get(model)) + ' ' + unit + '.'))
  lines.push('', '## Compression and rendering implications', '',
    ...good.map(model => '- `' + label(model) + '`: geometry ' + (model.compression.geometry.join(', ') || 'no Draco/Meshopt declared') + '; quantization ' + model.compression.quantization + '; GPU texture extensions ' + (model.compression.gpuTextureExtensions.join(', ') || 'none declared') + '; texture containers ' + model.compression.textureContainers + '; ' + model.materialsSummary.alphaBlend + ' blend, ' + model.materialsSummary.doubleSided + ' double-sided, ' + model.materialsSummary.extendedPbr + ' extended PBR materials. Default-scene primitive draws: **' + number(model.geometry.defaultScenePrimitiveDrawsEstimate) + ' estimated**, not runtime measured.'), '',
    '## Evidence-based optimization candidates', '',
    'The rankings are comparisons within this collection, not pass/fail thresholds. High counts can be justified by close-up quality, anatomy and material separation.', '',
    ...good.filter(model => model.textureSummary.duplicateImageGroups.length).map(model => '- `' + label(model) + '`: ' + model.textureSummary.duplicateImageGroups.reduce((sum, group) => sum + group.length - 1, 0) + ' repeated image records with byte-identical payloads. Compare sampler/color-space/material requirements before consolidating. JSON lists exact image groups.'),
    ...good.filter(model => model.geometry.meshDefinitionTriangles !== model.geometry.uniqueTriangles || model.geometry.defaultSceneTriangles !== model.geometry.meshDefinitionTriangles).map(model => '- `' + label(model) + '`: geometry definitions/storage and scene cost differ. Inspect instances and shared resources before estimating polygon savings.'),
    ...good.filter(model => model.geometry.lodNodes.length || model.geometry.materialVariants).map(model => '- `' + label(model) + '`: declared LOD/material variants exist; inspect their intended selection rather than treating all resources as simultaneously rendered.'), '',
    'Prioritize the largest texture footprints and transfer payloads for material/texture review; then examine the leading geometry and primitive counts on real devices. Alpha blending, double-sided rendering, clearcoat/transmission and many material passes are profiling candidates, not proof of excessive runtime cost.', '',
    '## Proposed optimization sequence', '',
    '1. Review alternate variants visually and establish which assets are intended for the application; verify provenance separately for unmatched files.',
    '2. For the leading texture footprints, inspect duplicate payloads, channels, map packing, resolutions and GPU texture formats. Produce candidates separately, preserving color space, normal maps and material response.',
    '3. For geometry leaders, inspect silhouettes/anatomy, actual scene instances, redundant geometry and authored LODs before considering decimation or Meshopt/Draco.',
    '4. Profile material/primitive leaders for draw cost, transparency overdraw and shader cost before consolidating parts required by anatomy.',
    '5. Validate one candidate at a time on desktop/mobile: transfer, decoding, GPU upload, retained/native/GPU memory, frame time, visual quality and interaction. Only then consider replacing production assets.', '',
    '## Method and limitations', '', ...report.method.map(note => '- ' + note), '',
    '## Validation', '', ...report.validation.map(note => '- ' + note), '')
  return { csv, markdown: lines.join('\n') }
}

export async function auditModels(root, { verifyThree = false } = {}) {
  const { sources, warnings } = await discoverModels(root), models = [], validation = []
  for (const { file, expectedSha256, ...source } of sources) {
    try {
      if (!['.glb', '.gltf'].includes(path.extname(file).toLowerCase())) throw Error('Unsupported model format: ' + path.extname(file))
      const analyzed = await analyzeModel(file, { root })
      const hashMatchesRecord = expectedSha256 ? analyzed.sha256 === expectedSha256 : null
      const matchesSelectedApplicationAsset = source.selectedApplicationAsset ? hashMatchesRecord === true && source.recordedAssetPaths.includes(source.selectedApplicationAsset)
        || path.resolve(project, 'public', source.selectedApplicationAsset) === file : null
      const model = { ...source, ...analyzed, hashMatchesRecord, matchesSelectedApplicationAsset }
      if (expectedSha256 && !hashMatchesRecord) { model.warnings.push('Asset differs from its license record SHA-256; do not infer hosted/active equivalence.'); model.status = 'partial' }
      models.push(model)
      if (source.manifest) {
        const matches = model.geometry.meshDefinitionTriangles === source.manifest.exportTriangles && model.fileBytes === source.manifest.bytes
        validation.push(source.localPath + ': manifest triangle/byte comparison ' + (matches ? 'matches' : 'DIFFERS; inspect JSON geometry/instance counts and manifest freshness') + '.')
      }
    } catch (error) { models.push({ ...source, status: 'failed', error: String(error.message).replaceAll(project + path.sep, ''), warnings: [], format: path.extname(file).slice(1), fileBytes: await stat(file).then(info => info.size).catch(() => null), externalBytes: null, totalTransferBytes: null }) }
  }
  if (verifyThree) {
    const { verifyWithThree } = await import('./lib/gltf-verify.mjs')
    const candidates = models.filter(model => model.status === 'ok' && model.format === 'glb' && !model.externalDependencies.length && !model.compression.geometry.length && !model.compression.textureContainers)
    const samples = [...new Set([rank(candidates, model => model.fileBytes)[0], rank(candidates, model => model.geometry.defaultSceneTriangles)[0], rank(candidates, model => model.textureSummary.decodedRgbaBytesEstimate)[0]])].filter(Boolean)
    for (const model of samples) {
      try {
        const checked = await verifyWithThree(path.resolve(project, model.localPath))
        model.independentThreeCheck = { scenes: checked, triangleCountsMatch: checked.length === model.geometry.scenes.length && checked.every((scene, index) => scene.triangles === model.geometry.scenes[index].triangles) }
        validation.push(model.localPath + ': independent Three.js GLTFLoader scene triangle comparison ' + (model.independentThreeCheck.triangleCountsMatch ? 'matches' : 'DIFFERS; inspect topology/instance semantics') + '; image-header shim only, no browser/GPU validation.')
      } catch { validation.push(model.localPath + ': independent Three.js parse failed; inventory metadata remains available.') }
    }
  }
  return redact({
    schemaVersion: 1, scope: relative(root), warnings, models,
    method: [
      'Container sizes, hashes, dependency/image encoded byte lengths and image dimensions are measured from local files/headers. Transfer bytes here mean the model plus unique external file payloads before HTTP encoding/overhead, not measured network traffic. No remote downloads occur. Remote or missing dependencies produce partial results and unknown total transfer size. Source URLs are catalogue metadata, not live delivery measurements.',
      'Stored vertex count sums unique POSITION accessor IDs once, not primitive/node occurrences. All attributes/accessors are listed per primitive. Distinct accessors aliasing overlapping bytes, renderer expansion, morph/skinned deformation and actual post-transform vertex work are not fully counted by this metric.',
      'Unique geometry is keyed by primitive attributes, indices, mode, morph targets and Draco mapping, excluding material. Scene triangles count node instances separately, with EXT_mesh_gpu_instancing multiplication. Strip/fan counts include possible degenerate triangles. Compressed geometry counts use declared accessor metadata, not decoded topology validation.',
      'Default-scene draws estimate one draw per primitive per mesh node (one per GPU-instanced primitive). Visibility, clipping, skinning/morph variants, LOD selection, extra material/shadow/transmission/postprocessing passes and renderer batching may change actual cost. Scene tables are alternatives, not simultaneous rendering totals.',
      'RGBA decoded-image estimates use width × height × 4 per unique source reference. Byte-identical payloads in distinct sources remain separate and are flagged as candidates, not silently counted as already shared. CPU image storage varies by browser/decoder; no native or GPU memory was measured.',
      'GPU RGBA estimates deduplicate source + effective sampler + material color-space usage across all declared materials, include exact 2D mip-chain dimensions for raster sources, and assume RGBA8. Textures unused by every material are excluded from upload estimates. Materials outside the default scene may still be included. Renderer clones, UV/sampler differences and driver storage may alter sharing. GPU-compressed container/transcoding residency is unknown rather than represented as RGBA8 VRAM.',
      'Texture extension sources and base fallbacks are listed separately. KTX2/DDS header mip counts and payload lengths do not establish device transcode format, total GPU residency or full container validity. Unsupported image metadata produces null dimensions/memory.',
      'glTF Transform was considered; this read-only metadata task uses Node parsing, the existing Sharp image reader, and the installed Vite content resolver instead of adding its I/O/extension dependencies. Decoder-backed compression validation and full glTF conformance remain follow-up work.',
      'Names/IDs come from catalogue/license/manifest relationships where available. Directory-only identities, variant provenance, and selection are explicitly qualified. Filenames such as (1)/(2) do not prove LODs. Existing rights metadata is not changed or approved.',
      'Reports omit wall-clock timestamps for deterministic reruns, never include data URI bodies or URL credentials/query strings, and are written outside the asset directory. Source images/models are never re-encoded or written.',
    ], validation,
  })
}

async function main() {
  const { values } = parseArgs({ options: { input: { type: 'string', default: 'public/3d/instrument-pack-staging' }, 'output-dir': { type: 'string', default: 'reports/assets' }, 'verify-three': { type: 'boolean', default: false } } })
  const canonicalDestination = async file => {
    try { return await realpath(file) }
    catch (error) { if (error.code !== 'ENOENT') throw error; return path.join(await canonicalDestination(path.dirname(file)), path.basename(file)) }
  }
  const root = await realpath(path.resolve(values.input)), output = await canonicalDestination(path.resolve(values['output-dir']))
  const rel = path.relative(root, output)
  if (rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel))) throw Error('Reports must be written outside the source asset directory')
  const report = await auditModels(root, { verifyThree: values['verify-three'] }), rendered = renderReports(report)
  await mkdir(output, { recursive: true })
  await writeFile(path.join(output, 'instrument-models.json'), JSON.stringify(report, null, 2) + '\n')
  await writeFile(path.join(output, 'instrument-models.csv'), rendered.csv)
  await writeFile(path.join(output, 'instrument-models.md'), rendered.markdown)
  console.log(JSON.stringify({ models: report.models.length, analyzed: report.models.filter(model => model.geometry).length, partial: report.models.filter(model => model.status === 'partial').length, failed: report.models.filter(model => model.status === 'failed').length, reports: relative(output) }, null, 2))
  if (report.models.some(model => model.status === 'failed')) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main()
