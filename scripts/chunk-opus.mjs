import { mkdir, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { openWav } from './lib/wav.mjs'
import { probeAudio, requireFfmpeg, runCommand } from './lib/ffmpeg.mjs'
import {
  DEFAULT_BITRATE,
  assertBitrate,
  assertSafeEncodePaths,
  formatBytes,
  formatPercent,
  isWavFileName,
  matchRequestedFile,
  shouldSkipEncode,
  temporaryOpusPath,
  validateOpusAgainstSource,
} from './lib/opus-encode.mjs'
import {
  DEFAULT_CHUNK_DURATION,
  FULL_ORCHESTRA_FILE,
  assertChunkDuration,
  chunkManifest,
  chunkPlan,
  expectedChunkNames,
  isFullOrchestraFile,
  parseChunkArgs,
  resolveChunkDirectory,
  sharedTimeline,
  stemIdFromWav,
} from './lib/opus-chunks.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

function usage() {
  return [
    'Cut master WAV stems into synchronized Opus chunks. Masters are never modified.',
    'full-orchestra.wav is encoded as one file by audio:encode and is not chunked.',
    '',
    'Usage:',
    '  npm run audio:chunks -- [excerpt-id] [--force] [--bitrate 96k] [--chunk-duration 15] [--file name.wav]',
    '',
    `Default bitrate: ${DEFAULT_BITRATE}`,
    `Default chunk duration: ${DEFAULT_CHUNK_DURATION}s`,
  ].join('\n')
}

async function existingStat(path) {
  try {
    return await stat(path)
  } catch {
    return undefined
  }
}

async function encodeChunk(sourcePath, destPath, chunk, bitrate, sourceChannels) {
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
      '-af', `atrim=start_sample=${chunk.startSample}:end_sample=${chunk.endSample - 1},asetpts=PTS-STARTPTS`,
      '-c:a', 'libopus',
      '-b:a', bitrate,
      tempPath,
    ])
    const destProbe = await probeAudio(tempPath)
    const validation = validateOpusAgainstSource(
      { codec: 'pcm', channels: sourceChannels, duration: chunk.durationSeconds, size: 1 },
      destProbe,
    )
    if (validation.errors.length) throw new Error(validation.errors.join('; '))
    await rename(tempPath, dest)
    return { destProbe, validation }
  } catch (error) {
    await unlink(tempPath).catch(() => {})
    throw error
  }
}

async function readStemChunks(stemDir) {
  const names = (await readdir(stemDir).catch(() => [])).filter(name => /^\d+\.opus$/i.test(name)).sort()
  return names
}

function missingChunkNames(plan, existing) {
  const have = new Set(existing)
  return expectedChunkNames(plan).filter(name => !have.has(name))
}

const args = parseChunkArgs(process.argv.slice(2))
if (args.help) {
  console.log(usage())
  process.exit(0)
}

let bitrate
let chunkDuration
try {
  bitrate = assertBitrate(args.bitrate)
  chunkDuration = assertChunkDuration(args.chunkDuration)
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
    const fullOrchestraFile = excerpt.fullOrchestraFile ?? FULL_ORCHESTRA_FILE
    const sourceDir = resolve(root, excerpt.stemDirectory)
    const chunkDirectory = resolveChunkDirectory(excerpt.stemDirectory, excerpt.chunkDirectory)
    const destRoot = resolve(root, chunkDirectory)
    const opusDirectory = resolve(root, excerpt.opusDirectory ?? excerpt.stemDirectory)
    let ffmpegVersion
    try {
      ffmpegVersion = await requireFfmpeg()
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

    const wavFiles = sourceEntries.filter(isWavFileName).sort((a, b) => a.localeCompare(b))
    const orchestraFiles = wavFiles.filter(name => isFullOrchestraFile(name, fullOrchestraFile))
    const chunkable = wavFiles.filter(name => !isFullOrchestraFile(name, fullOrchestraFile))
    if (!chunkable.length) {
      console.error(`No chunkable WAV stems found in ${excerpt.stemDirectory}`)
      process.exitCode = 1
      throw new Error('no chunkable wav files')
    }

    let selected
    try {
      selected = matchRequestedFile(chunkable, args.file)
    } catch (error) {
      if (args.file && isFullOrchestraFile(args.file, fullOrchestraFile) || args.file?.toLowerCase() === 'full-orchestra') {
        console.error(`${fullOrchestraFile} is a continuous mix and is not chunked. Use npm run audio:encode.`)
      } else {
        console.error(error instanceof Error ? error.message : error)
      }
      process.exitCode = 1
      throw error
    }

    const sources = chunkable.map(name => {
      const wav = openWav(join(sourceDir, name))
      return { name, sampleRate: wav.sampleRate, frameCount: wav.frameCount, channels: wav.channels }
    })
    const timeline = sharedTimeline(sources)
    const plan = chunkPlan({
      frameCount: timeline.frameCount,
      sampleRate: timeline.sampleRate,
      chunkDuration,
    })

    console.log(`Chunking ${excerpt.title}`)
    console.log(`FFmpeg: ${ffmpegVersion}`)
    console.log(`Bitrate: ${bitrate}`)
    console.log(`Chunk duration: ${plan.chunkDuration}s`)
    console.log(`Shared timeline: ${plan.durationSeconds.toFixed(6)}s @ ${plan.sampleRate} Hz`)
    console.log(`Chunks per stem: ${plan.chunks.length}`)
    console.log(`Source: ${excerpt.stemDirectory}`)
    console.log(`Output: ${chunkDirectory}`)
    console.log('')
    for (const warning of timeline.warnings) console.log(`Warning: ${warning}`)

    const results = []
    for (const [index, name] of selected.entries()) {
      const stemId = stemIdFromWav(name)
      const label = `[${index + 1}/${selected.length}] ${stemId}`
      const sourcePath = join(sourceDir, name)
      const stemDir = join(destRoot, stemId)
      try {
        const sourceStat = await stat(sourcePath)
        const existing = await readStemChunks(stemDir)
        const missing = missingChunkNames(plan, existing)
        const newestChunk = existing.length
          ? Math.max(...await Promise.all(existing.map(async file => (await stat(join(stemDir, file))).mtimeMs)))
          : Number.NaN
        const skip = !missing.length
          && existing.length === plan.chunks.length
          && shouldSkipEncode({ sourceMtimeMs: sourceStat.mtimeMs, destMtimeMs: newestChunk, force: args.force })

        const source = sources.find(item => item.name === name)
        const chunkBytes = []
        if (skip) {
          for (const chunk of plan.chunks) {
            const destPath = join(stemDir, chunk.name)
            const destProbe = await probeAudio(destPath)
            const validation = validateOpusAgainstSource(
              { codec: 'pcm', channels: source.channels, duration: chunk.durationSeconds, size: 1 },
              destProbe,
            )
            if (validation.errors.length) {
              throw new Error(`${chunk.name} failed validation (${validation.errors.join('; ')})`)
            }
            chunkBytes.push((await stat(destPath)).size)
          }
          console.log(`${label} — already up to date (${plan.chunks.length} chunks)`)
          results.push({ name, stemId, status: 'skipped', sourceBytes: sourceStat.size, destBytes: chunkBytes.reduce((sum, value) => sum + value, 0) })
          continue
        }

        if (missing.length && existing.length) {
          for (const file of existing) await unlink(join(stemDir, file)).catch(() => {})
        }
        await mkdir(stemDir, { recursive: true })
        for (const chunk of plan.chunks) {
          const destPath = join(stemDir, chunk.name)
          await encodeChunk(sourcePath, destPath, chunk, bitrate, source.channels)
          chunkBytes.push((await stat(destPath)).size)
        }
        const leftover = (await readStemChunks(stemDir)).filter(file => !expectedChunkNames(plan).includes(file))
        for (const file of leftover) await unlink(join(stemDir, file)).catch(() => {})
        console.log(`${label} — ${plan.chunks.length} chunks`)
        results.push({ name, stemId, status: 'converted', sourceBytes: sourceStat.size, destBytes: chunkBytes.reduce((sum, value) => sum + value, 0) })
      } catch (error) {
        console.log(`${label} — FAILED`)
        results.push({
          name,
          stemId,
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
    const wholeOpusBytes = (await Promise.all(chunkable.map(async name => {
      const opus = await existingStat(join(opusDirectory, name.replace(/\.wav$/i, '.opus')))
      return opus?.size ?? 0
    }))).reduce((sum, value) => sum + value, 0)
    const orchestraOpus = await existingStat(join(opusDirectory, fullOrchestraFile.replace(/\.wav$/i, '.opus')))
    const orchestraWav = orchestraFiles[0] ? await existingStat(join(sourceDir, orchestraFiles[0])) : undefined

    const completeStemIds = []
    for (const name of chunkable) {
      const stemId = stemIdFromWav(name)
      const existing = await readStemChunks(join(destRoot, stemId))
      if (!missingChunkNames(plan, existing).length && existing.length === plan.chunks.length) {
        completeStemIds.push(stemId)
      }
    }
    if (completeStemIds.length === chunkable.length && !failed.length) {
      const manifest = chunkManifest({
        excerptId: excerpt.id,
        plan,
        bitrate,
        stems: completeStemIds,
      })
      await mkdir(destRoot, { recursive: true })
      await writeFile(join(destRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    }

    const typicalChunk = destBytes > 0 && plan.chunks.length && measured.length
      ? destBytes / (measured.length * plan.chunks.length)
      : 0
    const familyWindow = typicalChunk * 8

    console.log('')
    console.log(`Stems processed: ${results.length}`)
    console.log(`Converted: ${converted.length}`)
    console.log(`Skipped: ${skipped.length}`)
    console.log(`Failed: ${failed.length}`)
    console.log(`Excerpt duration: ${plan.durationSeconds.toFixed(3)}s`)
    console.log(`Chunks per stem: ${plan.chunks.length}`)
    console.log(`Total chunks: ${measured.length * plan.chunks.length}`)
    console.log('')
    console.log('Source WAV (chunked stems):')
    console.log(formatBytes(sourceBytes))
    console.log('')
    console.log('Whole-file Opus (same stems):')
    console.log(wholeOpusBytes ? formatBytes(wholeOpusBytes) : 'not found')
    console.log('')
    console.log('Chunked Opus:')
    console.log(formatBytes(destBytes))
    console.log('')
    console.log('Reduction vs WAV:')
    console.log(sourceBytes > 0 ? formatPercent((sourceBytes - destBytes) / sourceBytes) : 'unknown')
    console.log('')
    console.log('Approx. 15s × 8 stems (compressed):')
    console.log(formatBytes(familyWindow))
    console.log('(This is file size, not decoded AudioBuffer memory.)')

    if (orchestraWav) {
      if (orchestraOpus) {
        console.log('')
        console.log(`${fullOrchestraFile.replace(/\.wav$/i, '.opus')} left as one continuous file (${formatBytes(orchestraOpus.size)})`)
      } else {
        console.log('')
        console.log(`Warning: ${fullOrchestraFile} exists but the continuous Opus mix is missing. Run npm run audio:encode.`)
      }
    }

    if (failed.length) {
      console.error('')
      console.error('Failures:')
      for (const item of failed) console.error(`- ${item.stemId}: ${item.error}`)
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
