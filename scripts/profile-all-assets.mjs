import { createServer } from 'vite'
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve, join, basename } from 'node:path'
import { buildRevisedProfile } from '../src/features/activity-review/profile-export.ts'
import { parseReviewReport } from '../src/features/activity-review/report-validation.ts'

const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
let excerpt
try { excerpt = (await server.ssrLoadModule('/src/features/listening/excerpt.ts')).currentExcerpt } finally { await server.close() }
const directory = resolve(excerpt.opusDirectory)
const output = resolve('public/audio', excerpt.id, 'review', 'offline')
await mkdir(output, { recursive: true })
const allFiles = [...new Set([excerpt.fullOrchestraFile, ...Object.values(excerpt.stems), ...Object.values(excerpt.familyStems)])]
const reports = new Map()
for (const wav of allFiles) {
  const name = wav.replace(/\.wav$/i, '.m4a'), stem = basename(wav, '.wav')
  const file = join(directory, name), reportPath = join(output, `${stem}-review.json`)
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/analyze-review.mjs', '--input', file, '--output', reportPath, '--kind', 'derived'], { stdio: 'inherit' })
  reports.set(wav, parseReviewReport(JSON.parse(await readFile(reportPath, 'utf8'))))
}
const base = JSON.parse(await readFile(resolve(excerpt.activityOutput), 'utf8'))
const profile = buildRevisedProfile({
  excerptId: excerpt.id, base,
  instruments: Object.fromEntries(Object.entries(excerpt.stems).map(([id, file]) => [id, reports.get(file)])),
  families: Object.fromEntries(Object.entries(excerpt.familyStems).map(([id, file]) => [id, reports.get(file)])),
  orchestra: reports.get(excerpt.fullOrchestraFile),
})
const destination = resolve(excerpt.activityOutput.replace(/\.json$/, '.revised.json'))
await writeFile(`${destination}.tmp`, JSON.stringify(profile))
await rename(`${destination}.tmp`, destination)
const summary = {
  excerpt: excerpt.id, generatedAt: profile.profiling.generatedAt, sourceKind: 'encoded M4A', reviewed: false,
  duration: profile.duration, sampleInterval: profile.sampleInterval, profile: destination,
  instruments: Object.fromEntries(Object.keys(profile.instruments).map(id => [id, {
    candidates: profile.onsets[id].length, soundingSpans: profile.gates[id].length / 2,
    minDb: profile.analysisByKey[id].minDb, maxDb: profile.analysisByKey[id].maxDb,
  }])),
}
await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
