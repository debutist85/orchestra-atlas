import { mkdir, readdir, rename, stat, unlink } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { createServer } from 'vite'
import {
  DEFAULT_BITRATE,
  assertBitrate,
  assertSafeEncodePaths,
  audioProbeFromFfprobe,
  formatBytes,
  formatPercent,
  isWavFileName,
  matchRequestedFile,
  opusFileName,
  parseEncodeArgs,
  resolveOpusDirectory,
  shouldSkipEncode,
  temporaryOpusPath,
  validateOpusAgainstSource,
} from './lib/opus-encode.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

function usage() {
  return [
    'Encode master WAV stems to Opus web assets. Masters are never modified.',
    '',
    'Usage:',
    '  npm run audio:encode -- [excerpt-id] [--force] [--bitrate 96k] [--file name.wav]',
    '',
    `Default bitrate: ${DEFAULT_BITRATE}`,
  ].join('\n')
}

function runCommand(command, args) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const stdout = []
    const stderr = []
    child.stdout.on('data', chunk => stdout.push(chunk))
    child.stderr.on('data', chunk => stderr.push(chunk))
    child.on('error', error => {
      if (error.code === 'ENOENT') {
        reject(new Error(`${command} is not installed or not on PATH.`))
        return
      }
      reject(error)
    })
    child.on('close', code => {
      const result = {
        code,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      }
      if (code !== 0) {
        const detail = result.stderr.trim() || result.stdout.trim() || `exit ${code}`
        reject(new Error(`${command} failed: ${detail}`))
        return
      }
      resolveCommand(result)
    })
  })
}

async function requireTools() {
  let version
  try {
    version = (await runCommand('ffmpeg', ['-version'])).stdout.split('\n')[0] ?? 'ffmpeg'
  } catch (error) {
    throw new Error(`FFmpeg is required. ${error instanceof Error ? error.message : error}`)
  }
  let encoders
  try {
    encoders = (await runCommand('ffmpeg', ['-hide_banner', '-encoders'])).stdout
  } catch (error) {
    throw new Error(`Could not list FFmpeg encoders. ${error instanceof Error ? error.message : error}`)
  }
  if (!/^\s*A[.\w]*\s+libopus\b/m.test(encoders)) {
    throw new Error('This FFmpeg build does not include libopus. Install FFmpeg with --enable-libopus.')
  }
  try {
    await runCommand('ffprobe', ['-version'])
  } catch (error) {
    throw new Error(`ffprobe is required. ${error instanceof Error ? error.message : error}`)
  }
  return version
}

async function probeAudio(path) {
  const result = await runCommand('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    path,
  ])
  try {
    return audioProbeFromFfprobe(JSON.parse(result.stdout))
  } catch (error) {
    throw new Error(`${basename(path)}: not valid audio (${error instanceof Error ? error.message : error})`)
  }
}

async function encodeStem(sourcePath, destPath, bitrate) {
  const { sourcePath: source, destPath: dest } = assertSafeEncodePaths(sourcePath, destPath)
  const tempPath = temporaryOpusPath(dest)
  await mkdir(dirname(dest), { recursive: true })
  await unlink(tempPath).catch(() => {})
  try {
    await runCommand('ffmpeg', [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-i', source,
      '-c:a', 'libopus',
      '-b:a', bitrate,
      tempPath,
    ])
    const destProbe = await probeAudio(tempPath)
    const sourceProbe = await probeAudio(source)
    const validation = validateOpusAgainstSource(sourceProbe, destProbe)
    if (validation.errors.length) {
      throw new Error(validation.errors.join('; '))
    }
    await rename(tempPath, dest)
    return { sourceProbe, destProbe, validation }
  } catch (error) {
    await unlink(tempPath).catch(() => {})
    throw error
  }
}

async function existingDestStat(destPath) {
  try {
    return await stat(destPath)
  } catch {
    return undefined
  }
}

const args = parseEncodeArgs(process.argv.slice(2))
if (args.help) {
  console.log(usage())
  process.exit(0)
}

let bitrate
try {
  bitrate = assertBitrate(args.bitrate)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
  process.exit()
}

const server = await createServer({
  configFile: false,
  root,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
})

try {
  const { excerptById, currentExcerptId, excerptCatalog } = await server.ssrLoadModule('/src/features/listening/excerpt.ts')
  const excerptId = args.excerptId ?? currentExcerptId
  const excerpt = excerptById(excerptId)
  if (!excerpt) {
    console.error(`Unknown excerpt "${excerptId}". Known: ${Object.keys(excerptCatalog).join(', ')}`)
    process.exitCode = 1
  } else {
    const opusDirectory = resolveOpusDirectory(excerpt.stemDirectory, excerpt.opusDirectory)
    const sourceDir = resolve(root, excerpt.stemDirectory)
    const destDir = resolve(root, opusDirectory)
    let ffmpegVersion
    try {
      ffmpegVersion = await requireTools()
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
      throw error
    }

    let sourceEntries
    try {
      sourceEntries = await readdir(sourceDir)
    } catch {
      console.error(`Source directory missing: ${excerpt.stemDirectory}`)
      process.exitCode = 1
      throw new Error('source directory missing')
    }

    let files
    try {
      files = matchRequestedFile(sourceEntries.filter(isWavFileName).sort((a, b) => a.localeCompare(b)), args.file)
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
      throw error
    }
    if (!files.length) {
      console.error(`No WAV files found in ${excerpt.stemDirectory}`)
      process.exitCode = 1
      throw new Error('no wav files')
    }

    console.log(`Encoding ${excerpt.title}`)
    console.log(`FFmpeg: ${ffmpegVersion}`)
    console.log(`Bitrate: ${bitrate}`)
    console.log(`Source: ${excerpt.stemDirectory}`)
    console.log(`Output: ${opusDirectory}`)
    console.log('')

    const results = []
    for (const [index, name] of files.entries()) {
      const label = `[${index + 1}/${files.length}] ${name}`
      const sourcePath = join(sourceDir, name)
      const destPath = join(destDir, opusFileName(name))
      try {
        assertSafeEncodePaths(sourcePath, destPath)
        const sourceStat = await stat(sourcePath)
        const destStat = await existingDestStat(destPath)
        const skip = shouldSkipEncode({
          sourceMtimeMs: sourceStat.mtimeMs,
          destMtimeMs: destStat?.mtimeMs,
          force: args.force,
        })
        if (skip) {
          const sourceProbe = await probeAudio(sourcePath)
          const destProbe = await probeAudio(destPath)
          const validation = validateOpusAgainstSource(sourceProbe, destProbe)
          if (validation.errors.length) {
            throw new Error(`existing output failed validation (${validation.errors.join('; ')})`)
          }
          console.log(`${label} — already up to date`)
          results.push({
            name,
            status: 'skipped',
            sourceBytes: sourceStat.size,
            destBytes: destStat.size,
            sourceDuration: sourceProbe.duration,
            destDuration: destProbe.duration,
            notes: validation.notes,
          })
          continue
        }
        const encoded = await encodeStem(sourcePath, destPath, bitrate)
        const written = await stat(destPath)
        console.log(label)
        results.push({
          name,
          status: 'converted',
          sourceBytes: sourceStat.size,
          destBytes: written.size,
          sourceDuration: encoded.sourceProbe.duration,
          destDuration: encoded.destProbe.duration,
          notes: encoded.validation.notes,
        })
      } catch (error) {
        console.log(`${label} — FAILED`)
        results.push({
          name,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const converted = results.filter(item => item.status === 'converted')
    const skipped = results.filter(item => item.status === 'skipped')
    const failed = results.filter(item => item.status === 'failed')
    const measured = results.filter(item => item.status !== 'failed')
    const sourceBytes = measured.reduce((sum, item) => sum + item.sourceBytes, 0)
    const destBytes = measured.reduce((sum, item) => sum + item.destBytes, 0)
    const saved = sourceBytes - destBytes
    const deltas = measured.map(item => Math.abs(item.destDuration - item.sourceDuration))
    const maxDelta = deltas.length ? Math.max(...deltas) : 0
    const suspicious = measured.filter(item => Math.abs(item.destDuration - item.sourceDuration) > 0.08)

    console.log('')
    console.log(`Converted: ${converted.length}`)
    console.log(`Skipped: ${skipped.length}`)
    console.log(`Failed: ${failed.length}`)
    console.log('')
    console.log('Source WAV:')
    console.log(formatBytes(sourceBytes))
    console.log('')
    console.log('Generated Opus:')
    console.log(formatBytes(destBytes))
    console.log('')
    console.log('Reduction:')
    console.log(sourceBytes > 0 ? formatPercent(saved / sourceBytes) : 'unknown')
    if (measured.length) {
      const ratios = measured.map(item => item.destBytes / item.sourceBytes)
      const average = ratios.reduce((sum, value) => sum + value, 0) / ratios.length
      console.log('')
      console.log(`Average per-stem size: ${formatPercent(average)} of the WAV`)
      console.log(`Duration check: max |Opus − WAV| ${ (maxDelta * 1000).toFixed(1) } ms`)
    }
    if (suspicious.length) {
      console.log('')
      console.log('Duration notes:')
      for (const item of suspicious) {
        const deltaMs = (Math.abs(item.destDuration - item.sourceDuration) * 1000).toFixed(1)
        console.log(`- ${item.name}: ${deltaMs} ms`)
      }
    }
    if (failed.length) {
      console.error('')
      console.error('Failures:')
      for (const item of failed) console.error(`- ${item.name}: ${item.error}`)
      process.exitCode = 1
    }
  }
} catch (error) {
  if (process.exitCode !== 1) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
} finally {
  await server.close()
}
