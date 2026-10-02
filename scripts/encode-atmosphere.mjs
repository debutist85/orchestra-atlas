import { mkdir, rename, rm, stat, unlink } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatBytes } from './lib/opus-encode.mjs'
import { runCommand } from './lib/ffmpeg.mjs'

// Optimize a stock clip into decorative background-video files.
// The source is never modified. Outputs land in public/videos/atmosphere/<id>/.
//
// Usage:
//   npm run video:atmosphere
//   npm run video:atmosphere -- public/videos/woodwinds.mp4
//   npm run video:atmosphere -- public/videos/woodwinds.mp4 --force
//
// Requires FFmpeg on PATH (libx264 and libvpx). This repo does not install it.
// macOS: brew install ffmpeg

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const atmosphereRoot = resolve(root, 'public/videos/atmosphere')
const defaultSource = resolve(root, 'public/videos/strings.mp4')

// 11s at these average rates lands near the middle of each size target.
// Frame rate is 24; 23.976 sources are resampled.
const profiles = [
  {
    id: 'production',
    width: 1920,
    height: 1080,
    h264: { bitrate: '2200k' },
    vp9: { bitrate: '2200k' },
    target: [2 * 1024 * 1024, 4 * 1024 * 1024],
  },
  {
    id: 'lightweight',
    width: 1280,
    height: 720,
    h264: { bitrate: '1050k' },
    vp9: { bitrate: '1050k' },
    target: [1 * 1024 * 1024, 2 * 1024 * 1024],
  },
]

function usage() {
  return [
    'Encode a background clip to VP9 WebM and H.264 MP4. The source file is not modified.',
    '',
    'Usage:',
    '  npm run video:atmosphere -- [source.mp4] [--force]',
    '',
    'With no source, encodes public/videos/strings.mp4.',
    'Writes public/videos/atmosphere/<clip-id>/{production,lightweight}.{webm,mp4}',
    'and poster.jpg. Re-encodes when the source is newer, or when --force is set.',
  ].join('\n')
}

function parseArgs(argv) {
  const options = { source: undefined, force: false, help: false }
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--force') options.force = true
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
    else if (!options.source) options.source = arg
    else throw new Error(`Unexpected argument: ${arg}`)
  }
  return options
}

function clipIdFromSource(sourcePath) {
  const id = basename(sourcePath, extname(sourcePath))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  if (!id) throw new Error(`Could not derive a clip id from ${sourcePath}`)
  return id
}

function assertOutputPath(sourcePath, destPath) {
  const source = resolve(sourcePath)
  const dest = resolve(destPath)
  if (source === dest) throw new Error('Refusing to overwrite the source video.')
  const rootPrefix = atmosphereRoot.endsWith(sep) ? atmosphereRoot : atmosphereRoot + sep
  if (!dest.startsWith(rootPrefix)) {
    throw new Error(`Refusing to write outside ${atmosphereRoot}: ${dest}`)
  }
}

async function requireVideoFfmpeg() {
  try {
    await runCommand('ffmpeg', ['-version'])
  } catch (error) {
    const detail = error instanceof Error ? error.message : error
    throw new Error([
      `FFmpeg is required (${detail}).`,
      'Install it on the machine. This project does not take an FFmpeg dependency.',
      'macOS: brew install ffmpeg',
    ].join(' '))
  }
  const encoders = (await runCommand('ffmpeg', ['-hide_banner', '-encoders'])).stdout
  if (!/libx264\b/.test(encoders)) throw new Error('This FFmpeg build does not include libx264.')
  if (!/libvpx-vp9\b/.test(encoders)) throw new Error('This FFmpeg build does not include libvpx-vp9.')
  await runCommand('ffprobe', ['-version'])
}

async function probe(path) {
  const result = await runCommand('ffprobe', [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path,
  ])
  const json = JSON.parse(result.stdout)
  const video = (json.streams ?? []).find(stream => stream.codec_type === 'video')
  const audio = (json.streams ?? []).some(stream => stream.codec_type === 'audio')
  return {
    codec: video?.codec_name,
    width: Number(video?.width),
    height: Number(video?.height),
    audio,
    duration: Number(json.format?.duration),
    size: Number(json.format?.size),
  }
}

async function newerThan(destPath, sourceMtimeMs) {
  try {
    const dest = await stat(destPath)
    return dest.mtimeMs > sourceMtimeMs
  } catch {
    return false
  }
}

function filterFor(profile) {
  return `fps=24,scale=${profile.width}:${profile.height}:flags=lanczos`
}

function h264Args(profile) {
  const rate = profile.h264.crf !== undefined
    ? ['-crf', String(profile.h264.crf)]
    : ['-b:v', profile.h264.bitrate]
  return [
    '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-level', '4.0',
    '-pix_fmt', 'yuv420p', ...rate,
  ]
}

function vp9Args(profile) {
  const rate = profile.vp9.crf !== undefined
    ? ['-b:v', '0', '-crf', String(profile.vp9.crf)]
    : ['-b:v', profile.vp9.bitrate]
  return [
    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-row-mt', '1',
    '-deadline', 'good', '-cpu-used', '2', ...rate,
  ]
}

async function encode({ source, dest, videoArgs, passes, passlog }) {
  assertOutputPath(source, dest)
  const temp = `${dest}.encoding.${process.pid}${extname(dest)}`
  await mkdir(dirname(dest), { recursive: true })
  await unlink(temp).catch(() => {})
  try {
    for (let pass = 1; pass <= passes; pass += 1) {
      const args = [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', source,
        '-map', '0:v:0', '-an',
        '-vf', videoArgs.filter,
        ...videoArgs.args,
      ]
      if (passes > 1) args.push('-pass', String(pass), '-passlogfile', passlog)
      if (pass < passes) args.push('-f', 'null', '-')
      else {
        if (dest.endsWith('.mp4')) args.push('-movflags', '+faststart')
        args.push(temp)
      }
      await runCommand('ffmpeg', args)
    }
    await rename(temp, dest)
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  } finally {
    await rm(`${passlog}-0.log`, { force: true })
    await rm(`${passlog}-0.log.mbtree`, { force: true })
  }
}

async function encodePoster(source, dest) {
  assertOutputPath(source, dest)
  const temp = `${dest}.encoding.${process.pid}.jpg`
  await mkdir(dirname(dest), { recursive: true })
  await unlink(temp).catch(() => {})
  try {
    await runCommand('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-ss', '2', '-i', source,
      '-map', '0:v:0', '-frames:v', '1',
      '-vf', 'scale=1920:1080:flags=lanczos',
      '-q:v', '6',
      temp,
    ])
    await rename(temp, dest)
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}

function targetNote(size, target) {
  if (!target) return ''
  const [min, max] = target
  if (size < min || size > max) return `  outside ${formatBytes(min)}–${formatBytes(max)}`
  return ''
}

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  console.log(usage())
  process.exit(0)
}

const source = resolve(args.source ?? defaultSource)
const clipId = clipIdFromSource(source)
const outputDir = join(atmosphereRoot, clipId)
const sourceStat = await stat(source).catch(() => {
  throw new Error(`Source not found: ${source}`)
})

await requireVideoFfmpeg()
await mkdir(join(root, 'node_modules/.cache/atmosphere-encode'), { recursive: true })

const posterPath = join(outputDir, 'poster.jpg')
if (args.force || !(await newerThan(posterPath, sourceStat.mtimeMs))) {
  process.stdout.write(`poster  ${clipId}/poster.jpg\n`)
  await encodePoster(source, posterPath)
}

const rows = []
for (const profile of profiles) {
  const jobs = [
    {
      name: `${profile.id}.mp4`,
      expected: 'h264',
      passes: profile.h264.crf !== undefined ? 1 : 2,
      args: h264Args(profile),
    },
    {
      name: `${profile.id}.webm`,
      expected: 'vp9',
      passes: profile.vp9.crf !== undefined ? 1 : 2,
      args: vp9Args(profile),
    },
  ]
  for (const job of jobs) {
    const dest = join(outputDir, job.name)
    if (!args.force && await newerThan(dest, sourceStat.mtimeMs)) {
      process.stdout.write(`skip    ${clipId}/${job.name}\n`)
    } else {
      process.stdout.write(`encode  ${clipId}/${job.name}\n`)
      const passlog = join(root, 'node_modules/.cache/atmosphere-encode', `${clipId}-${job.name}`)
      await encode({
        source,
        dest,
        passes: job.passes,
        passlog,
        videoArgs: { filter: filterFor(profile), args: job.args },
      })
    }
    const info = await probe(dest)
    const problems = []
    if (info.audio) problems.push('audio stream present')
    if (info.codec !== job.expected) problems.push(`codec ${info.codec ?? 'missing'}, expected ${job.expected}`)
    if (info.width !== profile.width || info.height !== profile.height) {
      problems.push(`${info.width}×${info.height}, expected ${profile.width}×${profile.height}`)
    }
    if (!(info.size > 0)) problems.push('empty file')
    if (problems.length) throw new Error(`${job.name}: ${problems.join('; ')}`)
    rows.push({ name: job.name, info, target: profile.target })
  }
}

const poster = await stat(posterPath)
console.log('')
console.log(`${clipId}  source ${formatBytes(sourceStat.size)}  →  ${outputDir}`)
for (const row of rows) {
  console.log(`${row.name.padEnd(20)} ${formatBytes(row.info.size).padStart(8)}${targetNote(row.info.size, row.target)}`)
}
console.log(`${'poster.jpg'.padEnd(20)} ${formatBytes(poster.size).padStart(8)}`)
