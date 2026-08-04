export function buildYouTubeEmbedUrl(embedUrl: string, origin: string) {
  const url = new URL(embedUrl)
  if (url.hostname === 'www.youtube-nocookie.com') {
    url.hostname = 'www.youtube.com'
  }
  url.searchParams.set('autoplay', '1')
  url.searchParams.set('playsinline', '1')
  url.searchParams.set('origin', origin)
  return url.toString()
}

export function requiresExternalYouTubePlayback(userAgent: string) {
  return /\bElectron\//.test(userAgent) && /\bCode\//.test(userAgent)
}