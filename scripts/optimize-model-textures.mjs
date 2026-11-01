import { readFile, writeFile, readdir, mkdir, copyFile, rename } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { parseContainer, sha256 } from './lib/gltf-inventory.mjs'
import { verifyWithThree } from './lib/gltf-verify.mjs'

const colorSlots = new Set(['baseColorTexture', 'emissiveTexture', 'diffuseTexture', 'specularGlossinessTexture', 'specularColorTexture', 'sheenColorTexture', 'diffuseTransmissionColorTexture'])
function textureUses(value, callback) {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (key.endsWith('Texture') && Number.isInteger(child?.index)) callback(key, child.index)
    else textureUses(child, callback)
  }
}
function pack(document, binary) {
  const json = Buffer.from(JSON.stringify(document))
  const jp = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(jp)
  const bp = Buffer.alloc(Math.ceil(binary.length / 4) * 4); binary.copy(bp)
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jp.length + bp.length, 8)
  const chunk = (data, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(data.length); h.writeUInt32LE(type, 4); return Buffer.concat([h, data]) }
  return Buffer.concat([header, chunk(jp, 0x4e4f534a), chunk(bp, 0x004e4942)])
}

// Deliberately narrow: embedded, uncompressed GLBs only. Geometry, hierarchy,
// material factors, UVs, samplers, names and provenance are not regenerated.
export async function optimizeTextures(bytes, { dataSize = 512, colorSize = 1024, imageSizeOverrides = {} } = {}) {
  assert.ok(Number.isInteger(dataSize) && dataSize > 0 && Number.isInteger(colorSize) && colorSize > 0)
  assert.ok(Object.values(imageSizeOverrides).every(size => Number.isInteger(size) && size > 0))
  const { document: source, binary } = parseContainer(bytes, 'glb')
  const doc = structuredClone(source)
  assert.equal(doc.buffers.length, 1)
  assert.ok(!doc.buffers[0].uri && binary)
  assert.ok(!(doc.extensionsUsed ?? []).some(e => /draco|meshopt|basisu|texture_webp|texture_avif|texture_dds/i.test(e)), 'Compressed input needs a dedicated pipeline')
  assert.ok((doc.images ?? []).every(i => Number.isInteger(i.bufferView) && !i.uri))
  assert.ok((doc.textures ?? []).every(t => Number.isInteger(t.source) && !t.extensions))
  const imageViews = new Set((doc.images ?? []).map(i => i.bufferView))
  const colorImages = new Set()
  textureUses(doc.materials, (slot, index) => { if (colorSlots.has(slot)) colorImages.add(doc.textures[index].source) })
  const viewData = index => {
    const v = source.bufferViews[index]
    assert.equal(v.buffer, 0)
    return binary.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength)
  }
  for (const a of doc.accessors ?? []) for (const index of [a.bufferView, a.sparse?.indices?.bufferView, a.sparse?.values?.bufferView]) {
    if (index !== undefined) assert.ok(!imageViews.has(index), 'Image and accessor share storage')
  }
  const parts = [], views = [], viewMap = new Map(); let offset = 0
  const append = (payload, metadata = {}) => {
    const padding = (4 - offset % 4) % 4
    if (padding) { parts.push(Buffer.alloc(padding)); offset += padding }
    const index = views.length
    views.push({ ...metadata, buffer: 0, byteOffset: offset, byteLength: payload.length })
    parts.push(payload); offset += payload.length
    return index
  }
  for (let i = 0; i < source.bufferViews.length; i++) if (!imageViews.has(i)) viewMap.set(i, append(viewData(i), source.bufferViews[i]))
  const remapViews = value => {
    if (!value || typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) {
      if (key === 'bufferView' && Number.isInteger(child)) {
        assert.ok(viewMap.has(child), 'Unsupported reference to image storage')
        value[key] = viewMap.get(child)
      } else if (key !== 'extras') remapViews(child)
    }
  }
  // Leave application-owned extras untouched.
  const { images: oldImages = [], bufferViews: _oldViews, ...rest } = doc
  remapViews(rest)
  Object.assign(doc, rest)
  const images = [], imageMap = new Map(), dedup = new Map(), changes = []
  for (const [index, original] of oldImages.entries()) {
    const encoded = viewData(original.bufferView)
    const { data: raw, info } = await sharp(encoded).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    assert.equal(info.channels, 4)
    let constant = true
    for (let p = 4; p < raw.length && constant; p++) if (raw[p] !== raw[p % 4]) constant = false
    // Preserve asset-specific detail such as lettering while reducing other maps.
    const cap = imageSizeOverrides[index] ?? (colorImages.has(index) ? colorSize : dataSize)
    let width = info.width, height = info.height, pixels = raw
    if (constant) { width = height = 1; pixels = raw.subarray(0, 4) }
    else if (Math.max(width, height) > cap) {
      const resized = await sharp(raw, { raw: info }).resize({ width: cap, height: cap, fit: 'inside', withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true })
      pixels = resized.data; width = resized.info.width; height = resized.info.height
    }
    const candidate = await sharp(pixels, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer()
    const unchanged = width === info.width && height === info.height
    const payload = unchanged && encoded.length < candidate.length ? encoded : candidate
    const mimeType = payload === encoded ? original.mimeType : 'image/png'
    const metadata = { ...original }; delete metadata.bufferView; delete metadata.mimeType; delete metadata.name
    const key = `${width}:${height}:${sha256(pixels)}:${JSON.stringify(metadata)}`
    let target = dedup.get(key)
    if (target === undefined) {
      target = images.length; dedup.set(key, target)
      images.push({ ...original, mimeType, bufferView: append(payload) })
    }
    imageMap.set(index, target)
    changes.push({ image: index, outputImage: target, before: [info.width, info.height], after: [width, height], constant, color: colorImages.has(index) })
  }
  for (const texture of doc.textures ?? []) texture.source = imageMap.get(texture.source)
  doc.images = images; doc.bufferViews = views; doc.buffers[0].byteLength = offset
  const output = pack(doc, Buffer.concat(parts))
  const check = parseContainer(output, 'glb')
  for (const [before, after] of viewMap) {
    const v = check.document.bufferViews[after]
    assert.ok(viewData(before).equals(check.binary.subarray(v.byteOffset, v.byteOffset + v.byteLength)), 'Non-image payload changed')
  }
  assert.deepEqual(doc.nodes, source.nodes)
  assert.deepEqual(doc.meshes, source.meshes)
  assert.deepEqual(doc.materials, source.materials)
  assert.deepEqual(doc.asset, source.asset)
  return { output, changes }
}

async function main() {
  const { values } = parseArgs({ options: { input: { type: 'string', default: 'public/3d/instrument-pack-staging' }, work: { type: 'string', default: 'asset-optimization.local' }, apply: { type: 'boolean', default: false } } })
  const root = path.resolve(values.input), work = path.resolve(values.work)
  assert.ok(!work.startsWith(path.resolve('public') + path.sep), 'Backups must be outside public')
  await mkdir(work, { recursive: false }) // Refuse accidental reruns over originals.
  const report = { settings: { colorSize: 1024, dataSize: 512, geometry: 'unchanged' }, models: [] }
  for (const entry of (await readdir(root, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue
    const directory = path.join(root, entry.name)
    const files = (await readdir(directory)).filter(f => f.endsWith('.glb'))
    assert.equal(files.length, 1, `${entry.name}: expected one GLB`)
    const file = path.join(directory, files[0]), original = await readFile(file)
    const backup = path.join(work, 'originals', entry.name, files[0]), candidate = path.join(work, 'optimized', entry.name, files[0])
    await mkdir(path.dirname(backup), { recursive: true }); await mkdir(path.dirname(candidate), { recursive: true })
    await writeFile(backup, original, { flag: 'wx' })
    const { output, changes } = await optimizeTextures(original)
    await writeFile(candidate, output, { flag: 'wx' })
    assert.deepEqual(await verifyWithThree(candidate), await verifyWithThree(backup))
    report.models.push({ instrument: entry.name, file: path.relative(process.cwd(), file), beforeSha256: sha256(original), afterSha256: sha256(output), beforeBytes: original.length, afterBytes: output.length, changes })
    console.log(`${entry.name}: ${(original.length / 1e6).toFixed(2)} -> ${(output.length / 1e6).toFixed(2)} MB; Three.js geometry check passed`)
  }
  await writeFile(path.join(work, 'optimization.json'), JSON.stringify(report, null, 2) + '\n')
  if (values.apply) {
    // Validate the entire batch and guard concurrent edits before publishing any.
    for (const model of report.models) assert.equal(sha256(await readFile(model.file)), model.beforeSha256)
    for (const model of report.models) {
      const candidate = path.join(work, 'optimized', model.instrument, path.basename(model.file))
      await copyFile(candidate, model.file + '.tmp'); await rename(model.file + '.tmp', model.file)
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main()
