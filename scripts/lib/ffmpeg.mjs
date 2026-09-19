import { basename } from 'node:path'
import { spawn } from 'node:child_process'
import { audioProbeFromFfprobe } from './opus-encode.mjs'

export function runCommand(command, args) {
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

export async function requireFfmpeg() {
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

export async function probeAudio(path) {
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
