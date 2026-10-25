import { readCache, writeCache } from './MusicCache'

const API = 'https://itunes.apple.com/search'
const NOISE = /\s*[([][^)\]]*\b(official|video|audio|lyrics?|visualizer|remaster(ed)?|live|mv|hd|4k)\b[^)\]]*[)\]]/gi
const FEAT = /\s*[([]?\b(feat\.?|ft\.?|with)\s.*$/i
const MISS_MS = 24 * 60 * 60 * 1000

interface ItunesResult {
  artistName?: string
  primaryGenreName?: string
}

function plain(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9぀-鿿가-힯]+/g, '')
}

async function search(term: string, entity: 'song' | 'musicArtist'): Promise<ItunesResult[]> {
  const res = await fetch(`${API}?${new URLSearchParams({ term, entity, limit: '10' })}`)
  if (!res.ok) return []
  return ((await res.json()) as { results?: ItunesResult[] }).results ?? []
}

export async function genre(title: string, artist: string): Promise<string | null> {
  const main = String(artist).split(/\s*(?:,|&|\bx\b|\bfeat\.?|\bft\.?)\s*/i)[0].trim()
  const name = String(title).replace(NOISE, '').replace(FEAT, '').trim()
  if (!name || !main) return null
  const key = `${plain(main)}|${plain(name)}`
  const cached = readCache<string | null>('genre', key)
  if (cached && (cached.value || Date.now() - cached.at < MISS_MS)) return cached.value

  const who = plain(main)
  const matches = (r: ItunesResult) => {
    const them = plain(r.artistName ?? '')
    return Boolean(them) && (them === who || them.startsWith(who) || who.startsWith(them))
  }
  let found: string | null = null
  try {
    const song = (await search(`${main} ${name}`, 'song')).find(r => matches(r) && r.primaryGenreName)
    found = song?.primaryGenreName ?? null
    if (!found) {
      const own = (await search(main, 'musicArtist')).find(r => plain(r.artistName ?? '') === who && r.primaryGenreName)
      found = own?.primaryGenreName ?? null
    }
  } catch (err) {
    console.error('[music] genre lookup failed', err)
    return null
  }
  writeCache('genre', key, found)
  return found
}
