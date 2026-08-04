#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

function printUsage() {
  console.log(`Usage:
  npm run media:publish -- <input.mp4> <video-id> <metadata.json> <gcs-prefix>

Arguments:
  <input.mp4>       Source MP4 file to package.
  <video-id>        Dispatch video ID used for the GCS folder name.
  <metadata.json>   JSON file with title, summary, url, thumbnailUrl, publishedAt, and tags.
  <gcs-prefix>      GCS prefix such as gs://inkengine-dispatch-media/videos.

Example:
  npm run media:publish -- ./input.mp4 hosted-clip-1 ./clip.json gs://inkengine-dispatch-media/videos
`)
}

function runCommand(command, args, description) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`${description} failed.`)
  }
}

function toPublicBase(gcsPrefix) {
  const normalized = gcsPrefix.replace(/^gs:\/\//, 'https://storage.googleapis.com/')
  return normalized.replace(/\/$/, '')
}

function toBucketRoot(gcsPrefix) {
  const match = gcsPrefix.replace(/\/$/, '').match(/^gs:\/\/([^/]+)(?:\/.*)?$/)
  if (!match) {
    throw new Error(`Invalid GCS prefix: ${gcsPrefix}`)
  }
  return `gs://${match[1]}`
}

function parseJsonFile(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  }
  catch (error) {
    throw new Error(`Unable to read ${label} at ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function normalizeItem(metadata, videoId, playbackUrl) {
  const publishedAt = new Date(metadata.publishedAt ?? new Date().toISOString()).toISOString()

  return {
    id: metadata.id ?? videoId,
    sourceId: 'media',
    title: metadata.title,
    summary: metadata.summary,
    url: metadata.url,
    thumbnailUrl: metadata.thumbnailUrl,
    playbackUrl,
    publishedAt,
    tags: Array.isArray(metadata.tags) ? metadata.tags : ['video', 'hosted'],
  }
}

function mergeFeed(existingFeed, nextItem) {
  const items = Array.isArray(existingFeed) ? existingFeed : existingFeed?.items ?? []
  const nextItems = items.filter((item) => item && item.id !== nextItem.id)
  nextItems.push(nextItem)
  nextItems.sort((left, right) => {
    const timeOrder = right.publishedAt.localeCompare(left.publishedAt)
    if (timeOrder !== 0) return timeOrder
    return right.id.localeCompare(left.id)
  })
  return { items: nextItems }
}

function main() {
  const [inputPath, videoId, metadataPath, gcsPrefix] = process.argv.slice(2)

  if (!inputPath || !videoId || !metadataPath || !gcsPrefix || inputPath === '--help' || inputPath === '-h') {
    printUsage()
    process.exit(inputPath ? 0 : 1)
  }

  const sourceFile = resolve(process.cwd(), inputPath)
  const metadataFile = resolve(process.cwd(), metadataPath)
  if (!existsSync(sourceFile)) {
    console.error(`Input file not found: ${sourceFile}`)
    process.exit(1)
  }
  if (!existsSync(metadataFile)) {
    console.error(`Metadata file not found: ${metadataFile}`)
    process.exit(1)
  }

  const metadata = parseJsonFile(metadataFile, 'metadata')
  if (!metadata.title || !metadata.summary || !metadata.url || !metadata.thumbnailUrl) {
    console.error('Metadata must include title, summary, url, and thumbnailUrl.')
    process.exit(1)
  }

  const workDir = mkdtempSync(resolve(tmpdir(), 'inkengine-media-'))
  const mediaPrefix = resolve(workDir, '720p')
  const masterPlaylist = resolve(workDir, 'master.m3u8')
  const bucketPrefix = `${gcsPrefix.replace(/\/$/, '')}/${videoId}`
  const publicBase = toPublicBase(gcsPrefix)
  const bucketRoot = toBucketRoot(gcsPrefix)
  const playbackUrl = `${publicBase}/${videoId}/master.m3u8`
  const feedUrl = `${toPublicBase(bucketRoot)}/media-feed.json`

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
      '-hls_segment_filename', `${mediaPrefix}_%05d.ts`,
      '-var_stream_map', 'v:0,a:0,name:720p',
      resolve(workDir, '%v.m3u8'),
    ], 'FFmpeg packaging')

    if (!existsSync(masterPlaylist)) {
      throw new Error('FFmpeg did not generate master.m3u8.')
    }

    runCommand('gsutil', ['-m', 'rsync', '-r', workDir, bucketPrefix], 'HLS upload')

    const nextItem = normalizeItem(metadata, videoId, playbackUrl)
    let existingFeed = null
    const remoteFeedPath = `${bucketRoot}/media-feed.json`
    const catResult = spawnSync('gsutil', ['cat', remoteFeedPath], { encoding: 'utf8' })
    if (catResult.status === 0 && catResult.stdout) {
      try {
        existingFeed = JSON.parse(catResult.stdout)
      }
      catch {
        existingFeed = null
      }
    }

    const mergedFeed = mergeFeed(existingFeed, nextItem)
    const feedFile = resolve(workDir, 'media-feed.json')
    writeFileSync(feedFile, `${JSON.stringify(mergedFeed, null, 2)}\n`)

    runCommand('gsutil', ['cp', feedFile, remoteFeedPath], 'Media feed upload')

    console.log(`Published HLS bundle to ${playbackUrl}`)
    console.log(`Updated hosted media feed at ${feedUrl}`)
  }
  finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

main()