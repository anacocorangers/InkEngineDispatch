# InkEngine Dispatch

InkEngine Dispatch is a sibling project in the InkEngine ecosystem. It tracks official updates, social signals, and platform releases in a unified dashboard.

## Workspace Layout

- `apps/web`: Vite + React dashboard
- `apps/api`: Fastify aggregation API
- `packages/contracts`: Shared source/feed schemas and types

## Source Coverage

- Official War of Rights news and Steam announcements
- YouTube (optional API key) and Twitch live streams
- Selected regiment/community iCalendar feeds
- Hosted media feed for curated HLS playback
- Reddit (optional OAuth for better limits)
- Discord, TikTok, X, Facebook, Instagram, and Threads
- LinkedIn, Pinterest, Snapchat, and Tumblr

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
- `POST /api/refresh`

Feed pagination uses `GET /api/feed?limit=20&cursor=...`. The response includes `nextCursor` and reports whether it came from `memory` or `postgres` storage.

Source status reports the latest attempt and successful refresh times, imported item count, consecutive failures, and scheduled retry. Failed adapters use exponential backoff up to 30 minutes while the repository continues serving last-known-good reports. `POST /api/refresh` starts an immediate refresh of eligible sources but still honors active backoff windows.

## Notes

- Tumblr is implemented against its official public API; `x`, `facebook`, `instagram`, `threads`, `linkedin`, `pinterest`, and `snapchat` remain intentionally credential-safe stubs until account targets and approved API credentials are configured. InkEngine Dispatch does not bypass logins, rate limits, or platform access controls.
- Discord reads only explicitly configured channels through the official bot API using `DISCORD_BOT_TOKEN` and `DISCORD_CHANNEL_IDS`.
- Tumblr reads only explicitly configured blogs using `TUMBLR_API_KEY` and `TUMBLR_BLOGS`.
- TikTok reads videos authorized through the official Display API using `TIKTOK_ACCESS_TOKEN`; client credentials alone do not grant content access.
- Twitch requires `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` from a Twitch application.
- Community events read comma-separated public `.ics` URLs from `COMMUNITY_EVENT_FEED_URLS`.
- Only explicitly selected community calendars and social accounts are imported; the application does not guess trusted sources.
- PostgreSQL deduplicates posts by source and external ID. Drizzle migrations live in `apps/api/drizzle`.
- Shared contracts are published inside the monorepo as the `@inkengine/contracts` workspace package.

### Discord

Create a bot in the Discord Developer Portal, invite it to the target server with **View Channels** and **Read Message History**, then enable Developer Mode in Discord and copy each selected channel ID. Configure Cloud Run without placing the token in source control:

```powershell
.\scripts\configure-discord.ps1
```

For self-service server onboarding, add this production redirect under **OAuth2 > Redirects** in the Discord Developer Portal:

```text
https://inkengine-dispatch-api-482705553707.us-east1.run.app/api/discord/callback
```

Copy the OAuth2 client secret, then store and bind it without placing it in source control or chat:

```powershell
.\scripts\configure-discord-oauth.ps1 -ClientSecretFromClipboard
```

The public **Add to Discord** command then authorizes the bot with only View Channels and Read Message History. A server administrator chooses approved event channels on the setup page; those selections and source health are stored in PostgreSQL.

### Twitch Live Streams

1. Sign in at `https://dev.twitch.tv/console/apps` and register an application.
2. Use `https://dispatch.inkengine.live` as the OAuth redirect URL and choose **Website Integration** as the category.
3. Open the application, create a client secret, and keep both values private.
4. From the repository root, run:

```powershell
.\scripts\configure-twitch-oauth.ps1
```

Enter the client ID and client secret only at the secure terminal prompts. The script stores them in Google Secret Manager, grants the Cloud Run runtime account access, and attaches them as `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`.

For local development, place those two variables in an untracked `.env` file instead. Twitch uses application-only OAuth; no streamer account login or user access token is required. The live feed searches Twitch for channels currently broadcasting War of Rights.

The **Live now** tab combines Twitch, YouTube live broadcasts, and playable hosted media tagged `live`. Other platforms can join the same tab when their adapter emits a playable item with the `live` tag; direct HLS streams can use the hosted media feed.

### TikTok Videos

TikTok requires an approved developer application and a TikTok user authorization containing the `video.list` scope. After obtaining the user access token from TikTok's official OAuth flow, configure it without placing the value in source control or chat:

```powershell
.\scripts\configure-tiktok.ps1
```

The script reads the token through a masked prompt, stores it as `tiktok-access-token` in Secret Manager, grants the Cloud Run runtime identity access, and binds it as `TIKTOK_ACCESS_TOKEN`. TikTok access tokens expire and must be replaced or refreshed according to TikTok's current OAuth requirements.

### Tumblr Posts

Register an application at `https://www.tumblr.com/oauth/apps` to obtain an OAuth consumer key. Tumblr's public post feed only requires this key, no user login. Configure it without placing the value in source control:

```powershell
.\scripts\configure-tumblr.ps1
```

The script stores the key as `tumblr-api-key` in Secret Manager, grants the Cloud Run runtime identity access, binds it as `TUMBLR_API_KEY`, and sets `TUMBLR_BLOGS` to the comma-separated blog identifiers you approve (e.g. `waroftrights.tumblr.com`). Only blogs explicitly listed in `TUMBLR_BLOGS` are imported.

## Google Cloud Run

The API container is defined by the root `Dockerfile`. Cloud Build configuration lives in `cloudbuild.yaml` and deploys to `us-east1` using the `inkengine` Artifact Registry repository.

```sh
gcloud builds submit \
	--project=inkeginelive-dispatch \
	--config=cloudbuild.yaml \
	.
```

Before production deployment, configure `DATABASE_URL` and `INKENGINE_WEB_ORIGIN` through Secret Manager and Cloud Run environment settings. Never commit `.env`.

When binding secrets or env vars with `gcloud run services update`, always use `--update-secrets`/`--update-env-vars` (merges with existing bindings), never `--set-secrets`/`--set-env-vars` (replaces the entire set and silently drops every other source's credentials). All `scripts/configure-*.ps1` files follow this rule.

### Reddit OAuth

Create a Reddit app at `https://www.reddit.com/prefs/apps` using the **script** app type. Set its name to `InkEngine Dispatch`; the redirect URI is required by Reddit but is not used by the application-only flow, so `https://dispatch.inkengine.live` is sufficient.

Reddit's [Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy) requires apps to state a clear, non-commercial purpose and scope. If an app request is denied for lacking detail, resubmit (or register at `https://developers.reddit.com/app-registration`, Reddit's newer app registration flow) with a description along these lines:

> Non-commercial fan community dashboard for the video game War of Rights. Reads only the public r/WarOfRights subreddit (single subreddit, read-only) to display post titles, links, and timestamps in a community news feed. No posting, voting, commenting, or direct messages. No data resale, redistribution, or AI/ML training use. Complies with Reddit API rate limits.

OAuth only unlocks higher rate limits — it is not required. Without `REDDIT_CLIENT_ID` configured, the adapter automatically falls back to the public `r/WarOfRights` Atom feed, which is what powers the feed today.

Store the app ID shown beneath the app name and its secret in Google Secret Manager. Enter the values only in your local terminal, never in chat or source control:

```powershell
.\scripts\configure-reddit-oauth.ps1
```

The script prompts privately for both values, creates or updates the secrets, grants the Cloud Run runtime identity access, and deploys the environment binding. The equivalent manual commands are:

```powershell
gcloud secrets create reddit-client-id --replication-policy=automatic
$redditClientId = Read-Host 'Reddit client ID'
$redditClientId | gcloud secrets versions add reddit-client-id --data-file=-

gcloud secrets create reddit-client-secret --replication-policy=automatic
$redditClientSecret = Read-Host 'Reddit client secret'
$redditClientSecret | gcloud secrets versions add reddit-client-secret --data-file=-
```

Grant the Cloud Run runtime service account access, then attach both secrets to the API:

```powershell
$projectNumber = gcloud projects describe inkeginelive-dispatch --format='value(projectNumber)'
$runtimeServiceAccount = "$projectNumber-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding reddit-client-id --member="serviceAccount:$runtimeServiceAccount" --role='roles/secretmanager.secretAccessor'
gcloud secrets add-iam-policy-binding reddit-client-secret --member="serviceAccount:$runtimeServiceAccount" --role='roles/secretmanager.secretAccessor'

gcloud run services update inkengine-dispatch-api --project=inkeginelive-dispatch --region=us-east1 --update-secrets='REDDIT_CLIENT_ID=reddit-client-id:latest,REDDIT_CLIENT_SECRET=reddit-client-secret:latest'
```

Dispatch can also ingest a separate hosted media feed for curated videos you own or are licensed to host. Set `INKENGINE_MEDIA_FEED_URL` to a JSON feed that returns items with `playbackUrl` values pointing at HLS manifests.

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

Publish a clip and update the feed in one command:

```sh
npm run media:publish -- ./input.mp4 hosted-clip-1 ./clip.json gs://inkengine-dispatch-media/videos
```

The `clip.json` file should contain `title`, `summary`, `url`, `thumbnailUrl`, `publishedAt`, and `tags`.

If you only want the HLS bundle without updating the feed, use:

```sh
npm run media:package -- ./input.mp4 hosted-clip-1 gs://inkengine-dispatch-media/videos
```

Upload the manifest set to GCS:

```sh
gsutil -m cp -r ./output/* gs://inkengine-dispatch-media/videos/<video-id>/
```

Set the hosted media feed environment variable:

```text
INKENGINE_MEDIA_FEED_URL=https://storage.googleapis.com/inkengine-dispatch-media/media-feed.json
```

The feed item format is a JSON array or object with an `items` array. Each item should include `id`, `title`, `summary`, `url`, `thumbnailUrl`, `playbackUrl`, `publishedAt`, and `tags`.

The publisher expects `ffmpeg` and `gsutil` to be available on your `PATH`.

On Windows, you can use the wrapper instead:

```bat
scripts\publish-media.cmd .\input.mp4 hosted-clip-1 .\clip.json gs://inkengine-dispatch-media/videos
```

If you only need HLS packaging, use `scripts\publish-hls.cmd`.

Set `INKENGINE_MEDIA_FEED_TOKEN` if your feed requires a bearer token.

## Vercel

Import the GitHub repository as a Vercel project and leave the root directory at the repository root. The checked-in `vercel.json` builds the shared contracts package before the web app.

Set this Vercel production environment variable to the Cloud Run service URL, without a trailing slash:

```text
VITE_API_BASE_URL=https://your-cloud-run-service-url
```

After Vercel assigns a production URL, set Cloud Run's `INKENGINE_WEB_ORIGIN` to that exact HTTPS origin. When `dispatch.inkengine.live` is attached, update both values to use the final domain where appropriate.
