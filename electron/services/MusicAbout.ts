import { readCache, writeCache } from './MusicCache'

export type AboutKind = 'song' | 'album' | 'artist'

export interface MusicAbout {
  title: string
  description: string
  text: string
  url: string
}

const API = 'https://en.wikipedia.org'
const HEADERS = { 'User-Agent': 'Tempo/0.1 (https://github.com/Lyccoriis/tempo) desktop music player' }
const NOISE = /\s*[([][^)\]]*\b(official|video|audio|lyrics?|visualizer|remaster(ed)?|live|mv|hd|4k|feat\.?|ft\.?)\b[^)\]]*[)\]]/gi
const FEAT = /\s*\b(feat\.?|ft\.?)\s.*$/i
const LABELS = /^(song|single|ep|album|playlist|video|artist|profile|\d[\d.,:]*\s*\w*)$/i
const MUSICIAN = /\b(singer|rapper|band|musician|songwriter|dj|producer|group|duo|composer|vocalist|artist)\b/i
const MISS_MS = 24 * 60 * 60 * 1000
const MAX_CHARS = 700

interface Page {
  title: string
  index?: number
  description?: string
  extract?: string
  fullurl?: string
  pageprops?: { disambiguation?: string }
}

let backoffUntil = 0

function plain(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9぀-鿿가-힯]+/g, '')
}

function artistsOf(artist: string): string[] {
  return String(artist)
    .split(/\s*(?:•|,|&|\bx\b|\by\b|\bcon\b|\bfeat\.?|\bft\.?)\s*/i)
    .map(s => s.trim())
    .filter(s => s.length > 1 && !LABELS.test(s))
}

async function search(term: string): Promise<Page[]> {
  if (Date.now() < backoffUntil) throw new Error('Wikipedia asked to wait')
  const query = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: term,
    gsrlimit: '3',
    prop: 'extracts|description|info|pageprops',
    exintro: '1',
    explaintext: '1',
    exlimit: '3',
    inprop: 'url',
    ppprop: 'disambiguation',
    redirects: '1',
  })
  const res = await fetch(`${API}/w/api.php?${query}`, { headers: HEADERS })
  if (res.status === 429) backoffUntil = Date.now() + (Number(res.headers.get('retry-after')) || 60) * 1000
  if (!res.ok) throw new Error(`Wikipedia search replied ${res.status}`)
  const body = (await res.json()) as { query?: { pages?: Page[] } }
  return (body.query?.pages ?? []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
}

function fits(page: Page, kind: AboutKind, name: string, artists: string[]): boolean {
  if (page.pageprops?.disambiguation !== undefined || !page.extract) return false
  const body = plain(`${page.description ?? ''} ${page.extract}`)
  const titled = plain(page.title.replace(/\s*\([^)]*\)\s*$/, '')) === plain(name)
  if (kind === 'artist') return titled && MUSICIAN.test(`${page.description ?? ''} ${page.extract}`)
  if (plain(name).length < 4 && !plain(page.title).includes(plain(name))) return false
  return body.includes(plain(name)) && (!artists.length || artists.some(a => body.includes(plain(a))))
}

function trim(text: string): string {
  if (text.length <= MAX_CHARS) return text
  const cut = text.slice(0, MAX_CHARS)
  const end = cut.lastIndexOf('. ')
  return end > MAX_CHARS / 2 ? cut.slice(0, end + 1) : `${cut.trimEnd()}...`
}

async function lookup(kind: AboutKind, name: string, artists: string[]): Promise<MusicAbout | null> {
  const term = kind === 'artist' ? name : `"${name}" ${artists[0] ?? ''} ${kind}`
  const page = (await search(term)).find(p => fits(p, kind, name, artists))
  if (!page) return null
  return {
    title: page.title,
    description: page.description ?? '',
    text: trim(page.extract ?? ''),
    url: page.fullurl ?? '',
  }
}

export async function about(kind: AboutKind, title: string, artist: string): Promise<MusicAbout | null> {
  const name = String(title).replace(NOISE, '').replace(FEAT, '').trim()
  const artists = kind === 'artist' ? [] : artistsOf(artist)
  if (!name) return null
  const key = `v2|${kind}|${plain(name)}|${artists.map(plain).join(',')}`
  const cached = readCache<MusicAbout | null>('about', key)
  if (cached && (cached.value || Date.now() - cached.at < MISS_MS)) return cached.value

  let found: MusicAbout | null = null
  try {
    found = await lookup(kind, name, artists)
    if (!found && kind === 'song' && artists[0]) found = await about('artist', artists[0], '')
  } catch (err) {
    console.error('[music] about lookup failed', err)
    return null
  }
  writeCache('about', key, found)
  return found
}
