import type Database from 'better-sqlite3'

import { activeDb } from './MusicDatabase'
import type {
  RepoAlbumDetail,
  RepoAlbumRow,
  RepoAlbumSort,
  RepoArtistDetail,
  RepoArtistRef,
  RepoArtistRow,
  RepoArtistSort,
  RepoEndReason,
  RepoEventQuery,
  RepoEventRow,
  RepoEventType,
  RepoExternalId,
  RepoListQuery,
  RepoPage,
  RepoPlayQuery,
  RepoPlayRow,
  RepoSearchEntry,
  RepoSummary,
  RepoTableCount,
  RepoTrackDetail,
  RepoTrackQuery,
  RepoTrackRow,
  RepoTrackSort,
} from './musicRepoTypes'

type Db = Database.Database

export const PROVIDER = 'youtube_music'

export type KnownVia = 'playback' | 'queue' | 'legacy'

export interface SeenTrack {
  videoId: string
  title: string
  artistText: string
  artists: Array<{ name: string; id: string }>
  album: string
  albumId: string
  artwork: string
  durationMs: number | null
  kind: string
}

const MAX_PAGE = 200
const SEARCH_KEEP = 500

function page(offset?: number, limit?: number): { offset: number; limit: number } {
  return { offset: Math.max(0, Math.floor(offset ?? 0)), limit: Math.min(MAX_PAGE, Math.max(1, Math.floor(limit ?? 50))) }
}

export function like(text: string): string {
  return `%${text.replace(/[\\%_]/g, m => `\\${m}`)}%`
}

function bool(value: number | null): boolean | null {
  return value == null ? null : value !== 0
}

function externalEntity(db: Db, type: string, externalId: string): number | null {
  const row = db.prepare('SELECT entity_id FROM external_ids WHERE entity_type = ? AND provider = ? AND external_id = ?').get(type, PROVIDER, externalId) as
    | { entity_id: number }
    | undefined
  return row?.entity_id ?? null
}

function addExternal(db: Db, type: string, entityId: number, externalId: string, now: number): void {
  db.prepare(
    `INSERT INTO external_ids (entity_type, entity_id, provider, external_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (entity_type, provider, external_id) DO NOTHING`,
  ).run(type, entityId, PROVIDER, externalId, now, now)
}

function hasExternal(db: Db, type: string, entityId: number): boolean {
  return !!db.prepare('SELECT 1 FROM external_ids WHERE entity_type = ? AND entity_id = ? AND provider = ?').get(type, entityId, PROVIDER)
}

function resolveArtist(db: Db, name: string, channelId: string, now: number): number | null {
  const clean = name.trim()
  if (!clean) return null
  if (channelId) {
    const known = externalEntity(db, 'artist', channelId)
    if (known) return known
  }
  const byName = db.prepare('SELECT id FROM artists WHERE name = ? COLLATE NOCASE ORDER BY id').all(clean) as Array<{ id: number }>
  for (const { id } of byName) {
    if (!channelId) return id
    if (!hasExternal(db, 'artist', id)) {
      addExternal(db, 'artist', id, channelId, now)
      return id
    }
  }
  const id = Number(db.prepare('INSERT INTO artists (name, created_at, updated_at) VALUES (?, ?, ?)').run(clean, now, now).lastInsertRowid)
  if (channelId) addExternal(db, 'artist', id, channelId, now)
  return id
}

function resolveAlbum(db: Db, title: string, browseId: string, leadArtist: number | null, artwork: string, now: number): number | null {
  const clean = title.trim()
  if (!clean) return null
  let id = browseId ? externalEntity(db, 'album', browseId) : null
  if (!id && leadArtist) {
    const row = db
      .prepare(
        `SELECT al.id FROM albums al JOIN album_artists aa ON aa.album_id = al.id AND aa.artist_id = ?
         WHERE al.title = ? COLLATE NOCASE ORDER BY al.id LIMIT 1`,
      )
      .get(leadArtist, clean) as { id: number } | undefined
    if (row && (!browseId || !hasExternal(db, 'album', row.id))) id = row.id
  }
  if (!id) {
    id = Number(db.prepare('INSERT INTO albums (title, artwork_url, created_at, updated_at) VALUES (?, ?, ?, ?)').run(clean, artwork || null, now, now).lastInsertRowid)
    if (leadArtist) db.prepare('INSERT OR IGNORE INTO album_artists (album_id, artist_id, position) VALUES (?, ?, 0)').run(id, leadArtist)
  } else if (artwork) {
    db.prepare('UPDATE albums SET artwork_url = ?, updated_at = ? WHERE id = ? AND (artwork_url IS NULL OR artwork_url = \'\')').run(artwork, now, id)
  }
  if (browseId) addExternal(db, 'album', id, browseId, now)
  return id
}

function artistList(seen: SeenTrack): Array<{ name: string; id: string }> {
  if (seen.artists.length) return seen.artists
  return seen.artistText.trim() ? [{ name: seen.artistText.trim(), id: '' }] : []
}

export function ensureTrack(db: Db, seen: SeenTrack, via: KnownVia, at: number, context = ''): { trackId: number; sourceId: number } {
  const now = Date.now()
  const existing = db.prepare('SELECT id, track_id FROM track_sources WHERE provider = ? AND provider_id = ?').get(PROVIDER, seen.videoId) as
    | { id: number; track_id: number }
    | undefined

  let trackId: number
  let sourceId: number
  if (existing) {
    trackId = existing.track_id
    sourceId = existing.id
    db.prepare(
      `UPDATE track_sources SET
         first_seen_at = min(first_seen_at, @at),
         last_seen_at = max(last_seen_at, @at),
         source_title = CASE WHEN @title <> '' THEN @title ELSE source_title END,
         source_artist_text = CASE WHEN @artist <> '' THEN @artist ELSE source_artist_text END,
         source_album_text = CASE WHEN @album <> '' THEN @album ELSE source_album_text END,
         artwork_url = CASE WHEN @artwork <> '' THEN @artwork ELSE artwork_url END,
         duration_ms = coalesce(@duration, duration_ms),
         kind = CASE WHEN @kind <> 'unknown' THEN @kind ELSE kind END
       WHERE id = @id`,
    ).run({ id: sourceId, at, title: seen.title, artist: seen.artistText, album: seen.album, artwork: seen.artwork, duration: seen.durationMs, kind: seen.kind })
    db.prepare(
      `UPDATE tracks SET
         known_via = CASE WHEN @at < known_at THEN @via ELSE known_via END,
         known_context = CASE WHEN @at < known_at THEN @context ELSE known_context END,
         known_at = min(known_at, @at),
         title = CASE WHEN title = '' AND @title <> '' THEN @title ELSE title END,
         duration_ms = coalesce(duration_ms, @duration),
         updated_at = @now
       WHERE id = @id`,
    ).run({ id: trackId, at, via, context, title: seen.title, duration: seen.durationMs, now })
  } else {
    trackId = Number(
      db
        .prepare('INSERT INTO tracks (title, duration_ms, known_at, known_via, known_context, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(seen.title, seen.durationMs, at, via, context, now, now).lastInsertRowid,
    )
    sourceId = Number(
      db
        .prepare(
          `INSERT INTO track_sources (track_id, provider, provider_id, kind, source_title, source_artist_text, source_album_text, artwork_url, duration_ms, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(trackId, PROVIDER, seen.videoId, seen.kind, seen.title, seen.artistText, seen.album, seen.artwork, seen.durationMs, at, at).lastInsertRowid,
    )
  }

  const hasArtists = !!db.prepare('SELECT 1 FROM track_artists WHERE track_id = ?').get(trackId)
  let lead: number | null = null
  if (!hasArtists) {
    artistList(seen).forEach((a, position) => {
      const id = resolveArtist(db, a.name, a.id, now)
      if (!id) return
      if (lead == null) lead = id
      db.prepare('INSERT OR IGNORE INTO track_artists (track_id, artist_id, role, position) VALUES (?, ?, \'primary\', ?)').run(trackId, id, position)
    })
  } else {
    const row = db.prepare('SELECT artist_id FROM track_artists WHERE track_id = ? ORDER BY position LIMIT 1').get(trackId) as { artist_id: number } | undefined
    lead = row?.artist_id ?? null
  }
  if (seen.album) {
    const current = db.prepare('SELECT album_id FROM tracks WHERE id = ?').get(trackId) as { album_id: number | null }
    if (current.album_id == null) {
      const albumId = resolveAlbum(db, seen.album, seen.albumId, lead, seen.kind === 'song' ? seen.artwork : '', now)
      if (albumId) db.prepare('UPDATE tracks SET album_id = ? WHERE id = ?').run(albumId, trackId)
    }
  }
  return { trackId, sourceId }
}

export const ARTIST_TEXT = `(SELECT group_concat(name, ', ') FROM (SELECT a.name FROM track_artists ta JOIN artists a ON a.id = ta.artist_id WHERE ta.track_id = t.id ORDER BY ta.position))`
export const BEST_SOURCE = `(SELECT id FROM track_sources WHERE track_id = t.id ORDER BY preferred DESC, last_seen_at DESC LIMIT 1)`

const TRACK_SORT: Record<RepoTrackSort, string> = {
  title: 't.title COLLATE NOCASE',
  artist: 'artist COLLATE NOCASE',
  album: 'al.title COLLATE NOCASE',
  duration: 't.duration_ms',
  known: 't.known_at',
  firstHeard: 'st.first_heard_at',
  lastHeard: 'st.last_heard_at',
  plays: 'coalesce(st.play_count, 0)',
  listened: 'coalesce(st.total_listened_ms, 0)',
  completion: 'st.avg_completion',
  skips: 'coalesce(st.skip_count, 0)',
}

function dir(d?: string): string {
  return d === 'asc' ? 'ASC' : 'DESC'
}

export function listTracks(q: RepoTrackQuery): RepoPage<RepoTrackRow> {
  const db = activeDb()
  const { offset, limit } = page(q.offset, q.limit)
  if (!db) return { rows: [], total: 0, offset, limit }
  const where: string[] = []
  const params: Record<string, unknown> = { limit, offset }
  if (q.search?.trim()) {
    params.search = like(q.search.trim())
    where.push(`(t.title LIKE @search ESCAPE '\\' OR al.title LIKE @search ESCAPE '\\' OR EXISTS (
      SELECT 1 FROM track_artists ta JOIN artists a ON a.id = ta.artist_id WHERE ta.track_id = t.id AND a.name LIKE @search ESCAPE '\\'))`)
  }
  if (q.heard === 'heard') where.push('st.play_count > 0')
  if (q.heard === 'unheard') where.push('coalesce(st.play_count, 0) = 0')
  if (q.artistId) {
    params.artistId = q.artistId
    where.push('EXISTS (SELECT 1 FROM track_artists ta WHERE ta.track_id = t.id AND ta.artist_id = @artistId)')
  }
  if (q.albumId) {
    params.albumId = q.albumId
    where.push('t.album_id = @albumId')
  }
  const from = `FROM tracks t LEFT JOIN albums al ON al.id = t.album_id LEFT JOIN track_stats st ON st.track_id = t.id ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`
  const total = (db.prepare(`SELECT count(*) AS n ${from}`).get(params) as { n: number }).n
  const order = TRACK_SORT[q.sort ?? 'lastHeard'] ?? TRACK_SORT.lastHeard
  const rows = db
    .prepare(
      `SELECT t.id, t.title, t.duration_ms, t.known_at, t.known_via, t.album_id, al.title AS album, ${ARTIST_TEXT} AS artist,
         s.provider, s.provider_id, s.artwork_url,
         st.play_count, st.total_listened_ms, st.avg_completion, st.skip_count, st.first_heard_at, st.last_heard_at
       ${from.replace('LEFT JOIN track_stats', `LEFT JOIN track_sources s ON s.id = ${BEST_SOURCE} LEFT JOIN track_stats`)}
       ORDER BY ${order} ${dir(q.dir)} NULLS LAST, t.id DESC LIMIT @limit OFFSET @offset`,
    )
    .all(params) as Array<Record<string, unknown>>
  return {
    total,
    offset,
    limit,
    rows: rows.map(r => ({
      id: r.id as number,
      title: r.title as string,
      artist: (r.artist as string) ?? '',
      album: (r.album as string) ?? '',
      albumId: (r.album_id as number) ?? null,
      artwork: (r.artwork_url as string) ?? '',
      durationMs: (r.duration_ms as number) ?? null,
      knownAt: r.known_at as number,
      knownVia: r.known_via as string,
      firstHeardAt: (r.first_heard_at as number) ?? null,
      lastHeardAt: (r.last_heard_at as number) ?? null,
      plays: (r.play_count as number) ?? 0,
      listenedMs: (r.total_listened_ms as number) ?? 0,
      completion: (r.avg_completion as number) ?? null,
      skips: (r.skip_count as number) ?? 0,
      provider: (r.provider as string) ?? '',
      videoId: (r.provider_id as string) ?? '',
    })),
  }
}

function externalIds(db: Db, type: string, id: number): RepoExternalId[] {
  return (
    db.prepare('SELECT provider, external_id, confidence, created_at FROM external_ids WHERE entity_type = ? AND entity_id = ? ORDER BY provider').all(type, id) as Array<{
      provider: string
      external_id: string
      confidence: number | null
      created_at: number
    }>
  ).map(r => ({ provider: r.provider, externalId: r.external_id, confidence: r.confidence, createdAt: r.created_at }))
}

export function getTrack(id: number): RepoTrackDetail | null {
  const db = activeDb()
  if (!db) return null
  const t = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!t) return null
  const sources = (db.prepare('SELECT * FROM track_sources WHERE track_id = ? ORDER BY preferred DESC, last_seen_at DESC').all(id) as Array<Record<string, unknown>>).map(s => ({
    id: s.id as number,
    provider: s.provider as string,
    providerId: s.provider_id as string,
    kind: s.kind as string,
    title: s.source_title as string,
    artistText: s.source_artist_text as string,
    albumText: s.source_album_text as string,
    artwork: s.artwork_url as string,
    durationMs: (s.duration_ms as number) ?? null,
    firstSeenAt: s.first_seen_at as number,
    lastSeenAt: s.last_seen_at as number,
    preferred: s.preferred === 1,
  }))
  const artists = db
    .prepare('SELECT a.id, a.name, ta.role FROM track_artists ta JOIN artists a ON a.id = ta.artist_id WHERE ta.track_id = ? ORDER BY ta.position')
    .all(id) as RepoArtistRef[]
  const album = t.album_id ? ((db.prepare('SELECT id, title FROM albums WHERE id = ?').get(t.album_id) as { id: number; title: string } | undefined) ?? null) : null
  const st = db.prepare('SELECT * FROM track_stats WHERE track_id = ?').get(id) as Record<string, number | null> | undefined
  const features = (db.prepare('SELECT * FROM track_features WHERE track_id = ? ORDER BY feature, provider').all(id) as Array<Record<string, unknown>>).map(f => ({
    feature: f.feature as string,
    valueNum: (f.value_num as number) ?? null,
    valueText: (f.value_text as string) ?? null,
    provider: f.provider as string,
    confidence: (f.confidence as number) ?? null,
    fetchedAt: f.fetched_at as number,
  }))
  const genres = (db.prepare('SELECT * FROM track_genres WHERE track_id = ? ORDER BY weight DESC NULLS LAST, genre').all(id) as Array<Record<string, unknown>>).map(g => ({
    genre: g.genre as string,
    kind: g.kind as string,
    weight: (g.weight as number) ?? null,
    provider: g.provider as string,
    fetchedAt: g.fetched_at as number,
  }))
  return {
    id,
    title: t.title as string,
    durationMs: (t.duration_ms as number) ?? null,
    releaseYear: (t.release_year as number) ?? null,
    explicit: bool(t.explicit as number | null),
    instrumental: bool(t.instrumental as number | null),
    knownAt: t.known_at as number,
    knownVia: t.known_via as string,
    knownContext: (t.known_context as string) ?? '',
    createdAt: t.created_at as number,
    updatedAt: t.updated_at as number,
    artwork: sources[0]?.artwork ?? '',
    album,
    artists,
    sources,
    externalIds: [...externalIds(db, 'track', id), ...sources.flatMap(s => externalIds(db, 'source', s.id))],
    features,
    genres,
    stats: {
      plays: st?.play_count ?? 0,
      listens: st?.listen_count ?? 0,
      completed: st?.completed_count ?? 0,
      skips: st?.skip_count ?? 0,
      listenedMs: st?.total_listened_ms ?? 0,
      firstHeardAt: st?.first_heard_at ?? null,
      lastHeardAt: st?.last_heard_at ?? null,
      avgCompletion: st?.avg_completion ?? null,
    },
  }
}

export function getTrackByVideoId(videoId: string): RepoTrackDetail | null {
  const db = activeDb()
  if (!db) return null
  const row = db.prepare('SELECT track_id FROM track_sources WHERE provider = ? AND provider_id = ?').get(PROVIDER, videoId) as { track_id: number } | undefined
  return row ? getTrack(row.track_id) : null
}

const EVENT_SELECT = `SELECT e.id, e.type, e.occurred_at, e.play_id, e.track_id, e.position_ms, e.duration_ms, e.listened_ms, e.completion, e.origin, e.detail,
  t.title, ${ARTIST_TEXT} AS artist, (SELECT artwork_url FROM track_sources WHERE id = coalesce(e.source_id, ${BEST_SOURCE})) AS artwork
  FROM listening_events e JOIN tracks t ON t.id = e.track_id`

function eventRow(r: Record<string, unknown>): RepoEventRow {
  return {
    id: r.id as number,
    type: r.type as RepoEventType,
    at: r.occurred_at as number,
    playId: r.play_id as number,
    trackId: r.track_id as number,
    title: r.title as string,
    artist: (r.artist as string) ?? '',
    artwork: (r.artwork as string) ?? '',
    positionMs: (r.position_ms as number) ?? null,
    durationMs: (r.duration_ms as number) ?? null,
    listenedMs: (r.listened_ms as number) ?? null,
    completion: (r.completion as number) ?? null,
    origin: (r.origin as string) ?? '',
    detail: (r.detail as string) ?? '',
  }
}

const EVENT_TYPES = new Set<string>(['start', 'pause', 'resume', 'seek', 'complete', 'skip', 'stop', 'interrupted', 'legacy'])

export function listEvents(q: RepoEventQuery): RepoPage<RepoEventRow> {
  const db = activeDb()
  const { offset, limit } = page(q.offset, q.limit)
  if (!db) return { rows: [], total: 0, offset, limit }
  const where: string[] = []
  const params: Record<string, unknown> = { limit, offset }
  if (q.from != null) {
    params.from = q.from
    where.push('e.occurred_at >= @from')
  }
  if (q.to != null) {
    params.to = q.to
    where.push('e.occurred_at < @to')
  }
  const types = (q.types ?? []).filter(t => EVENT_TYPES.has(t))
  if (types.length) where.push(`e.type IN (${types.map(t => `'${t}'`).join(', ')})`)
  if (q.trackId) {
    params.trackId = q.trackId
    where.push('e.track_id = @trackId')
  }
  if (q.artistId) {
    params.artistId = q.artistId
    where.push('EXISTS (SELECT 1 FROM track_artists ta WHERE ta.track_id = e.track_id AND ta.artist_id = @artistId)')
  }
  if (q.playId) {
    params.playId = q.playId
    where.push('e.play_id = @playId')
  }
  if (q.search?.trim()) {
    params.search = like(q.search.trim())
    where.push(`e.track_id IN (SELECT id FROM tracks WHERE title LIKE @search ESCAPE '\\'
      UNION SELECT ta.track_id FROM track_artists ta JOIN artists a ON a.id = ta.artist_id WHERE a.name LIKE @search ESCAPE '\\')`)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const total = (db.prepare(`SELECT count(*) AS n FROM listening_events e JOIN tracks t ON t.id = e.track_id ${clause}`).get(params) as { n: number }).n
  const rows = db.prepare(`${EVENT_SELECT} ${clause} ORDER BY e.occurred_at DESC, e.id DESC LIMIT @limit OFFSET @offset`).all(params) as Array<Record<string, unknown>>
  return { total, offset, limit, rows: rows.map(eventRow) }
}

export function listPlays(q: RepoPlayQuery): RepoPage<RepoPlayRow> {
  const db = activeDb()
  const { offset, limit } = page(q.offset, q.limit)
  if (!db) return { rows: [], total: 0, offset, limit }
  const where: string[] = []
  const params: Record<string, unknown> = { limit, offset }
  if (q.from != null) {
    params.from = q.from
    where.push('p.started_at >= @from')
  }
  if (q.to != null) {
    params.to = q.to
    where.push('p.started_at < @to')
  }
  if (q.trackId) {
    params.trackId = q.trackId
    where.push('p.track_id = @trackId')
  }
  if (q.artistId) {
    params.artistId = q.artistId
    where.push('EXISTS (SELECT 1 FROM track_artists ta WHERE ta.track_id = p.track_id AND ta.artist_id = @artistId)')
  }
  if (q.search?.trim()) {
    params.search = like(q.search.trim())
    where.push(`p.track_id IN (SELECT id FROM tracks WHERE title LIKE @search ESCAPE '\\'
      UNION SELECT ta.track_id FROM track_artists ta JOIN artists a ON a.id = ta.artist_id WHERE a.name LIKE @search ESCAPE '\\')`)
  }
  if (q.counted) where.push('p.qualified = 1')
  if (q.outcome === 'complete') where.push("p.end_reason IN ('complete', 'legacy')")
  if (q.outcome === 'skip') where.push("p.end_reason = 'skip'")
  if (q.outcome === 'other') where.push("(p.end_reason IS NULL OR p.end_reason IN ('stop', 'interrupted'))")
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const total = (db.prepare(`SELECT count(*) AS n FROM plays p ${clause}`).get(params) as { n: number }).n
  const rows = db
    .prepare(
      `SELECT p.id, p.track_id, p.started_at, p.ended_at, p.duration_ms, p.listened_ms, p.completion, p.end_reason, p.qualified, p.origin,
         t.title, ${ARTIST_TEXT} AS artist,
         (SELECT artwork_url FROM track_sources WHERE id = coalesce(p.source_id, ${BEST_SOURCE})) AS artwork,
         (SELECT count(*) FROM listening_events e WHERE e.play_id = p.id) AS events
       FROM plays p JOIN tracks t ON t.id = p.track_id ${clause}
       ORDER BY p.started_at DESC, p.id DESC LIMIT @limit OFFSET @offset`,
    )
    .all(params) as Array<Record<string, unknown>>
  return {
    total,
    offset,
    limit,
    rows: rows.map(r => ({
      id: r.id as number,
      trackId: r.track_id as number,
      title: r.title as string,
      artist: (r.artist as string) ?? '',
      artwork: (r.artwork as string) ?? '',
      startedAt: r.started_at as number,
      endedAt: (r.ended_at as number) ?? null,
      durationMs: (r.duration_ms as number) ?? null,
      listenedMs: (r.listened_ms as number) ?? 0,
      completion: (r.completion as number) ?? null,
      endReason: (r.end_reason as RepoEndReason) ?? null,
      qualified: r.qualified === 1,
      origin: (r.origin as string) ?? '',
      events: r.events as number,
    })),
  }
}

export function getTrackHistory(trackId: number, offset?: number, limit?: number): RepoPage<RepoEventRow> {
  return listEvents({ trackId, offset, limit })
}

export function getRecentListening(limit = 30): RepoEventRow[] {
  return listEvents({ types: ['start', 'legacy'], limit }).rows
}

export function getRecentlyDiscovered(limit = 30): RepoTrackRow[] {
  return listTracks({ sort: 'known', dir: 'desc', limit }).rows
}

export function getUnheardKnownTracks(offset?: number, limit?: number): RepoPage<RepoTrackRow> {
  return listTracks({ heard: 'unheard', sort: 'known', dir: 'desc', offset, limit })
}

export function searchRepository(text: string, limit = 20): RepoTrackRow[] {
  return listTracks({ search: text, sort: 'plays', dir: 'desc', limit }).rows
}

const ARTIST_SORT: Record<RepoArtistSort, string> = {
  name: 'a.name COLLATE NOCASE',
  tracks: 'tracks',
  heard: 'heard',
  albums: 'albums',
  plays: 'plays',
  listened: 'listened',
  firstHeard: 'first_heard',
  lastHeard: 'last_heard',
}

const ARTIST_AGG = `SELECT a.id, a.name, a.sort_name, a.created_at,
  count(DISTINCT ta.track_id) AS tracks,
  count(DISTINCT CASE WHEN st.play_count > 0 THEN ta.track_id END) AS heard,
  count(DISTINCT t.album_id) AS albums,
  coalesce(sum(st.play_count), 0) AS plays,
  coalesce(sum(st.total_listened_ms), 0) AS listened,
  coalesce(sum(st.skip_count), 0) AS skips,
  avg(st.avg_completion) AS avg_completion,
  min(st.first_heard_at) AS first_heard,
  max(st.last_heard_at) AS last_heard
  FROM artists a
  LEFT JOIN track_artists ta ON ta.artist_id = a.id
  LEFT JOIN tracks t ON t.id = ta.track_id
  LEFT JOIN track_stats st ON st.track_id = ta.track_id`

function artistTop(db: Db, id: number): { title: string; artwork: string; plays: number } {
  const row = db
    .prepare(
      `SELECT t.title, coalesce(st.play_count, 0) AS plays,
         (SELECT artwork_url FROM track_sources WHERE id = ${BEST_SOURCE}) AS artwork
       FROM track_artists ta JOIN tracks t ON t.id = ta.track_id LEFT JOIN track_stats st ON st.track_id = t.id
       WHERE ta.artist_id = ? ORDER BY plays DESC, st.last_heard_at DESC NULLS LAST, t.known_at DESC LIMIT 1`,
    )
    .get(id) as { title: string; plays: number; artwork: string | null } | undefined
  return { title: row?.title ?? '', artwork: row?.artwork ?? '', plays: row?.plays ?? 0 }
}

function artistRow(db: Db, r: Record<string, unknown>): RepoArtistRow {
  const top = artistTop(db, r.id as number)
  return {
    id: r.id as number,
    name: r.name as string,
    artwork: top.artwork,
    tracks: r.tracks as number,
    heard: r.heard as number,
    albums: r.albums as number,
    plays: r.plays as number,
    listenedMs: r.listened as number,
    skips: r.skips as number,
    avgCompletion: (r.avg_completion as number) ?? null,
    firstHeardAt: (r.first_heard as number) ?? null,
    lastHeardAt: (r.last_heard as number) ?? null,
    topTrack: top.plays > 0 ? top.title : '',
  }
}

export function listArtists(q: RepoListQuery<RepoArtistSort>): RepoPage<RepoArtistRow> {
  const db = activeDb()
  const { offset, limit } = page(q.offset, q.limit)
  if (!db) return { rows: [], total: 0, offset, limit }
  const params: Record<string, unknown> = { limit, offset }
  let where = ''
  if (q.search?.trim()) {
    params.search = like(q.search.trim())
    where = `WHERE a.name LIKE @search ESCAPE '\\'`
  }
  const total = (db.prepare(`SELECT count(*) AS n FROM artists a ${where}`).get(params) as { n: number }).n
  const order = ARTIST_SORT[q.sort ?? 'plays'] ?? ARTIST_SORT.plays
  const rows = db.prepare(`${ARTIST_AGG} ${where} GROUP BY a.id ORDER BY ${order} ${dir(q.dir)} NULLS LAST, a.id LIMIT @limit OFFSET @offset`).all(params) as Array<
    Record<string, unknown>
  >
  return { total, offset, limit, rows: rows.map(r => artistRow(db, r)) }
}

export function getArtist(id: number): RepoArtistDetail | null {
  const db = activeDb()
  if (!db) return null
  const r = db.prepare(`${ARTIST_AGG} WHERE a.id = ? GROUP BY a.id`).get(id) as Record<string, unknown> | undefined
  if (!r) return null
  return { ...artistRow(db, r), sortName: (r.sort_name as string) ?? '', createdAt: r.created_at as number, externalIds: externalIds(db, 'artist', id) }
}

export function getArtistStats(id: number): RepoArtistRow | null {
  return getArtist(id)
}

const ALBUM_SORT: Record<RepoAlbumSort, string> = {
  title: 'al.title COLLATE NOCASE',
  artist: 'artist COLLATE NOCASE',
  year: 'al.release_year',
  tracks: 'tracks',
  heard: 'heard',
  plays: 'plays',
  listened: 'listened',
}

export const ALBUM_ARTISTS = `(SELECT group_concat(name, ', ') FROM (SELECT a.name FROM album_artists aa JOIN artists a ON a.id = aa.artist_id WHERE aa.album_id = al.id ORDER BY aa.position))`

const ALBUM_AGG = `SELECT al.id, al.title, al.release_year, al.release_date, al.artwork_url, al.created_at, ${ALBUM_ARTISTS} AS artist,
  count(t.id) AS tracks,
  count(CASE WHEN st.play_count > 0 THEN 1 END) AS heard,
  coalesce(sum(st.play_count), 0) AS plays,
  coalesce(sum(st.total_listened_ms), 0) AS listened,
  min(st.first_heard_at) AS first_heard,
  max(st.last_heard_at) AS last_heard,
  avg(st.avg_completion) AS avg_completion,
  (SELECT s.artwork_url FROM tracks t2 JOIN track_sources s ON s.track_id = t2.id WHERE t2.album_id = al.id AND s.artwork_url <> '' ORDER BY s.kind = 'song' DESC LIMIT 1) AS track_artwork
  FROM albums al
  LEFT JOIN tracks t ON t.album_id = al.id
  LEFT JOIN track_stats st ON st.track_id = t.id`

function albumRow(r: Record<string, unknown>): RepoAlbumRow {
  return {
    id: r.id as number,
    title: r.title as string,
    artist: (r.artist as string) ?? '',
    artwork: (r.artwork_url as string) || ((r.track_artwork as string) ?? ''),
    year: (r.release_year as number) ?? null,
    tracks: r.tracks as number,
    heard: r.heard as number,
    plays: r.plays as number,
    listenedMs: r.listened as number,
    firstHeardAt: (r.first_heard as number) ?? null,
    lastHeardAt: (r.last_heard as number) ?? null,
  }
}

export function listAlbums(q: RepoListQuery<RepoAlbumSort>): RepoPage<RepoAlbumRow> {
  const db = activeDb()
  const { offset, limit } = page(q.offset, q.limit)
  if (!db) return { rows: [], total: 0, offset, limit }
  const params: Record<string, unknown> = { limit, offset }
  const where: string[] = []
  if (q.search?.trim()) {
    params.search = like(q.search.trim())
    where.push(`(al.title LIKE @search ESCAPE '\\' OR EXISTS (SELECT 1 FROM album_artists aa JOIN artists a ON a.id = aa.artist_id WHERE aa.album_id = al.id AND a.name LIKE @search ESCAPE '\\'))`)
  }
  if (q.artistId) {
    params.artistId = q.artistId
    where.push(`(EXISTS (SELECT 1 FROM album_artists aa WHERE aa.album_id = al.id AND aa.artist_id = @artistId)
      OR EXISTS (SELECT 1 FROM tracks t3 JOIN track_artists ta ON ta.track_id = t3.id WHERE t3.album_id = al.id AND ta.artist_id = @artistId))`)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const total = (db.prepare(`SELECT count(*) AS n FROM albums al ${clause}`).get(params) as { n: number }).n
  const order = ALBUM_SORT[q.sort ?? 'plays'] ?? ALBUM_SORT.plays
  const rows = db.prepare(`${ALBUM_AGG} ${clause} GROUP BY al.id ORDER BY ${order} ${dir(q.dir)} NULLS LAST, al.id LIMIT @limit OFFSET @offset`).all(params) as Array<
    Record<string, unknown>
  >
  return { total, offset, limit, rows: rows.map(albumRow) }
}

export function getAlbum(id: number): RepoAlbumDetail | null {
  const db = activeDb()
  if (!db) return null
  const r = db.prepare(`${ALBUM_AGG} WHERE al.id = ? GROUP BY al.id`).get(id) as Record<string, unknown> | undefined
  if (!r) return null
  const artists = db
    .prepare(`SELECT a.id, a.name, 'primary' AS role FROM album_artists aa JOIN artists a ON a.id = aa.artist_id WHERE aa.album_id = ? ORDER BY aa.position`)
    .all(id) as RepoArtistRef[]
  return {
    ...albumRow(r),
    artists,
    releaseDate: (r.release_date as string) ?? '',
    createdAt: r.created_at as number,
    externalIds: externalIds(db, 'album', id),
    avgCompletion: (r.avg_completion as number) ?? null,
  }
}

export function getAlbumStats(id: number): RepoAlbumRow | null {
  return getAlbum(id)
}

export function getSummary(sizeBytes: number): RepoSummary | null {
  const db = activeDb()
  if (!db) return null
  const one = (sql: string) => (db.prepare(sql).get() as { n: number | null }).n ?? 0
  const known = one('SELECT count(*) AS n FROM tracks')
  const heard = one('SELECT count(*) AS n FROM track_stats WHERE play_count > 0')
  return {
    knownTracks: known,
    heardTracks: heard,
    unheardTracks: known - heard,
    artists: one('SELECT count(*) AS n FROM artists'),
    albums: one('SELECT count(*) AS n FROM albums'),
    plays: one('SELECT sum(play_count) AS n FROM track_stats'),
    events: one('SELECT count(*) AS n FROM listening_events'),
    listenedMs: one('SELECT sum(total_listened_ms) AS n FROM track_stats'),
    firstListenAt: one('SELECT min(first_heard_at) AS n FROM track_stats'),
    lastListenAt: one('SELECT max(last_heard_at) AS n FROM track_stats'),
    sizeBytes,
  }
}

export function getDatabaseSummary(sizeBytes: number): RepoSummary | null {
  return getSummary(sizeBytes)
}

export function tableCounts(): RepoTableCount[] {
  const db = activeDb()
  if (!db) return []
  const names = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ name: string }>).map(r => r.name)
  return names.map(name => ({ name, rows: (db.prepare(`SELECT count(*) AS n FROM "${name.replace(/"/g, '""')}"`).get() as { n: number }).n }))
}

export function recordSearch(db: Db, query: string, resultKind = '', resultId = ''): void {
  const clean = query.trim().slice(0, 200)
  if (!clean) return
  const now = Date.now()
  db.prepare(
    `INSERT INTO search_history (query, query_norm, searched_at, result_kind, result_id) VALUES (@q, @norm, @now, @kind, @id)
     ON CONFLICT (query_norm) DO UPDATE SET query = @q, count = count + 1, searched_at = @now,
       result_kind = CASE WHEN @kind <> '' THEN @kind ELSE result_kind END,
       result_id = CASE WHEN @id <> '' THEN @id ELSE result_id END`,
  ).run({ q: clean, norm: clean.toLowerCase().replace(/\s+/g, ' '), now, kind: resultKind, id: resultId })
  db.prepare(`DELETE FROM search_history WHERE id NOT IN (SELECT id FROM search_history ORDER BY searched_at DESC LIMIT ${SEARCH_KEEP})`).run()
}

export function clearSearch(db: Db, id?: number): void {
  if (id == null) db.prepare('DELETE FROM search_history').run()
  else db.prepare('DELETE FROM search_history WHERE id = ?').run(id)
}

export function searchHistory(limit = 50): RepoSearchEntry[] {
  const db = activeDb()
  if (!db) return []
  return (
    db.prepare('SELECT id, query, count, searched_at, result_kind, result_id FROM search_history ORDER BY searched_at DESC LIMIT ?').all(Math.min(SEARCH_KEEP, Math.max(1, limit))) as Array<
      Record<string, unknown>
    >
  ).map(r => ({
    id: r.id as number,
    query: r.query as string,
    count: r.count as number,
    searchedAt: r.searched_at as number,
    resultKind: r.result_kind as string,
    resultId: r.result_id as string,
  }))
}
