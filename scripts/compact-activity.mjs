import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { brotliCompressSync, gzipSync, constants } from 'node:zlib'
import { parseArgs } from 'node:util'

export function compactActivity(profile, interval = .02, decimals = 3) {
  const stride = Math.round(interval / profile.sampleInterval)
  if (!Number.isFinite(interval) || stride < 1 || Math.abs(stride * profile.sampleInterval - interval) > 1e-9) {
    throw new Error('Runtime interval must be a positive multiple of the source interval')
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) throw new Error('Decimals must be between 0 and 6')
  const scale = 10 ** decimals
  const series = values => values.filter((_, i) => i % stride === 0).map(value => Math.round(value * scale) / scale)
  const tracks = values => Object.fromEntries(Object.entries(values).map(([id, values]) => [id, series(values)]))
  // This artifact is only for visual sampling. Shared/family envelopes and
  // calibration details belong to the full analysis/audio-gain profile.
  const instruments = tracks(profile.instruments)
  return {
    version: profile.version, excerptId: profile.excerptId, duration: profile.duration,
    sampleInterval: interval, instruments,
    analysisByKey: {}, instrumentsShared: {},
    ...(profile.orchestra ? { orchestra: series(profile.orchestra) } : {}),
    ...(profile.gates ? { gates: profile.gates } : {}),
    ...(profile.onsets ? { onsets: Object.fromEntries(Object.entries(profile.onsets)
      .filter(([id]) => id === 'orchestra' || id in instruments)) } : {}),
    ...(profile.chunks ? { chunks: profile.chunks } : {}),
  }
}

// Audio makeup gains are sensitive to quiet/nonzero samples. Keep both
// envelope scales and their original timing/precision exactly; compression
// saves transfer bytes without retuning the mix. Gates/onsets also support
// the map's existing fallback when its separate visual profile is unavailable.
export function compactGainActivity(profile) {
  if (!(profile.sampleInterval > 0) || !profile.instruments || !profile.instrumentsShared
    || Object.keys(profile.instruments).some(id => !profile.instrumentsShared[id])) {
    throw new Error('Gain runtime requires calibrated and shared instrument envelopes')
  }
  return {
    version: profile.version, excerptId: profile.excerptId, duration: profile.duration,
    sampleInterval: profile.sampleInterval, analysisByKey: {},
    instruments: profile.instruments, instrumentsShared: profile.instrumentsShared,
    ...(profile.orchestra ? { orchestra: profile.orchestra } : {}),
    ...(profile.gates ? { gates: profile.gates } : {}),
    ...(profile.onsets ? { onsets: Object.fromEntries(Object.entries(profile.onsets)
      .filter(([id]) => id === 'orchestra' || id in profile.instruments)) } : {}),
    ...(profile.chunks ? { chunks: profile.chunks } : {}),
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    input: { type: 'string', default: 'public/audio/beethoven-7th-2nd/activity/beethoven-7th-2nd.json' },
    output: { type: 'string' }, 'gain-output': { type: 'string' },
    'interval-ms': { type: 'string', default: '20' }, decimals: { type: 'string', default: '3' },
  } })
  const input = resolve(values.input)
  const output = resolve(values.output ?? values.input.replace(/\.json$/, '.runtime.json'))
  const gainOutput = resolve(values['gain-output'] ?? output.replace(/(?:\.runtime)?\.json$/, '.gain.runtime.json'))
  if (input === output || input === gainOutput || output === gainOutput) throw new Error('Runtime outputs must be distinct from the analysis source and each other')
  const source = await readFile(input)
  const original = JSON.parse(source)
  const sourceSha256 = createHash('sha256').update(source).digest('hex')
  const visual = compactActivity(original, Number(values['interval-ms']) / 1000, Number(values.decimals))
  visual.runtime = { sourceSha256, sourceInterval: original.sampleInterval, decimals: Number(values.decimals) }
  const gain = compactGainActivity(original)
  gain.runtime = { sourceSha256, kind: 'gain-lossless-v1' }
  for (const [destination, profile] of [[output, visual], [gainOutput, gain]]) {
    const json = Buffer.from(JSON.stringify(profile))
    const gzip = gzipSync(json, { level: 9 })
    const brotli = brotliCompressSync(json, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT } })
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, json)
    await writeFile(`${destination}.gz`, gzip)
    await writeFile(`${destination}.br`, brotli)
    console.log(JSON.stringify({ output: destination, sourceBytes: source.length, runtimeBytes: json.length, gzipBytes: gzip.length, brotliBytes: brotli.length, intervalMs: profile.sampleInterval * 1000, reductionPercent: +(100 * (1 - json.length / source.length)).toFixed(1) }, null, 2))
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
