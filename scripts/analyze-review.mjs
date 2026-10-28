import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, stat, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readWavChannels } from './lib/wav.mjs'
import { analysisDefaults, makeReport, measureAudio } from '../src/features/activity-review/analysis.ts'

const options = { input: '', directory: '', output: '', track: '', kind: 'unknown', gateDb: analysisDefaults.gateDb, sensitivity: analysisDefaults.onsetSensitivity }
const args = process.argv.slice(2)
if (!args.length || args.includes('--help')) {
  console.log(`Analyze WAV or M4A sources without changing production activity profiles.

npm run audio:review -- --input path/to/cello.wav --track cello --kind master --output /tmp/cello-review.json
npm run audio:review -- --directory public/audio/beethoven-7th-2nd/stems/raw --output public/audio/beethoven-7th-2nd/review

Options: --gate-db -65 --sensitivity 3. Directory mode marks WAVs as declared masters; M4As remain encoded sources.
Import the resulting JSON and matching audio at /dev/activity-review.`)
} else {
  for (let i = 0; i < args.length; i++) {
    const name = args[i], value = args[++i]
    if (value === undefined) throw new Error(`Missing value for ${name}`)
    if (name === '--gate-db') options.gateDb = Number(value)
    else if (name === '--sensitivity') options.sensitivity = Number(value)
    else if (['--input', '--directory', '--output', '--track', '--kind'].includes(name)) options[name.slice(2)] = value
    else throw new Error(`Unknown option: ${name}`)
  }
  if (!!options.input === !!options.directory) throw new Error('Choose either --input or --directory')
  if (options.input && !options.output) throw new Error('Single-file mode requires --output path/to/report.json')
  if (!['master', 'derived', 'unknown'].includes(options.kind)) throw new Error('--kind must be master, derived or unknown')
  const files = options.input ? [resolve(options.input)] : (await readdir(options.directory)).filter(name => /\.(wav|m4a)$/i.test(name)).sort().map(name => resolve(options.directory, name))
  if (!files.length) throw new Error('No WAV or M4A audio files found.')
  for (const file of files) {
    const source = await stat(file)
    const hash = createHash('sha256')
    for await (const bytes of createReadStream(file)) hash.update(bytes)
    console.log(`Measuring ${basename(file)}…`)
    let temporary
    let decoded
    try {
      let pcm = file
      if (/\.m4a$/i.test(file)) {
        temporary = await mkdtemp(join(tmpdir(), 'atlas-review-decode-'))
        pcm = join(temporary, 'decoded.wav')
        const run = promisify(execFile)
        if (process.platform === 'darwin') await run('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEF32', file, pcm])
        else await run('ffmpeg', ['-v', 'error', '-i', file, '-c:a', 'pcm_f32le', pcm])
      }
      decoded = readWavChannels(pcm)
    } finally { if (temporary) await rm(temporary, { recursive: true, force: true }) }
    const parameters = { ...analysisDefaults, gateDb: options.gateDb, onsetSensitivity: options.sensitivity }
    const measurements = measureAudio(decoded.channels, decoded.sampleRate, parameters)
    const stem = basename(file).replace(/\.(wav|m4a)$/i, '')
    const track = options.track || ({ full_orchestra: 'orchestra', 'full-orchestra': 'orchestra', contrabass: 'doubleBass' }[stem] ?? stem)
    const report = makeReport(measurements, { name: basename(file), sha256: hash.digest('hex'), bytes: source.size, kind: /\.m4a$/i.test(file) ? 'derived' : options.directory ? 'master' : options.kind, track }, parameters)
    const output = options.directory ? join(options.output || join(options.directory, '..', '..', 'review'), `${stem}-review.json`) : options.output
    if (!output) throw new Error('Single-file mode requires --output path/to/report.json')
    if (resolve(output) === resolve(file)) throw new Error('Refusing to overwrite the source WAV')
    await mkdir(dirname(output), { recursive: true })
    await writeFile(output, JSON.stringify(report))
    console.log(`Wrote ${output}: ${measurements.duration.toFixed(2)}s, ${report.onsets.length} onset candidates, ${report.gates.length / 2} sounding spans.`)
  }
}
