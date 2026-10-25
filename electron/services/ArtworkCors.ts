import { net, type BrowserWindow } from 'electron'

const ART_HOST = /^https:\/\/([a-z0-9-]+\.)*(googleusercontent\.com|ggpht\.com|ytimg\.com)\//i

export async function fetchArtwork(url: string): Promise<{ type: string; data: Uint8Array } | null> {
  if (typeof url !== 'string' || !ART_HOST.test(url)) return null
  try {
    const res = await net.fetch(url)
    if (!res.ok) return null
    return { type: res.headers.get('content-type') ?? 'image/jpeg', data: new Uint8Array(await res.arrayBuffer()) }
  } catch (err) {
    console.error('[artwork] fetch failed', url, err)
    return null
  }
}

const ART_HOSTS = ['https://*.googleusercontent.com/*', 'https://*.ggpht.com/*', 'https://*.ytimg.com/*']

export function allowArtworkCors(win: BrowserWindow): () => void {
  const ses = win.webContents.session
  ses.webRequest.onHeadersReceived({ urls: ART_HOSTS }, (details, done) => {
    const headers = { ...details.responseHeaders }
    for (const key of Object.keys(headers)) if (key.toLowerCase() === 'access-control-allow-origin') delete headers[key]
    headers['Access-Control-Allow-Origin'] = ['*']
    done({ responseHeaders: headers })
  })
  return () => ses.webRequest.onHeadersReceived(null)
}
