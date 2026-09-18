import { mkdir, readdir, writeFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { openWav, rmsWindowsFromWav } from './lib/wav.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

function parseArgs(argv) {
  const options = { interval: undefined, excerptId: undefined }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--interval') {
      options.interval = Number(argv[++index])
      continue
    }
    if (!arg.startsWith('-') && !options.excerptId) options.excerptId = arg
  }
  return options
}

function formatSeconds(value) {
  return Number.isFinite(value) ? value.toFixed(1) : 'unknown'
}

function pad(values, length) {
  if (values.length >= length) return values.slice(0, length)
  return values.concat(Array.from({ length: length - values.length }, () => 0))
}

function validateProfile(profile, expectedIds) {
  const errors = []
  if (profile.version !== 1) errors.push('version must be 1')
  if (!(profile.sampleInterval > 0)) errors.push('sampleInterval must be > 0')
  if (!(profile.duration >= 0)) errors.push('duration must be finite and >= 0')
  const expectedCount = Math.round(profile.duration / profile.sampleInterval)
  for (const id of expectedIds) {
    const values = profile.instruments[id]
    if (!values) {
      errors.push(`missing instrument ${id}`)
      continue
    }
    if (values.length !== expectedCount) {
      errors.push(`${id}: expected ${expectedCount} samples, found ${values.length}`)
    }
    for (const [index, value] of values.entries()) {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        errors.push(`${id}[${index}] is ${value}`)
        break
      }
    }
  }
  return errors
}

const server = await createServer({
  configFile: false,
  root,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
})

try {
  const { excerptById, currentExcerptId, excerptCatalog } = await server.ssrLoadModule('/src/features/listening/excerpt.ts')
  const {
    defaultInstrumentAnalysisConfig,
    defaultOfflineActivityAnalysis,
  } = await server.ssrLoadModule('/src/features/listening/instrument-activity.ts')
  const { combineWindowRms, intensityEnvelopeFromRms } = await server.ssrLoadModule('/src/features/listening/offline-activity.ts')

  const args = parseArgs(process.argv.slice(2))
  const excerptId = args.excerptId ?? currentExcerptId
  const excerpt = excerptById(excerptId)
  if (!excerpt) {
    console.error(`Unknown excerpt "${excerptId}". Known: ${Object.keys(excerptCatalog).join(', ')}`)
    process.exitCode = 1
  } else {
    const analysis = defaultInstrumentAnalysisConfig
    const offline = {
      ...defaultOfflineActivityAnalysis,
      sampleInterval: args.interval > 0 ? args.interval : defaultOfflineActivityAnalysis.sampleInterval,
    }
    const stemDir = resolve(root, excerpt.stemDirectory)
    const outputPath = resolve(root, excerpt.activityOutput)
    const instrumentIds = Object.keys(excerpt.stems)
    const filesOnDisk = new Set((await readdir(stemDir).catch(() => [])).filter(name => name.endsWith('.wav')))
    const mappedFiles = new Set(instrumentIds.flatMap(id => excerpt.stems[id]))

    console.log(`Analyzing ${excerpt.title}`)
    console.log('')

    const warnings = []
    const durations = []
    const envelopes = {}
    let fileIndex = 0
    const totalFiles = [...mappedFiles].length

    for (const instrumentId of instrumentIds) {
      const names = excerpt.stems[instrumentId]
      const windows = []
      for (const name of names) {
        fileIndex += 1
        const path = join(stemDir, name)
        process.stdout.write(`[${fileIndex}/${totalFiles}] ${name}\n`)
        if (!filesOnDisk.has(name)) {
          warnings.push(`${name}: source file cannot be decoded (missing)`)
          continue
        }
        try {
          const wav = openWav(path)
          const result = rmsWindowsFromWav(path, offline.sampleInterval)
          durations.push({ name, instrumentId, duration: result.duration, sampleRate: wav.sampleRate })
          windows.push(result.windows)
        } catch (error) {
          warnings.push(`${name}: ${error instanceof Error ? error.message : error}`)
        }
      }
      if (!windows.length) {
        warnings.push(`${instrumentId}: instrument mapping has no readable stems`)
        continue
      }
      envelopes[instrumentId] = intensityEnvelopeFromRms(
        combineWindowRms(windows),
        offline.sampleInterval,
        analysis,
        offline,
      )
    }

    const unmapped = [...filesOnDisk].filter(name => !mappedFiles.has(name))
    if (unmapped.length) warnings.push(`unmapped WAV files: ${unmapped.join(', ')}`)

    const uniqueDurations = [...new Set(durations.map(item => item.duration.toFixed(4)))]
    const minDuration = Math.min(...durations.map(item => item.duration))
    const maxDuration = Math.max(...durations.map(item => item.duration))
    if (durations.length && maxDuration - minDuration > 0.001) {
      const message = `stem durations differ by ${((maxDuration - minDuration) * 1000).toFixed(1)} ms`
      if (maxDuration - minDuration >= offline.durationWarnSeconds) {
        warnings.push(`${message} — possible synchronization problem; stems were not stretched or trimmed`)
      } else {
        warnings.push(`${message} (harmless export/metadata difference; no resync applied)`)
      }
    }

    const duration = Number.isFinite(maxDuration) ? maxDuration : 0
    const sampleCount = Math.round(duration / offline.sampleInterval)
    const instruments = Object.fromEntries(Object.entries(envelopes).map(([id, envelope]) => [
      id,
      pad(envelope.intensity, sampleCount),
    ]))

    const profile = {
      version: 1,
      excerptId: excerpt.id,
      duration,
      sampleInterval: offline.sampleInterval,
      analysis: {
        activateThresholdDb: analysis.activateThresholdDb,
        deactivateThresholdDb: analysis.deactivateThresholdDb,
        minDb: analysis.minDb,
        maxDb: analysis.maxDb,
        attackTime: analysis.attackTimeSeconds,
        releaseTime: analysis.releaseTimeSeconds,
      },
      instruments,
    }

    const errors = validateProfile(profile, instrumentIds.filter(id => instruments[id]))
    JSON.parse(JSON.stringify(profile))

    await mkdir(dirname(outputPath), { recursive: true })
    const json = `${JSON.stringify(profile)}\n`
    await writeFile(outputPath, json)

    const outputBytes = (await stat(outputPath)).size
    console.log('')
    console.log(`Duration: ${formatSeconds(duration)} sec`)
    console.log(`Resolution: ${Math.round(offline.sampleInterval * 1000)} ms`)
    console.log(`Samples per instrument: ${sampleCount.toLocaleString('en-US')}`)
    console.log(`Instruments: ${Object.keys(instruments).length}`)
    console.log(`Output size: ${(outputBytes / 1024).toFixed(0)} KB`)
    if (uniqueDurations.length) console.log(`Stem duration span: ${formatSeconds(minDuration)}–${formatSeconds(maxDuration)} sec`)
    console.log(`Wrote ${outputPath.slice(root.length + 1)}`)
    console.log('')
    for (const [id, envelope] of Object.entries(envelopes)) {
      const values = instruments[id]
      const activeTime = envelope.active.filter(Boolean).length * offline.sampleInterval
      const peak = values.reduce((max, value) => Math.max(max, value), 0)
      const activeRatio = duration > 0 ? activeTime / duration : 0
      console.log(`${id}:`)
      console.log(`  detected active time: ${formatSeconds(activeTime)} sec`)
      console.log(`  peak intensity: ${peak.toFixed(3)}`)
      if (peak === 0) warnings.push(`${id}: entire stem contains no detected activity`)
      if (activeRatio > 0.98) warnings.push(`${id}: appears active almost continuously (${(activeRatio * 100).toFixed(1)}%)`)
    }
    if (errors.length) {
      console.error('')
      console.error('Validation failed:')
      for (const error of errors) console.error(`- ${error}`)
      process.exitCode = 1
    }
    if (warnings.length) {
      console.log('')
      console.log('Warnings:')
      for (const warning of warnings) console.log(`- ${warning}`)
    }
  }
} finally {
  await server.close()
}
