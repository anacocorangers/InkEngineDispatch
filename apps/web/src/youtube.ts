export function buildYouTubeEmbedUrl(embedUrl: string, origin: string) {
  const url = new URL(embedUrl)
  url.hostname = 'www.youtube.com'
  url.searchParams.set('autoplay', '1')
  url.searchParams.set('playsinline', '1')
  url.searchParams.set('origin', origin)
  return url.toString()
}

export function buildEmbedUrl(embedUrl: string, origin: string) {
  const url = new URL(embedUrl)
  if (url.hostname === 'player.twitch.tv') {
    url.searchParams.set('parent', new URL(origin).hostname)
    url.searchParams.set('autoplay', 'true')
    return url.toString()
  }
  return buildYouTubeEmbedUrl(embedUrl, origin)
}

export function isHlsManifestUrl(urlString: string) {
  try {
    return new URL(urlString).pathname.endsWith('.m3u8')
  }
  catch {
    return false
  }
}