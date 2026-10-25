import type Database from 'better-sqlite3'

import { readCache, writeCache } from './MusicCache'
import { activeDb, activeProfileId, notify, onBeforeClose, write } from './MusicDatabase'
import { ARTIST_TEXT, BEST_SOURCE, PROVIDER } from './MusicRepository'
import { ytMusicService } from './YtMusicService'
import type { MusicTrack } from './YtMusicCatalog'
import { isGenre, moodOf, normTag } from './musicMoods'
import type {
  DiscoverAxes,
  DiscoverAxis,
  DiscoverProgress,
  DiscoverQuery,
  DiscoverRow,
  DiscoverTag,
  DiscoverTaste,
  DiscoverTrack,
} from './musicRepoTypes'

type Db = Database.Database

const UA = 'Tempo/0.1 ( https://github.com/Kkkur/tempo )'
const DAY = 24 * 60 * 60 * 1000
const RETRY_MS = 14 * DAY
const MB_PROVIDER = 'musicbrainz'
const DZ_PROVIDER = 'deezer'
const AXES: DiscoverAxis[] = ['bright', 'energy', 'electronic', 'popular']

const NOISE = /\s*[([][^)\]]*\b(official|video|audio|lyrics?|visualizer|remaster(ed)?|live|mv|hd|4k)\b[^)\]]*[)\]]/gi
const FEAT = /\s*[([]?\b(feat\.?|ft\.?)\s.*$/i

function plain(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9぀-鿿가-힯]+/g, '')
}

function leadArtist(artist: string): string {
  return String(artist).split(/\s*(?:,|&|\s(?:x|y|×)\s|\bfeat\.?|\bft\.?)\s*/i)[0].trim()
}

function cleanTitle(title: string): string {
  return String(title).replace(NOISE, '').replace(FEAT, '').trim()
}

function titleArtist(title: string): { artist: string; title: string } | null {
  const clean = cleanTitle(title).replace(/\s+lyrics?$/i, '')
  const m = clean.match(/^(.+?)\s+[-–—~]\s+(.+)$/) ?? clean.match(/^(.+?)\s*「(.+?)」/)
  if (!m) return null
  const artist = m[1].trim()
  const song = cleanTitle(m[2]).replace(/\s+lyrics?$/i, '').trim()
  return artist && song ? { artist, title: song } : null
}

function sameName(a: string, b: string): boolean {
  const x = plain(a)
  const y = plain(b)
  if (!x || !y) return false
  return x === y || (Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x)))
}

function clamp(n: number): number {
  return Math.max(-1, Math.min(1, n))
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function pacer(gapMs: number): () => Promise<void> {
  let next = 0
  return async () => {
    const now = Date.now()
    const at = Math.max(now, next)
    next = at + gapMs
    if (at > now) await sleep(at - now)
  }
}

const mbTurn = pacer(1100)
const dzTurn = pacer(150)

async function getJson<T>(url: string, turn: () => Promise<void>, retry = true): Promise<T | null> {
  await turn()
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) })
    if ((res.status === 503 || res.status === 429) && retry) {
      await sleep(4000)
      return getJson(url, turn, false)
    }
    if (!res.ok) return null
    return (await res.json()) as T
  } catch (err) {
    console.error('[discover] request failed', url, err instanceof Error ? err.message : err)
    return null
  }
}

interface DzArtist {
  id: number
  name: string
}

interface DzTrack {
  id: number
  title: string
  title_short?: string
  duration: number
  rank: number
  artist: DzArtist
  album?: { id: number; title: string; cover_medium?: string }
}

interface DzTrackFull extends DzTrack {
  bpm?: number
  gain?: number
}

async function deezer<T>(path: string, ttlMs: number): Promise<T | null> {
  const cached = readCache<T>('deezer', path)
  if (cached && Date.now() - cached.at < ttlMs) return cached.value
  let body = await getJson<T & { error?: { code?: number } }>(`https://api.deezer.com${path}`, dzTurn)
  if (body?.error?.code === 4) {
    await sleep(5000)
    body = await getJson(`https://api.deezer.com${path}`, dzTurn, false)
  }
  if (!body || body.error) return null
  writeCache('deezer', path, body)
  return body
}

interface ArtistFacts {
  status: 'hit' | 'miss'
  mbid: string
  tags: Array<{ tag: string; weight: number }>
}

async function artistFacts(name: string): Promise<ArtistFacts | null> {
  const who = leadArtist(name)
  const key = plain(who)
  if (!key) return { status: 'miss', mbid: '', tags: [] }
  const cached = readCache<ArtistFacts>('musicbrainz', key)
  if (cached && (cached.value.status === 'hit' || Date.now() - cached.at < RETRY_MS)) return cached.value

  const query = encodeURIComponent(`artist:"${who.replace(/"/g, '')}"`)
  const found = await getJson<{ artists?: Array<{ id: string; name: string; score: number; aliases?: Array<{ name: string }> }> }>(
    `https://musicbrainz.org/ws/2/artist/?query=${query}&limit=5&fmt=json`,
    mbTurn,
  )
  if (!found) return null
  const list = found.artists ?? []
  const pick =
    list.find(a => plain(a.name) === key || (a.aliases ?? []).some(al => plain(al.name) === key)) ??
    (list[0] && list[0].score >= 98 ? list[0] : undefined)
  let facts: ArtistFacts = { status: 'miss', mbid: '', tags: [] }
  if (pick) {
    const full = await getJson<{ genres?: Array<{ name: string; count: number }>; tags?: Array<{ name: string; count: number }> }>(
      `https://musicbrainz.org/ws/2/artist/${pick.id}?inc=genres+tags&fmt=json`,
      mbTurn,
    )
    if (!full) return null
    let named = (full.genres ?? []).filter(g => g.count > 0)
    if (!named.length) named = (full.tags ?? []).filter(t => t.count > 0 && isGenre(t.name))
    named = named.sort((a, b) => b.count - a.count).slice(0, 8)
    const top = named[0]?.count ?? 1
    facts = { status: named.length ? 'hit' : 'miss', mbid: pick.id, tags: named.map(g => ({ tag: normTag(g.name), weight: g.count / top })) }
  }
  writeCache('musicbrainz', key, facts)
  return facts
}

interface TrackFacts {
  status: 'hit' | 'miss'
  deezerId: number
  artist: DzArtist | null
  bpm: number
  gain: number | null
  rank: number | null
  genres: string[]
}

const MISS: TrackFacts = { status: 'miss', deezerId: 0, artist: null, bpm: 0, gain: null, rank: null, genres: [] }

async function trackFacts(title: string, artist: string): Promise<TrackFacts | null> {
  const who = leadArtist(artist)
  const name = cleanTitle(title)
  if (!who || !name) return MISS
  const search = await deezer<{ data?: DzTrack[] }>(`/search?q=${encodeURIComponent(`${who} ${name}`)}&limit=10`, 30 * DAY)
  if (!search) return null
  const hit = (search.data ?? []).find(d => sameName(d.artist.name, who) && sameName(d.title_short || d.title, name))
  if (!hit) return MISS
  const full = await deezer<DzTrackFull>(`/track/${hit.id}`, 30 * DAY)
  const album = full?.album?.id ? await deezer<{ genres?: { data?: Array<{ name: string }> } }>(`/album/${full.album.id}`, 90 * DAY) : null
  return {
    status: 'hit',
    deezerId: hit.id,
    artist: hit.artist,
    bpm: full?.bpm ?? 0,
    gain: full?.gain ?? null,
    rank: full?.rank ?? hit.rank ?? null,
    genres: (album?.genres?.data ?? []).map(g => normTag(g.name)),
  }
}

function fetched(db: Db, type: string, id: number, provider: string, status: string, confidence: number | null): void {
  db.prepare(
    `INSERT INTO metadata_fetches (entity_type, entity_id, provider, status, match_confidence, fetched_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (entity_type, entity_id, provider) DO UPDATE SET status = excluded.status, match_confidence = excluded.match_confidence, fetched_at = excluded.fetched_at`,
  ).run(type, id, provider, status, confidence, Date.now())
}

function outsideId(db: Db, type: string, id: number, provider: string, externalId: string): void {
  const now = Date.now()
  db.prepare(
    'INSERT OR IGNORE INTO external_ids (entity_type, entity_id, provider, external_id, confidence, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)',
  ).run(type, id, provider, externalId, now, now)
}

function saveArtist(db: Db, artistId: number, facts: ArtistFacts): void {
  const now = Date.now()
  db.prepare('DELETE FROM artist_tags WHERE artist_id = ? AND provider = ?').run(artistId, MB_PROVIDER)
  const put = db.prepare('INSERT OR IGNORE INTO artist_tags (artist_id, tag, weight, provider, fetched_at) VALUES (?, ?, ?, ?, ?)')
  for (const t of facts.tags) put.run(artistId, t.tag, t.weight, MB_PROVIDER, now)
  if (facts.mbid) outsideId(db, 'artist', artistId, MB_PROVIDER, facts.mbid)
  fetched(db, 'artist', artistId, MB_PROVIDER, facts.status, null)
}

function saveTitleArtist(db: Db, trackId: number, facts: ArtistFacts | null): void {
  const now = Date.now()
  if (facts) {
    db.prepare('DELETE FROM track_genres WHERE track_id = ? AND provider = ?').run(trackId, MB_PROVIDER)
    const put = db.prepare("INSERT OR IGNORE INTO track_genres (track_id, genre, kind, weight, provider, fetched_at) VALUES (?, ?, 'genre', ?, ?, ?)")
    for (const t of facts.tags) put.run(trackId, t.tag, t.weight, MB_PROVIDER, now)
  }
  fetched(db, 'track', trackId, MB_PROVIDER, facts ? facts.status : 'skip', null)
}

function saveTrack(db: Db, trackId: number, facts: TrackFacts, fromTitle: boolean): void {
  const now = Date.now()
  if (facts.status === 'hit') {
    const put = db.prepare(
      `INSERT INTO track_features (track_id, feature, value_num, provider, fetched_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (track_id, feature, provider) DO UPDATE SET value_num = excluded.value_num, updated_at = excluded.updated_at`,
    )
    if (facts.bpm > 0) put.run(trackId, 'bpm', facts.bpm, DZ_PROVIDER, now, now)
    if (facts.gain != null) put.run(trackId, 'gain', facts.gain, DZ_PROVIDER, now, now)
    if (facts.rank != null) put.run(trackId, 'rank', facts.rank, DZ_PROVIDER, now, now)
    const genre = db.prepare("INSERT OR IGNORE INTO track_genres (track_id, genre, kind, weight, provider, fetched_at) VALUES (?, ?, 'genre', NULL, ?, ?)")
    for (const g of facts.genres) genre.run(trackId, g, DZ_PROVIDER, now)
    outsideId(db, 'track', trackId, DZ_PROVIDER, String(facts.deezerId))
    const lead = db.prepare('SELECT artist_id FROM track_artists WHERE track_id = ? ORDER BY position LIMIT 1').get(trackId) as { artist_id: number } | undefined
    if (lead && facts.artist && !fromTitle) outsideId(db, 'artist', lead.artist_id, DZ_PROVIDER, String(facts.artist.id))
  }
  fetched(db, 'track', trackId, DZ_PROVIDER, facts.status, fromTitle ? 0 : null)
}

let progress: DiscoverProgress = { running: false, done: 0, total: 0, phase: '' }
let generation = 0

function report(next: DiscoverProgress): void {
  progress = next
  notify('musicDiscover:progress', next)
}

interface PendingTrack {
  id: number
  title: string
  artist: string
  leadId: number | null
  dzStatus: string | null
  dzConfidence: number | null
  dzAt: number | null
  mbStatus: string | null
  mbAt: number | null
}

function pending(db: Db): { artists: Array<{ id: number; name: string }>; tracks: PendingTrack[] } {
  const retry = Date.now() - RETRY_MS
  const artists = db
    .prepare(
      `SELECT a.id, a.name FROM artists a
       JOIN track_artists ta ON ta.artist_id = a.id
       JOIN track_stats st ON st.track_id = ta.track_id AND st.play_count > 0
       WHERE NOT EXISTS (SELECT 1 FROM metadata_fetches f WHERE f.entity_type = 'artist' AND f.entity_id = a.id AND f.provider = @mb AND (f.status = 'hit' OR f.fetched_at > @retry))
       GROUP BY a.id ORDER BY sum(st.total_listened_ms) DESC`,
    )
    .all({ mb: MB_PROVIDER, retry }) as Array<{ id: number; name: string }>
  const rows = db
    .prepare(
      `SELECT t.id, t.title, ${ARTIST_TEXT} AS artist,
         (SELECT artist_id FROM track_artists WHERE track_id = t.id ORDER BY position LIMIT 1) AS lead_id,
         dz.status AS dz_status, dz.match_confidence AS dz_confidence, dz.fetched_at AS dz_at,
         mb.status AS mb_status, mb.fetched_at AS mb_at
       FROM tracks t
       JOIN track_stats st ON st.track_id = t.id AND st.play_count > 0
       LEFT JOIN metadata_fetches dz ON dz.entity_type = 'track' AND dz.entity_id = t.id AND dz.provider = @dz
       LEFT JOIN metadata_fetches mb ON mb.entity_type = 'track' AND mb.entity_id = t.id AND mb.provider = @mb
       ORDER BY st.total_listened_ms DESC`,
    )
    .all({ dz: DZ_PROVIDER, mb: MB_PROVIDER }) as Array<Record<string, unknown>>
  const tracks: PendingTrack[] = rows.map(r => ({
    id: r.id as number,
    title: r.title as string,
    artist: (r.artist as string) ?? '',
    leadId: (r.lead_id as number) ?? null,
    dzStatus: (r.dz_status as string) ?? null,
    dzConfidence: (r.dz_confidence as number) ?? null,
    dzAt: (r.dz_at as number) ?? null,
    mbStatus: (r.mb_status as string) ?? null,
    mbAt: (r.mb_at as number) ?? null,
  }))
  const named = (t: PendingTrack) => titleArtist(t.title) != null
  const dzDue = (t: PendingTrack) =>
    !t.dzStatus || (t.dzStatus !== 'hit' && ((t.dzAt ?? 0) < retry || (t.dzConfidence == null && named(t))))
  const mbDue = (t: PendingTrack) => named(t) && (!t.mbStatus || (t.mbStatus === 'miss' && (t.mbAt ?? 0) < retry))
  return { artists, tracks: tracks.filter(t => dzDue(t) || mbDue(t)).map(t => ({ ...t, dzDue: dzDue(t), mbDue: mbDue(t) })) }
}

function hasGenres(db: Db, artistId: number | null): boolean {
  return artistId != null && !!db.prepare('SELECT 1 FROM artist_tags WHERE artist_id = ? LIMIT 1').get(artistId)
}

export function discoverProgress(): DiscoverProgress {
  return progress
}

export function enrich(): void {
  if (progress.running) return
  const db = activeDb()
  if (!db) return
  const work = pending(db)
  const total = work.artists.length + work.tracks.length
  if (!total) return
  const gen = ++generation
  const profile = activeProfileId()
  const alive = () => gen === generation && activeProfileId() === profile && activeDb() != null
  void (async () => {
    let done = 0
    report({ running: true, done, total, phase: 'artists' })
    try {
      for (const a of work.artists) {
        const facts = await artistFacts(a.name)
        if (!alive()) return
        if (facts) write('artist genres', d => saveArtist(d, a.id, facts))
        report({ running: true, done: ++done, total, phase: 'artists' })
      }
      for (const t of work.tracks as Array<PendingTrack & { dzDue: boolean; mbDue: boolean }>) {
        const named = hasGenres(activeDb()!, t.leadId) ? null : titleArtist(t.title)
        if (t.mbDue) {
          const facts = named ? await artistFacts(named.artist) : null
          if (!alive()) return
          if (!named || facts) write('title artist genres', d => saveTitleArtist(d, t.id, facts))
        }
        const recentMiss = !!t.dzStatus && (t.dzAt ?? 0) >= Date.now() - RETRY_MS
        if (t.dzDue && recentMiss && !named) {
          write('track facts', d => fetched(d, 'track', t.id, DZ_PROVIDER, t.dzStatus!, 0))
        } else if (t.dzDue) {
          const facts = await trackFacts(named?.title ?? t.title, named?.artist ?? t.artist)
          if (!alive()) return
          if (facts) write('track facts', d => saveTrack(d, t.id, facts, !!named))
        }
        report({ running: true, done: ++done, total, phase: 'songs' })
      }
    } catch (err) {
      console.error('[discover] lookups failed', err)
    } finally {
      if (gen === generation) report({ running: false, done, total, phase: '' })
    }
  })()
}

export function stopDiscover(): void {
  generation++
  progress = { running: false, done: 0, total: 0, phase: '' }
}

onBeforeClose(() => stopDiscover())

interface Known {
  id: number
  title: string
  artist: string
  byTitle: boolean
  album: string
  artwork: string
  videoId: string
  durationMs: number | null
  plays: number
  listenedMs: number
  completion: number | null
  skips: number
  firstHeardAt: number | null
  lastHeardAt: number | null
  artistIds: number[]
  tags: Map<string, number>
  axes: DiscoverAxes
}

function combine(parts: Array<[number | null | undefined, number]>): number | null {
  let sum = 0
  let weight = 0
  for (const [value, w] of parts) {
    if (value == null || !Number.isFinite(value)) continue
    sum += value * w
    weight += w
  }
  return weight ? clamp(sum / weight) : null
}

function ranker(values: number[]): (v: number | undefined) => number | null {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length < 5) return () => null
  return v => {
    if (v == null) return null
    let lo = 0
    let hi = sorted.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (sorted[mid] < v) lo = mid + 1
      else hi = mid
    }
    return (lo / (sorted.length - 1)) * 2 - 1
  }
}

const TRACK_COLS = `t.id, t.title, t.duration_ms, al.title AS album, ${ARTIST_TEXT} AS artist, s.provider_id, s.artwork_url,
  coalesce(st.play_count, 0) AS plays, coalesce(st.total_listened_ms, 0) AS listened, st.avg_completion, coalesce(st.skip_count, 0) AS skips,
  st.first_heard_at, st.last_heard_at`
const TRACK_FROM = `FROM tracks t LEFT JOIN albums al ON al.id = t.album_id
  JOIN track_sources s ON s.id = ${BEST_SOURCE} AND s.provider = '${PROVIDER}'
  LEFT JOIN track_stats st ON st.track_id = t.id`

function loadLibrary(db: Db): Known[] {
  const heard = db.prepare(`SELECT ${TRACK_COLS} ${TRACK_FROM} WHERE st.play_count > 0`).all() as Array<Record<string, unknown>>
  const unheard = db
    .prepare(
      `SELECT ${TRACK_COLS} ${TRACK_FROM}
       WHERE coalesce(st.play_count, 0) = 0 AND EXISTS (
         SELECT 1 FROM track_artists ta JOIN track_artists ha ON ha.artist_id = ta.artist_id JOIN track_stats hs ON hs.track_id = ha.track_id AND hs.play_count > 0
         WHERE ta.track_id = t.id)
       ORDER BY t.known_at DESC LIMIT 1500`,
    )
    .all() as Array<Record<string, unknown>>
  const rows = [...heard, ...unheard]
  if (!rows.length) return []

  const artistsOf = new Map<number, number[]>()
  for (const r of db.prepare('SELECT track_id, artist_id FROM track_artists ORDER BY position').all() as Array<{ track_id: number; artist_id: number }>) {
    const list = artistsOf.get(r.track_id)
    if (list) list.push(r.artist_id)
    else artistsOf.set(r.track_id, [r.artist_id])
  }
  const artistTags = new Map<number, Array<[string, number]>>()
  for (const r of db.prepare('SELECT artist_id, tag, weight FROM artist_tags').all() as Array<{ artist_id: number; tag: string; weight: number }>) {
    const list = artistTags.get(r.artist_id) ?? []
    list.push([r.tag, r.weight])
    artistTags.set(r.artist_id, list)
  }
  const trackGenres = new Map<number, Array<[string, number, string]>>()
  for (const r of db.prepare('SELECT track_id, genre, weight, provider FROM track_genres').all() as Array<{
    track_id: number
    genre: string
    weight: number | null
    provider: string
  }>) {
    const list = trackGenres.get(r.track_id) ?? []
    list.push([normTag(r.genre), r.weight ?? 0.7, r.provider])
    trackGenres.set(r.track_id, list)
  }
  const features = new Map<number, Record<string, number>>()
  for (const r of db.prepare('SELECT track_id, feature, value_num, provider FROM track_features WHERE value_num IS NOT NULL').all() as Array<{
    track_id: number
    feature: string
    value_num: number
    provider: string
  }>) {
    const f = features.get(r.track_id) ?? {}
    f[`${r.provider}:${r.feature}`] = r.value_num
    features.set(r.track_id, f)
  }
  const measured = [...features.values()].filter(f => f['audio:samples'])
  const brightRank = ranker(measured.map(f => f['audio:brightness']))
  const punchRank = ranker(measured.map(f => f['audio:punch']))

  return rows.map(r => {
    const id = r.id as number
    const artistIds = artistsOf.get(id) ?? []
    const tags = new Map<string, number>()
    artistIds.forEach((a, i) => {
      for (const [tag, w] of artistTags.get(a) ?? []) tags.set(tag, Math.max(tags.get(tag) ?? 0, w * (i ? 0.6 : 1)))
    })
    for (const [g, w] of trackGenres.get(id) ?? []) tags.set(g, Math.max(tags.get(g) ?? 0, w))
    const named = artistIds[0] != null && !artistTags.has(artistIds[0]) && (trackGenres.get(id) ?? []).some(g => g[2] === MB_PROVIDER)
      ? titleArtist(r.title as string)
      : null

    let wSum = 0
    const mood = [0, 0, 0]
    for (const [tag, w] of tags) {
      const m = moodOf(tag)
      if (!m) continue
      mood[0] += m[0] * w
      mood[1] += m[1] * w
      mood[2] += m[2] * w
      wSum += w
    }
    const tagMood = wSum ? mood.map(v => v / wSum) : null
    const f = features.get(id) ?? {}
    const bpm = f['audio:bpm'] ?? f['deezer:bpm']
    const rank = f['deezer:rank']
    const axes: DiscoverAxes = {
      bright: combine([
        [brightRank(f['audio:brightness']), 0.6],
        [tagMood?.[0], 0.4],
      ]),
      energy: combine([
        [bpm ? clamp((bpm - 110) / 50) : null, 0.35],
        [punchRank(f['audio:punch']), 0.3],
        [tagMood?.[1], 0.35],
      ]),
      electronic: tagMood ? clamp(tagMood[2]) : null,
      popular: rank && rank > 0 ? clamp((Math.log10(rank) - 4.8) / 1.2) : null,
    }
    return {
      id,
      title: r.title as string,
      artist: named?.artist ?? (r.artist as string) ?? '',
      byTitle: !!named,
      album: (r.album as string) ?? '',
      artwork: (r.artwork_url as string) ?? '',
      videoId: (r.provider_id as string) ?? '',
      durationMs: (r.duration_ms as number) ?? null,
      plays: r.plays as number,
      listenedMs: r.listened as number,
      completion: (r.avg_completion as number) ?? null,
      skips: r.skips as number,
      firstHeardAt: (r.first_heard_at as number) ?? null,
      lastHeardAt: (r.last_heard_at as number) ?? null,
      artistIds,
      tags,
      axes,
    }
  })
}

function topTags(k: Known, n = 3): string[] {
  return [...k.tags]
    .filter(([tag]) => isGenre(tag))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([tag]) => tag)
}

function toTrack(k: Known, reason: string): DiscoverTrack {
  return {
    key: k.videoId,
    trackId: k.id,
    videoId: k.videoId,
    title: k.title,
    artist: k.artist,
    album: k.album,
    artwork: k.artwork,
    durationMs: k.durationMs,
    heard: k.plays > 0,
    plays: k.plays,
    lastHeardAt: k.lastHeardAt,
    tags: topTags(k),
    reason,
    axes: k.axes,
  }
}

function countOf(db: Db, sql: string): number {
  return (db.prepare(sql).get() as { n: number }).n
}

export function discoverTaste(): DiscoverTaste | null {
  const db = activeDb()
  if (!db) return null
  const heard = loadLibrary(db).filter(k => k.plays > 0)
  const totals = new Map<string, { w: number; tracks: number }>()
  let all = 0
  const center: Record<DiscoverAxis, [number, number]> = { bright: [0, 0], energy: [0, 0], electronic: [0, 0], popular: [0, 0] }
  for (const k of heard) {
    const w = Math.max(k.listenedMs, 30000)
    all += w
    const genres = [...k.tags].filter(([tag]) => isGenre(tag))
    const sum = genres.reduce((s, [, v]) => s + v, 0)
    for (const [tag, v] of genres) {
      const t = totals.get(tag) ?? { w: 0, tracks: 0 }
      t.w += (w * v) / sum
      t.tracks++
      totals.set(tag, t)
    }
    for (const axis of AXES) {
      const v = k.axes[axis]
      if (v == null) continue
      center[axis][0] += v * w
      center[axis][1] += w
    }
  }
  const tags: DiscoverTag[] = [...totals]
    .map(([tag, t]) => ({ tag, share: all ? t.w / all : 0, tracks: t.tracks }))
    .filter(t => t.share >= 0.004)
    .sort((a, b) => b.share - a.share)
    .slice(0, 36)
  return {
    tags,
    center: Object.fromEntries(AXES.map(a => [a, center[a][1] ? center[a][0] / center[a][1] : null])) as DiscoverAxes,
    heard: heard.length,
    artists: countOf(db, 'SELECT count(DISTINCT ta.artist_id) AS n FROM track_artists ta JOIN track_stats st ON st.track_id = ta.track_id AND st.play_count > 0'),
    artistsTagged: countOf(db, 'SELECT count(DISTINCT artist_id) AS n FROM artist_tags'),
    tracksLookedUp: countOf(db, `SELECT count(*) AS n FROM metadata_fetches WHERE entity_type = 'track' AND provider = '${DZ_PROVIDER}' AND status = 'hit'`),
    tracksMeasured: countOf(db, "SELECT count(*) AS n FROM track_features WHERE provider = 'audio' AND feature = 'samples'"),
    progress,
  }
}

function random(seed: number, key: string): number {
  let h = seed | 0
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 2654435761)
  h = Math.imul(h ^ (h >>> 15), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function fit(axes: DiscoverAxes, want: DiscoverQuery['axes']): number {
  const keys = AXES.filter(a => typeof want[a] === 'number')
  if (!keys.length) return 0.5
  let s = 0
  for (const a of keys) {
    const v = axes[a]
    s += v == null ? 0.35 : 1 - Math.abs(v - (want[a] as number)) / 2
  }
  return s / keys.length
}

function matchesTags(k: Known, tags: string[]): boolean {
  return !tags.length || tags.some(t => k.tags.has(t))
}

function spread<T extends { artist: string; score: number }>(items: T[], n: number): T[] {
  const per = new Map<string, number>()
  const out: T[] = []
  for (const item of [...items].sort((a, b) => b.score - a.score)) {
    const who = plain(leadArtist(item.artist))
    const seen = per.get(who) ?? 0
    if (seen >= 2) continue
    per.set(who, seen + 1)
    out.push(item)
    if (out.length >= n) break
  }
  return out
}

function daysAgo(at: number | null): number {
  return at ? (Date.now() - at) / DAY : 0
}

function heardReason(k: Known, tags: string[]): string {
  const days = Math.floor(daysAgo(k.lastHeardAt))
  const tag = tags.find(t => k.tags.has(t))
  if (days >= 14) return `Not played in ${days} days`
  if (tag) return `From your ${tag}`
  return k.plays === 1 ? 'Heard once' : `Heard ${k.plays} times`
}

function counts(q: DiscoverQuery): { lib: number; fresh: number } {
  const limit = Math.max(6, Math.min(60, Math.floor(q.limit ?? 30)))
  const fresh = Math.round(limit * Math.max(0, Math.min(1, q.fresh)))
  return { lib: limit - fresh, fresh }
}

function scoreHeard(pool: Known[], q: DiscoverQuery): Array<Known & { score: number }> {
  const maxPlays = Math.max(1, ...pool.map(k => k.plays))
  return pool.map(k => {
    const affinity =
      (0.5 * Math.log1p(k.plays)) / Math.log1p(maxPlays) + 0.3 * (k.completion ?? 0.5) - 0.4 * Math.min(1, k.skips / Math.max(1, k.plays))
    const rediscover = Math.min(1, daysAgo(k.lastHeardAt) / 30) * 0.4
    return { ...k, score: fit(k.axes, q.axes) * 2 + affinity + rediscover + random(q.seed, k.videoId) * 0.6 }
  })
}

export function discoverLibrary(q: DiscoverQuery): DiscoverTrack[] {
  const db = activeDb()
  if (!db) return []
  const tags = (q.tags ?? []).map(normTag)
  const pool = loadLibrary(db).filter(k => k.plays > 0 && matchesTags(k, tags))
  return spread(scoreHeard(pool, { ...q, tags }), counts(q).lib).map(k => toTrack(k, heardReason(k, tags)))
}

async function deezerArtistId(db: Db, artistId: number | string, name: string): Promise<number | null> {
  const row = typeof artistId === 'string' ? undefined : db.prepare("SELECT external_id FROM external_ids WHERE entity_type = 'artist' AND entity_id = ? AND provider = ?").get(artistId, DZ_PROVIDER) as
    | { external_id: string }
    | undefined
  if (row) return Number(row.external_id)
  const who = leadArtist(name)
  const found = await deezer<{ data?: DzArtist[] }>(`/search/artist?q=${encodeURIComponent(who)}&limit=5`, 30 * DAY)
  return found?.data?.find(a => plain(a.name) === plain(who))?.id ?? null
}

interface Candidate {
  track: DzTrack
  seed: string
  own: boolean
  strength: number
  axes: DiscoverAxes
}

export async function discoverFresh(q: DiscoverQuery): Promise<DiscoverTrack[]> {
  const db = activeDb()
  if (!db) return []
  const want = counts(q).fresh
  if (!want) return []
  const tags = (q.tags ?? []).map(normTag)
  const lib = loadLibrary(db)
  const heard = scoreHeard(
    lib.filter(k => k.plays > 0 && matchesTags(k, tags)),
    { ...q, tags },
  )
  const known = new Set(lib.map(k => `${plain(leadArtist(k.artist))}|${plain(cleanTitle(k.title))}`))

  const artists = new Map<number | string, { name: string; score: number; axes: Array<DiscoverAxes> }>()
  for (const k of heard) {
    const lead = k.byTitle ? plain(leadArtist(k.artist)) : k.artistIds[0]
    if (lead == null || lead === '') continue
    const a = artists.get(lead) ?? { name: leadArtist(k.artist), score: 0, axes: [] }
    a.score += Math.max(0, k.score)
    a.axes.push(k.axes)
    artists.set(lead, a)
  }
  const avg = (list: DiscoverAxes[]): DiscoverAxes =>
    Object.fromEntries(
      AXES.map(axis => {
        const vals = list.map(x => x[axis]).filter((v): v is number => v != null)
        return [axis, vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null]
      }),
    ) as DiscoverAxes
  const seeds = [...artists]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 5)
  const top = seeds[0]?.[1].score || 1

  const out: Array<DiscoverTrack & { score: number }> = []
  const heardArtists = new Set(artists.keys())
  for (const k of lib) {
    if (k.plays > 0 || !matchesTags(k, tags) || !k.artistIds.some(a => heardArtists.has(a))) continue
    const strength = (artists.get(k.artistIds.find(a => heardArtists.has(a))!)?.score ?? 0) / top
    out.push({ ...toTrack(k, 'In your library, never played'), score: fit(k.axes, q.axes) * 2 + strength * 0.8 + random(q.seed, k.videoId) * 0.6 })
  }

  const candidates: Candidate[] = []
  for (const [artistId, a] of seeds) {
    const dzId = await deezerArtistId(db, artistId, a.name)
    if (!dzId) continue
    const strength = a.score / top
    const axes = avg(a.axes)
    const own = await deezer<{ data?: DzTrack[] }>(`/artist/${dzId}/top?limit=10`, 7 * DAY)
    for (const t of own?.data ?? []) candidates.push({ track: t, seed: a.name, own: true, strength, axes })
    const related = await deezer<{ data?: DzArtist[] }>(`/artist/${dzId}/related?limit=6`, 7 * DAY)
    for (const r of related?.data ?? []) {
      const tops = await deezer<{ data?: DzTrack[] }>(`/artist/${r.id}/top?limit=3`, 7 * DAY)
      for (const t of tops?.data ?? []) candidates.push({ track: t, seed: a.name, own: false, strength: strength * 0.8, axes })
    }
  }
  for (const c of candidates) {
    const t = c.track
    const id = `${plain(leadArtist(t.artist.name))}|${plain(cleanTitle(t.title_short || t.title))}`
    if (known.has(id)) continue
    known.add(id)
    const axes: DiscoverAxes = { ...c.axes, popular: t.rank > 0 ? clamp((Math.log10(t.rank) - 4.8) / 1.2) : null }
    out.push({
      key: `dz:${t.id}`,
      trackId: null,
      videoId: '',
      title: t.title_short || t.title,
      artist: t.artist.name,
      album: t.album?.title ?? '',
      artwork: t.album?.cover_medium ?? '',
      durationMs: t.duration ? t.duration * 1000 : null,
      heard: false,
      plays: 0,
      lastHeardAt: null,
      tags: [],
      reason: c.own ? `More from ${c.seed}` : `Similar to ${c.seed}`,
      axes,
      score: fit(axes, q.axes) * 2 + c.strength * 0.8 + random(q.seed, id) * 0.6,
    })
  }
  return spread(out, want).map(({ score: _score, ...track }) => track)
}

export async function findOnYouTube(title: string, artist: string): Promise<MusicTrack | null> {
  const who = leadArtist(artist)
  const name = cleanTitle(title)
  const key = `${plain(who)}|${plain(name)}`
  const cached = readCache<MusicTrack | null>('discover-yt', key)
  if (cached && (cached.value || Date.now() - cached.at < DAY)) return cached.value
  const found = await ytMusicService.search(`${who} ${name}`)
  const songs = found.songs.filter(s => s.videoId)
  const pick = songs.find(s => sameName(s.artist, who) && sameName(cleanTitle(s.title), name)) ?? songs.find(s => sameName(s.artist, who)) ?? null
  writeCache('discover-yt', key, pick)
  return pick
}

function dayShuffle(list: Known[], salt: string): Known[] {
  const seed = Math.floor(Date.now() / DAY)
  return [...list].sort((a, b) => random(seed, salt + a.videoId) - random(seed, salt + b.videoId))
}

export function homeRows(): DiscoverRow[] {
  const db = activeDb()
  if (!db) return []
  const lib = loadLibrary(db)
  const byId = new Map(lib.map(k => [k.id, k]))
  const heard = lib.filter(k => k.plays > 0)
  const rows: DiscoverRow[] = []
  const add = (id: string, title: string, list: Known[], reason: (k: Known) => string) => {
    if (list.length >= 3) rows.push({ id, title, tracks: list.slice(0, 20).map(k => toTrack(k, reason(k))) })
  }

  const month = db
    .prepare('SELECT track_id, count(*) AS n FROM plays WHERE qualified = 1 AND started_at > ? GROUP BY track_id ORDER BY sum(listened_ms) DESC LIMIT 40')
    .all(Date.now() - 30 * DAY) as Array<{ track_id: number; n: number }>
  const monthCount = new Map(month.map(r => [r.track_id, r.n]))
  add(
    'repeat',
    'On repeat',
    month.map(r => byId.get(r.track_id)).filter((k): k is Known => !!k),
    k => `${monthCount.get(k.id)} plays this month`,
  )

  const sortedPlays = heard.map(k => k.plays).sort((a, b) => a - b)
  const loved = Math.max(2, sortedPlays[Math.floor(sortedPlays.length * 0.6)] ?? 2)
  add(
    'forgotten',
    'Forgotten favorites',
    heard.filter(k => k.plays >= loved && daysAgo(k.lastHeardAt) >= 21).sort((a, b) => b.listenedMs - a.listenedMs),
    k => `Not played in ${Math.floor(daysAgo(k.lastHeardAt))} days`,
  )

  add(
    'recent',
    'New to your ears',
    heard.filter(k => daysAgo(k.firstHeardAt) <= 14).sort((a, b) => (b.firstHeardAt ?? 0) - (a.firstHeardAt ?? 0)),
    k => (k.plays === 1 ? 'Heard once' : `Heard ${k.plays} times`),
  )

  const taste = discoverTaste()
  for (const t of taste?.tags.slice(0, 3) ?? []) {
    add(
      `tag:${t.tag}`,
      `Your ${t.tag} mix`,
      dayShuffle(
        heard.filter(k => k.tags.has(t.tag)),
        t.tag,
      ),
      k => (k.plays === 1 ? 'Heard once' : `Heard ${k.plays} times`),
    )
  }

  add(
    'unheard',
    'Never played',
    dayShuffle(
      lib.filter(k => k.plays === 0),
      'unheard',
    ),
    () => 'Never played',
  )
  return rows
}
