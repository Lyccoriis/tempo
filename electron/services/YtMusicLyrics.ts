import { combine, translateLines, type LyricsTranslation, type MachineTranslation } from './LyricsTranslate'
import { readCache, writeCache } from './MusicCache'
import { findCommontrack, musixmatchTranslation, type MusixmatchTranslation } from './MusixmatchTranslate'

const API = 'https://music.youtube.com/youtubei/v1'
const WEB = { client: { clientName: 'WEB_REMIX', clientVersion: '1.20250101.01.00', hl: 'en' } }
const ANDROID = { client: { clientName: 'ANDROID_MUSIC', clientVersion: '7.21.50', androidSdkVersion: 30, hl: 'en' } }
const ANDROID_AGENT = 'com.google.android.apps.youtube.music/7.21.50 (Linux; U; Android 11) gzip'

const MISSING_MS = 7 * 24 * 60 * 60 * 1000

const LYRICS_CACHE = 'lyrics2'
const TRANSLATIONS_CACHE = 'translations3'
const LEGACY_TRANSLATIONS_CACHE = 'translations2'
const TRANSLATION_PIPELINE = 1
const TRANSLATION_TARGET = 'en'
const RECHECK_MS = 7 * 24 * 60 * 60 * 1000

export interface MusicLyricWord {
  start: number
  end: number
  text: string
}

export interface MusicLyricLine {
  start: number
  end: number
  text: string
  words?: MusicLyricWord[]
}

export interface MusicLyrics {
  videoId: string
  lines: MusicLyricLine[]
  text: string
  source: string
  musixmatchId?: string
}

export interface LyricsHint {
  title: string
  artist: string
  duration: number
}

async function call(endpoint: string, context: object, body: object, agent?: string): Promise<unknown> {
  const res = await fetch(`${API}/${endpoint}?prettyPrint=false`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://music.youtube.com',
      ...(agent ? { 'User-Agent': agent } : {}),
    },
    body: JSON.stringify({ context, ...body }),
  })
  if (!res.ok) throw new Error(`YouTube Music replied ${res.status}`)
  return res.json()
}

function findAll(node: unknown, key: string, out: unknown[] = []): unknown[] {
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === key) out.push(v)
      findAll(v, key, out)
    }
  }
  return out
}

function runsText(value: unknown): string {
  const runs = (value as { runs?: Array<{ text?: string }> } | undefined)?.runs
  return runs ? runs.map(r => r.text ?? '').join('') : ''
}

interface Tab {
  unselectable?: boolean
  endpoint?: { browseEndpoint?: { browseId?: string; browseEndpointContextSupportedConfigs?: { browseEndpointContextMusicConfig?: { pageType?: string } } } }
}

interface QueueEntry {
  videoId?: string
  title?: unknown
  longBylineText?: unknown
  lengthText?: unknown
}

function seconds(clock: string): number {
  return clock.split(':').reduce((total, part) => total * 60 + Number(part), 0) || 0
}

async function lookUp(videoId: string): Promise<{ browseId: string; song: LyricsHint | null }> {
  const next = await call('next', WEB, { videoId })
  const tab = (findAll(next, 'tabRenderer') as Tab[]).find(
    t => t.endpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_TRACK_LYRICS',
  )
  const entry = (findAll(next, 'playlistPanelVideoRenderer') as QueueEntry[]).find(e => e.videoId === videoId)
  const title = runsText(entry?.title)
  return {
    browseId: tab && !tab.unselectable ? (tab.endpoint?.browseEndpoint?.browseId ?? '') : '',
    song: title
      ? { title, artist: runsText(entry?.longBylineText).split(' • ')[0], duration: seconds(runsText(entry?.lengthText)) }
      : null,
  }
}

interface TimedLine {
  lyricLine?: string
  cueRange?: { startTimeMilliseconds?: string; endTimeMilliseconds?: string }
}

async function fetchLyrics(videoId: string, browseId: string): Promise<MusicLyrics | null> {
  const [plain, timed] = await Promise.all([
    call('browse', WEB, { browseId }),
    call('browse', ANDROID, { browseId }, ANDROID_AGENT).catch(() => null),
  ])
  const shelf = findAll(plain, 'musicDescriptionShelfRenderer')[0] as { description?: unknown; footer?: unknown } | undefined
  const text = runsText(shelf?.description)
  const lines = ((findAll(timed, 'timedLyricsData')[0] ?? []) as TimedLine[])
    .map(l => ({
      start: Number(l.cueRange?.startTimeMilliseconds ?? NaN) / 1000,
      end: Number(l.cueRange?.endTimeMilliseconds ?? NaN) / 1000,
      text: l.lyricLine ?? '',
    }))
    .filter(l => Number.isFinite(l.start) && Number.isFinite(l.end))
  if (!text && !lines.length) return null
  const source = runsText(shelf?.footer).replace(/^Source:\s*/i, '')
  const found: MusicLyrics = { videoId, lines, text: text || lines.map(l => l.text).join('\n'), source }
  const mxm = /musixmatch/i.test(source) ? musixmatchId(timed) : ''
  return mxm ? { ...found, musixmatchId: mxm } : found
}

function musixmatchId(timed: unknown): string {
  const info = findAll(timed, 'serializedLyricInfo')[0]
  if (typeof info !== 'string') return ''
  const bytes = Buffer.from(info, 'base64')
  let at = 0
  const varint = () => {
    let value = 0
    for (let shift = 0; at < bytes.length; shift += 7) {
      const b = bytes[at++]
      value += (b & 0x7f) * 2 ** shift
      if (b < 0x80) break
    }
    return value
  }
  while (at < bytes.length) {
    const key = varint()
    if ((key & 7) === 0) varint()
    else if ((key & 7) === 2) {
      const size = varint()
      const value = bytes.subarray(at, at + size).toString('utf8')
      at += size
      if (key >> 3 === 4) return /^\d+$/.test(value) ? value : ''
    } else break
  }
  return ''
}

const LRCLIB = 'https://lrclib.net/api'
const DURATION_SLACK = 60
const WORD_TAG = /<\d+:\d+/
const NOISE = /\b(official|music|lyrics?|video|audio|mv|hd|4k|visualizer)\b/gi

interface LrclibTrack {
  trackName?: string
  artistName?: string
  duration?: number
  instrumental?: boolean
  plainLyrics?: string | null
  syncedLyrics?: string | null
}

function flat(s: string): string {
  return s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '')
}

function trackGuesses(title: string, artist: string): string[] {
  const clean = (s: string) => s.replace(NOISE, ' ').replace(/\s(feat|ft)\.?\s.*$/i, '').replace(/\s+/g, ' ').trim()
  const guesses = [...title.matchAll(/[「『【"“‘']([^」』】"”’']+)[」』】"”’']/g)].map(m => clean(m[1]))
  const bare = clean(title.replace(/[(\[【「『][^)\]】」』]*[)\]】」』]/g, ' '))
  const dash = bare.split(/\s[-–—|/_]\s/)
  if (dash.length > 1) guesses.push(dash.slice(1).join(' '), dash[0])
  guesses.push(artist ? bare.split(artist).join(' ').trim() : bare)
  for (const g of [...guesses]) {
    if (!/[a-z]/i.test(g) || !/[^\x00-\x7f]/.test(g)) continue
    guesses.push(g.replace(/[a-z][a-z\s'.]*/gi, ' ').trim(), g.replace(/[^\x00-\x7f]+/g, ' ').trim())
  }
  return [...new Set(guesses.map(g => g.replace(/\s+/g, ' ')).filter(g => g.length > 1))]
}

type LrclibAsked = Map<string, Promise<LrclibTrack[]>>

function lrclib(query: Record<string, string>, asked: LrclibAsked): Promise<LrclibTrack[]> {
  const url = `${LRCLIB}/search?${new URLSearchParams(query)}`
  let found = asked.get(url)
  if (!found) {
    found = fetch(url, { headers: { 'User-Agent': 'Tempo/0.1 (https://github.com/Kkkur/tempo)' } }).then(res =>
      res.ok ? (res.json() as Promise<LrclibTrack[]>) : [],
    )
    asked.set(url, found)
  }
  return found
}

function clock(m: string, s: string): number {
  return Number(m) * 60 + Number(s.replace(':', '.'))
}

function parseWords(body: string): { words: MusicLyricWord[]; stop: number } | null {
  const parts = body.split(/<(\d+):(\d+(?:[.:]\d+)?)>/)
  if (parts.length < 4) return null
  const words: MusicLyricWord[] = []
  let stop = NaN
  for (let i = 1; i < parts.length; i += 3) {
    const start = clock(parts[i], parts[i + 1])
    const text = parts[i + 2]
    if (text.trim()) words.push({ start, end: NaN, text: words.length ? text : text.trimStart() })
    else if (words.length) {
      words[words.length - 1].text += text
      stop = start
    }
  }
  return words.length ? { words, stop } : null
}

function parseLrc(lrc: string, duration: number): MusicLyricLine[] {
  const lines: Array<{ start: number; text: string; timed: ReturnType<typeof parseWords> }> = []
  for (const raw of lrc.split(/\r?\n/)) {
    const tags = /^((?:\[\d+:\d+(?:[.:]\d+)?\])+)(.*)$/.exec(raw.trim())
    if (!tags) continue
    const timed = parseWords(tags[2])
    const text = timed ? timed.words.map(w => w.text).join('').trim() : tags[2].trim()
    for (const [, m, s] of tags[1].matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)) {
      lines.push({ start: clock(m, s), text, timed })
    }
  }
  lines.sort((a, b) => a.start - b.start)
  return lines.map(({ timed, ...l }, i) => {
    const end = lines[i + 1]?.start ?? Math.max(duration, l.start + 5)
    if (!timed || Math.abs(timed.words[0].start - l.start) > 1) return { ...l, end }
    const last = Number.isFinite(timed.stop) ? timed.stop : end
    const words = timed.words.map((w, j) => ({ ...w, end: timed.words[j + 1]?.start ?? last }))
    return { ...l, end, words }
  })
}

function hasWords(lines: MusicLyricLine[]): boolean {
  return lines.some(l => l.words)
}

async function fetchFromLrclib(hint: LyricsHint, asked: LrclibAsked): Promise<Omit<MusicLyrics, 'videoId'> | null> {
  const artist = hint.artist.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim()
  const title = flat(hint.title)
  const where = flat(`${hint.title} ${hint.artist}`)
  const fits = (t: LrclibTrack) => {
    const name = flat((t.trackName ?? '').replace(/\([^)]*\)/g, '')) || flat(t.trackName ?? '')
    const artists = (t.artistName ?? '').split(/,|&|、|\/|\bfeat\.?|\bft\.?|\bx\b/i).map(flat)
    return (
      !t.instrumental &&
      !!(t.syncedLyrics || t.plainLyrics) &&
      !!name &&
      title.includes(name) &&
      artists.some(a => a.length > 1 && where.includes(a)) &&
      (!hint.duration || Math.abs((t.duration ?? 0) - hint.duration) <= DURATION_SLACK)
    )
  }
  for (const track of trackGuesses(hint.title, artist)) {
    const queries: Array<Record<string, string>> = artist ? [{ track_name: track, artist_name: artist }, { q: track }] : [{ q: track }]
    for (const query of queries) {
      const usable = (await lrclib(query, asked))
        .filter(fits)
        .sort((a, b) => Number(!a.syncedLyrics) - Number(!b.syncedLyrics) || Number(!WORD_TAG.test(a.syncedLyrics ?? '')) - Number(!WORD_TAG.test(b.syncedLyrics ?? '')) || Math.abs((a.duration ?? 0) - hint.duration) - Math.abs((b.duration ?? 0) - hint.duration))
      const best = usable[0]
      if (!best) continue
      const lines = best.syncedLyrics ? parseLrc(best.syncedLyrics, hint.duration) : []
      return { lines, text: best.plainLyrics || lines.map(l => l.text).join('\n'), source: 'LRCLIB' }
    }
  }
  return null
}

async function findLyrics(videoId: string, hint?: LyricsHint): Promise<MusicLyrics | null> {
  const { browseId, song } = await lookUp(videoId)
  const own = browseId ? await fetchLyrics(videoId, browseId) : null
  let best = own?.lines.length ? own : null
  const asked: LrclibAsked = new Map()
  for (const guess of [song, hint]) {
    if (!guess?.title) continue
    const other = await fetchFromLrclib(guess, asked).catch(() => null)
    if (!other) continue
    if (hasWords(other.lines)) return { videoId, ...other }
    if (!best && (!own || other.lines.length)) best = { videoId, ...other }
  }
  return best ?? own
}

function checkId(videoId: string): string {
  const id = String(videoId)
  if (!/^[\w-]{11}$/.test(id)) throw new Error(`Not a video id: ${id}`)
  return id
}

export async function lyrics(videoId: string, hint?: LyricsHint): Promise<MusicLyrics | null> {
  const id = checkId(videoId)
  const cached = readCache<MusicLyrics | null>(LYRICS_CACHE, id)
  if (cached && (cached.value || Date.now() - cached.at < MISSING_MS)) return cached.value
  const found = await findLyrics(id, hint)
  writeCache(LYRICS_CACHE, id, found)
  return found
}

export function cachedLyrics(videoId: string): MusicLyrics | null {
  return readCache<MusicLyrics | null>(LYRICS_CACHE, String(videoId))?.value ?? null
}

export function wordTimed(videoIds: string[]): string[] {
  return videoIds.filter(id => {
    const lines = readCache<MusicLyrics | null>(LYRICS_CACHE, String(id))?.value?.lines
    return !!lines && hasWords(lines)
  })
}

interface StoredTranslation {
  pipeline: number
  translation: LyricsTranslation
  machine: MachineTranslation
  commontrackId: string
  checkedAt: number
}

async function commontrackFor(videoId: string, found: MusicLyrics): Promise<string> {
  if (found.musixmatchId) return found.musixmatchId
  const { browseId, song } = await lookUp(videoId)
  if (browseId && /musixmatch/i.test(found.source)) {
    const id = musixmatchId(await call('browse', ANDROID, { browseId }, ANDROID_AGENT))
    if (id) return id
  }
  return song ? findCommontrack(song.title, song.artist) : ''
}

async function officialTranslation(
  videoId: string,
  found: MusicLyrics,
  knownId: string,
): Promise<{ official: MusixmatchTranslation | null; commontrackId: string; answered: boolean }> {
  let commontrackId = knownId
  try {
    commontrackId ||= await commontrackFor(videoId, found)
    const official = commontrackId ? await musixmatchTranslation(commontrackId, TRANSLATION_TARGET) : null
    return { official, commontrackId, answered: true }
  } catch (err) {
    console.error('[music] Musixmatch translation failed', err)
    return { official: null, commontrackId, answered: false }
  }
}

export async function translatedLyrics(videoId: string): Promise<LyricsTranslation | null> {
  const id = checkId(videoId)
  const found = readCache<MusicLyrics | null>(LYRICS_CACHE, id)?.value
  if (!found) return null
  const lines = found.lines.length ? found.lines.map(l => l.text) : found.text.split('\n')
  const stored = readCache<StoredTranslation>(TRANSLATIONS_CACHE, id)?.value
  const kept = stored?.pipeline === TRANSLATION_PIPELINE && stored.translation.target === TRANSLATION_TARGET ? stored : null
  if (kept && (kept.translation.source === 'musixmatch' || (kept.checkedAt && Date.now() - kept.checkedAt < RECHECK_MS))) {
    return kept.translation
  }
  const legacy = kept ? null : readCache<MachineTranslation>(LEGACY_TRANSLATIONS_CACHE, id)?.value
  const cachedMachine = kept?.machine ?? (legacy?.translated.length === lines.length ? legacy : null)
  let machineError: unknown
  const [machine, { official, commontrackId, answered }] = await Promise.all([
    cachedMachine ??
      translateLines(lines).catch(err => {
        machineError = err
        return null
      }),
    officialTranslation(id, found, kept?.commontrackId ?? ''),
  ])
  const result = combine(lines, machine ?? { lang: '', translated: [], romanized: [] }, official, TRANSLATION_TARGET)
  if (!machine) {
    if (result.source !== 'musixmatch') throw machineError
    return { ...result, machineLines: 0 }
  }
  writeCache<StoredTranslation>(TRANSLATIONS_CACHE, id, {
    pipeline: TRANSLATION_PIPELINE,
    translation: result,
    machine,
    commontrackId,
    checkedAt: answered ? Date.now() : 0,
  })
  return result
}
