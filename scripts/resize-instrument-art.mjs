// Generates a smaller "-sm" WebP variant alongside each instrument/family
// illustration, so small viewports don't download the same full-resolution
// artwork as desktop. Source files are never modified. Also writes a small
// dimensions manifest (checked into git, unlike the gitignored artwork
// itself) so components can build an accurate `srcSet` without hardcoding
// pixel widths.
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const artDirectory = join(root, 'public/images/instruments')
const layoutDirectories = [
  join(root, 'src/features/orchestra-map/identity-layout/instruments'),
  join(root, 'src/features/orchestra-map/identity-layout/families'),
]
const manifestPath = join(root, 'src/features/orchestra-map/identity-layout/artwork-dimensions.json')
const SMALL_SUFFIX = '-sm.webp'
// A "small" variant only gets picked by the browser if it's still large
// enough to satisfy `sizes × devicePixelRatio` at the smallest CSS width the
// artwork is ever displayed at — a flat fraction of natural width (e.g.
// "always half") ignores that and ends up too small to ever be selected on
// any modern (2x+) phone, silently falling back to the full image. Instead,
// read each image's own smallest clamp() width directly out of its
// identity-layout data file and size the small variant for a realistic
// high-density phone at that size.
const ASSUMED_DEVICE_PIXEL_RATIO = 2
const MIN_SMALL_WIDTH = 150

function usage() {
  return [
    'Generate small (-sm.webp) responsive variants of instrument/family artwork,',
    'sized from each image\'s own smallest CSS display width, and refresh',
    'their dimensions manifest.',
    '',
    'Usage:',
    '  npm run images:resize -- [--force]',
  ].join('\n')
}

function isSourceArtwork(fileName) {
  return extname(fileName).toLowerCase() === '.webp' && !fileName.endsWith(SMALL_SUFFIX)
}

async function mtime(path) {
  return (await stat(path).catch(() => null))?.mtimeMs ?? 0
}

// Maps an artwork path (as written in a layout file, e.g.
// "/images/instruments/cello.webp") to the smallest `clamp(MINpx, ...)`
// width any layout displays it at, across every instrument/family file.
async function minDisplayWidths() {
  const widths = new Map()
  for (const directory of layoutDirectories) {
    const files = (await readdir(directory).catch(() => [])).filter(name => name.endsWith('.ts'))
    for (const file of files) {
      const text = await readFile(join(directory, file), 'utf8')
      const artworkMatch = text.match(/const artwork = "([^"]+)"/)
      if (!artworkMatch) continue
      const clampMins = [...text.matchAll(/width:\s*"clamp\((\d+)px/g)].map(match => Number(match[1]))
      if (!clampMins.length) continue
      const path = artworkMatch[1]
      const min = Math.min(...clampMins)
      widths.set(path, Math.min(widths.get(path) ?? Infinity, min))
    }
  }
  return widths
}

function targetSmallWidth(naturalWidth, minDisplayWidth) {
  const forDensity = Math.round((minDisplayWidth ?? naturalWidth / 2) * ASSUMED_DEVICE_PIXEL_RATIO)
  return Math.min(naturalWidth, Math.max(MIN_SMALL_WIDTH, forDensity))
}

async function resizeOne(sourcePath, destPath, targetWidth, force) {
  if (!force && (await mtime(destPath)) >= (await mtime(sourcePath))) return { skipped: true }
  await sharp(sourcePath).resize({ width: targetWidth, withoutEnlargement: true }).webp().toFile(destPath)
  return { skipped: false }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) { console.log(usage()); return }
  const force = args.includes('--force')
  const entries = (await readdir(artDirectory)).filter(isSourceArtwork)
  if (!entries.length) { console.log('No source artwork found under public/images/instruments.'); return }
  const minWidths = await minDisplayWidths()
  const dimensions = {}
  for (const fileName of entries) {
    const sourcePath = join(artDirectory, fileName)
    const smallName = fileName.replace(/\.webp$/, SMALL_SUFFIX)
    const destPath = join(artDirectory, smallName)
    const { width: naturalWidth } = await sharp(sourcePath).metadata()
    if (!naturalWidth) throw new Error(`Could not read width of ${sourcePath}`)
    const minDisplayWidth = minWidths.get(`/images/instruments/${fileName}`)
    const targetWidth = targetSmallWidth(naturalWidth, minDisplayWidth)
    const result = await resizeOne(sourcePath, destPath, targetWidth, force)
    const smallWidth = result.skipped ? (await sharp(destPath).metadata()).width : targetWidth
    dimensions[fileName] = { natural: naturalWidth, small: smallWidth }
    console.log(result.skipped
      ? `Skipped ${fileName} (up to date)`
      : `Resized ${fileName} -> ${smallName} (${smallWidth}px wide, from min display width ${minDisplayWidth ?? 'unknown'}px)`)
  }
  await mkdir(join(root, 'src/features/orchestra-map/identity-layout'), { recursive: true })
  await writeFile(manifestPath, `${JSON.stringify(dimensions, null, 2)}\n`)
  console.log(`Wrote ${Object.keys(dimensions).length} entries to identity-layout/artwork-dimensions.json`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
