#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

function printUsage() {
  console.log(`Usage:
  npm run media:package -- <input.mp4> <video-id> <gcs-prefix>

Arguments:
  <input.mp4>    Source MP4 file to package.
  <video-id>     Dispatch video ID used for the GCS folder name.
  <gcs-prefix>   GCS prefix such as gs://inkengine-dispatch-media/videos.

Example:
  npm run media:package -- ./input.mp4 P4CVavsbo6w gs://inkengine-dispatch-media/videos
`)
}

function runCommand(command, args, description) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`${description} failed.`)
  }
}

function main() {
  const [inputPath, videoId, gcsPrefix] = process.argv.slice(2)

  if (!inputPath || !videoId || !gcsPrefix || inputPath === '--help' || inputPath === '-h') {
    printUsage()
    process.exit(inputPath ? 0 : 1)
  }

  const sourceFile = resolve(process.cwd(), inputPath)
  if (!existsSync(sourceFile)) {
    console.error(`Input file not found: ${sourceFile}`)
    process.exit(1)
  }

  const workDir = mkdtempSync(resolve(tmpdir(), 'inkengine-hls-'))
  const outputPrefix = resolve(workDir, '720p')
  const masterPlaylist = resolve(workDir, 'master.m3u8')

  try {
    runCommand('ffmpeg', [
      '-y',
      '-i', sourceFile,
      '-map', '0:v:0',
      '-map', '0:a:0?',
      '-c:v:0', 'libx264',
      '-c:a:0', 'aac',
      '-preset', 'veryfast',
      '-g', '48',
      '-sc_threshold', '0',
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_playlist_type', 'vod',
      '-master_pl_name', 'master.m3u8',
      '-hls_segment_filename', `${outputPrefix}_%05d.ts`,
      '-var_stream_map', 'v:0,a:0,name:720p',
      resolve(workDir, '%v.m3u8'),
    ], 'FFmpeg packaging')

    if (!existsSync(masterPlaylist)) {
      throw new Error('FFmpeg did not generate master.m3u8.')
    }

    const targetPrefix = `${gcsPrefix.replace(/\/$/, '')}/${videoId}`
    runCommand('gsutil', ['-m', 'rsync', '-r', workDir, targetPrefix], 'GCS upload')

    console.log(`Published HLS bundle to ${targetPrefix}/master.m3u8`)
  }
  finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

main()