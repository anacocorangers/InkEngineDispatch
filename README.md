# InkEngine Dispatch

InkEngine Dispatch is a sibling project in the InkEngine ecosystem. It tracks official updates, social signals, and platform releases in a unified dashboard.

## Workspace Layout

- `apps/web`: Vite + React dashboard
- `apps/api`: Fastify aggregation API
- `packages/contracts`: Shared source/feed schemas and types

## Source Coverage

- YouTube (optional API key), Twitch
- Steam News (public endpoint)
- Reddit (optional OAuth for better limits)
- Official site RSS/scrape path
- Discord, TikTok, X, Facebook, Instagram, and Threads
- Bluesky and Mastodon public APIs
- LinkedIn, Telegram, Pinterest, Snapchat, and Tumblr

## Local Development

1. Copy `.env.example` to `.env`, add the account/channel identifiers to monitor, and fill the credentials for restricted APIs.
2. Install dependencies, start PostgreSQL, and apply migrations:

```sh
npm install
npm run db:up
npm run db:migrate
```

3. Run both apps:

```sh
npm run dev
```

4. Open the dashboard at `http://localhost:5173`.

Without `DATABASE_URL`, the API automatically uses in-memory storage. This keeps development available but does not retain posts across restarts.

## Scripts

```sh
npm run dev
npm run build
npm run test
npm run lint
npm run check:types
npm run db:up
npm run db:migrate
npm run db:generate
npm run db:down
```

## API Endpoints

- `GET /health`
- `GET /api/sources`
- `GET /api/feed`

Feed pagination uses `GET /api/feed?limit=20&cursor=...`. The response includes `nextCursor` and reports whether it came from `memory` or `postgres` storage.

## Notes

- Social adapters are intentionally credential-safe stubs until account targets and approved API credentials are configured. InkEngine Dispatch does not bypass logins, rate limits, or platform access controls.
- Bluesky and Mastodon support public API collection without credentials once target handles are configured.
- PostgreSQL deduplicates posts by source and external ID. Drizzle migrations live in `apps/api/drizzle`.
- Shared contracts are published inside the monorepo as the `@inkengine/contracts` workspace package.

## Google Cloud Run

The API container is defined by the root `Dockerfile`. Cloud Build configuration lives in `cloudbuild.yaml` and deploys to `us-east1` using the `inkengine` Artifact Registry repository.

```sh
gcloud builds submit \
	--project=inkeginelive-dispatch \
	--config=cloudbuild.yaml \
	.
```

Before production deployment, configure `DATABASE_URL` and `INKENGINE_WEB_ORIGIN` through Secret Manager and Cloud Run environment settings. Never commit `.env`.

If you are serving videos from Google Cloud Storage or a CDN, set `INKENGINE_MEDIA_BASE_URL` to the public HLS directory prefix. Dispatch will look for manifests at `${INKENGINE_MEDIA_BASE_URL}/${videoId}/master.m3u8` for YouTube-sourced feed items.

## Google Cloud Storage + HLS

Recommended bucket layout:

```text
gs://inkengine-dispatch-media/
	videos/
		<video-id>/
			master.m3u8
			720p.m3u8
			720p_00001.ts
			720p_00002.ts
			480p.m3u8
			480p_00001.ts
			poster.jpg
```

Package a source file with FFmpeg:

```sh
ffmpeg -i input.mp4 \
	-preset veryfast \
	-g 48 -sc_threshold 0 \
	-map 0:v:0 -map 0:a:0 \
	-c:v h264 -c:a aac \
	-f hls \
	-hls_time 6 \
	-hls_playlist_type vod \
	-hls_segment_filename "720p_%05d.ts" \
	720p.m3u8
```

Upload the manifest set to GCS:

```sh
gsutil -m cp -r ./output/* gs://inkengine-dispatch-media/videos/<video-id>/
```

Set the API environment variable to the public HLS prefix:

```text
INKENGINE_MEDIA_BASE_URL=https://storage.googleapis.com/inkengine-dispatch-media/videos
```

When Dispatch receives a YouTube item, it will prefer `${INKENGINE_MEDIA_BASE_URL}/${videoId}/master.m3u8` and fall back to the YouTube embed path if no HLS manifest exists yet.

To automate the packaging/upload step from the repo root, run:

```sh
npm run media:publish -- ./input.mp4 <video-id> gs://inkengine-dispatch-media/videos
```

The script expects `ffmpeg` and `gsutil` to be available on your `PATH`.

## Vercel

Import the GitHub repository as a Vercel project and leave the root directory at the repository root. The checked-in `vercel.json` builds the shared contracts package before the web app.

Set this Vercel production environment variable to the Cloud Run service URL, without a trailing slash:

```text
VITE_API_BASE_URL=https://your-cloud-run-service-url
```

After Vercel assigns a production URL, set Cloud Run's `INKENGINE_WEB_ORIGIN` to that exact HTTPS origin. When `dispatch.inkengine.live` is attached, update both values to use the final domain where appropriate.
