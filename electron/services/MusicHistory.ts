import type Database from 'better-sqlite3'
import crypto from 'crypto'

import { activeDb } from './MusicDatabase'
import type { RepoEndReason, RepoEventType, RepoIntegrity } from './musicRepoTypes'

type Db = Database.Database

const SESSION_GAP_MS = 30 * 60 * 1000
const MIN_LISTEN_MS = 30000

const APP_SESSION = crypto.randomUUID()

export function qualifies(listenedMs: number, durationMs: number | null): boolean {
  return listenedMs >= MIN_LISTEN_MS || (!!durationMs && durationMs > 0 && listenedMs >= durationMs / 2)
}

export function completionOf(listenedMs: number, durationMs: number | null): number | null {
  return durationMs && durationMs > 0 ? Math.min(1, listenedMs / durationMs) : null
}

function sessionFor(db: Db, at: number): number {
  const last = db.prepare('SELECT id, ended_at, app_session FROM listening_sessions ORDER BY started_at DESC LIMIT 1').get() as
    | { id: number; ended_at: number; app_session: string }
    | undefined
  if (last && last.app_session === APP_SESSION && at - last.ended_at < SESSION_GAP_MS) {
    db.prepare('UPDATE listening_sessions SET ended_at = max(ended_at, ?) WHERE id = ?').run(at, last.id)
    return last.id
  }
  return Number(db.prepare('INSERT INTO listening_sessions (started_at, ended_at, app_session, created_at) VALUES (?, ?, ?, ?)').run(at, at, APP_SESSION, Date.now()).lastInsertRowid)
}

export interface EventInput {
  playId: number
  trackId: number
  sourceId: number | null
  sessionId: number | null
  type: RepoEventType
  at: number
  positionMs: number | null
  durationMs: number | null
  listenedMs?: number | null
  completion?: number | null
  origin: string
  detail?: Record<string, unknown> | null
}

export function addEvent(db: Db, e: EventInput): void {
  db.prepare(
    `INSERT INTO listening_events (play_id, track_id, source_id, session_id, type, occurred_at, position_ms, duration_ms, listened_ms, completion, origin, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    e.playId,
    e.trackId,
    e.sourceId,
    e.sessionId,
    e.type,
    e.at,
    e.positionMs == null ? null : Math.round(e.positionMs),
    e.durationMs == null ? null : Math.round(e.durationMs),
    e.listenedMs == null ? null : Math.round(e.listenedMs),
    e.completion ?? null,
    e.origin,
    e.detail ? JSON.stringify(e.detail) : null,
  )
}

export function openPlay(
  db: Db,
  p: { trackId: number; sourceId: number; at: number; durationMs: number | null; positionMs: number; origin: string },
): { playId: number; sessionId: number } {
  const sessionId = sessionFor(db, p.at)
  const playId = Number(
    db
      .prepare('INSERT INTO plays (track_id, source_id, session_id, started_at, updated_at, duration_ms, max_position_ms, origin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(p.trackId, p.sourceId, sessionId, p.at, p.at, p.durationMs, Math.round(p.positionMs), p.origin).lastInsertRowid,
  )
  addEvent(db, { playId, trackId: p.trackId, sourceId: p.sourceId, sessionId, type: 'start', at: p.at, positionMs: p.positionMs, durationMs: p.durationMs, origin: p.origin })
  return { playId, sessionId }
}

export function touchPlay(db: Db, playId: number, p: { at: number; listenedMs: number; maxPositionMs: number; durationMs: number | null }): void {
  db.prepare('UPDATE plays SET updated_at = ?, listened_ms = ?, max_position_ms = max(max_position_ms, ?), duration_ms = coalesce(?, duration_ms) WHERE id = ? AND ended_at IS NULL').run(
    p.at,
    Math.round(p.listenedMs),
    Math.round(p.maxPositionMs),
    p.durationMs == null ? null : Math.round(p.durationMs),
    playId,
  )
}

export function closePlay(
  db: Db,
  p: {
    playId: number
    trackId: number
    sourceId: number
    sessionId: number
    at: number
    reason: RepoEndReason
    listenedMs: number
    positionMs: number
    maxPositionMs: number
    durationMs: number | null
    origin: string
  },
): { qualified: boolean; completion: number | null } {
  const completion = completionOf(p.listenedMs, p.durationMs)
  const qualified = qualifies(p.listenedMs, p.durationMs)
  db.prepare(
    `UPDATE plays SET ended_at = ?, updated_at = ?, end_reason = ?, listened_ms = ?, max_position_ms = max(max_position_ms, ?),
       duration_ms = coalesce(?, duration_ms), completion = ?, qualified = ? WHERE id = ?`,
  ).run(p.at, p.at, p.reason, Math.round(p.listenedMs), Math.round(p.maxPositionMs), p.durationMs, completion, qualified ? 1 : 0, p.playId)
  addEvent(db, {
    playId: p.playId,
    trackId: p.trackId,
    sourceId: p.sourceId,
    sessionId: p.sessionId,
    type: p.reason,
    at: p.at,
    positionMs: p.positionMs,
    durationMs: p.durationMs,
    listenedMs: p.listenedMs,
    completion,
    origin: p.origin,
  })
  db.prepare('UPDATE listening_sessions SET ended_at = max(ended_at, ?) WHERE id = ?').run(p.at, p.sessionId)
  refreshTrackStats(db, p.trackId)
  return { qualified, completion }
}

export function closeInterrupted(db: Db): number {
  const open = db.prepare('SELECT id, track_id, source_id, session_id, updated_at, listened_ms, max_position_ms, duration_ms, origin FROM plays WHERE ended_at IS NULL AND legacy = 0').all() as Array<{
    id: number
    track_id: number
    source_id: number
    session_id: number
    updated_at: number
    listened_ms: number
    max_position_ms: number
    duration_ms: number | null
    origin: string
  }>
  for (const p of open) {
    closePlay(db, {
      playId: p.id,
      trackId: p.track_id,
      sourceId: p.source_id,
      sessionId: p.session_id,
      at: p.updated_at,
      reason: 'interrupted',
      listenedMs: p.listened_ms,
      positionMs: p.max_position_ms,
      maxPositionMs: p.max_position_ms,
      durationMs: p.duration_ms,
      origin: p.origin,
    })
  }
  return open.length
}

const STATS_SELECT = `SELECT track_id,
  sum(qualified), count(*),
  sum(end_reason = 'complete'), sum(end_reason = 'skip'),
  sum(listened_ms),
  min(CASE WHEN qualified = 1 THEN started_at END),
  max(CASE WHEN qualified = 1 THEN started_at END),
  avg(completion),
  @now
  FROM plays WHERE (ended_at IS NOT NULL OR legacy = 1)`

const STATS_INSERT = `INSERT INTO track_stats (track_id, play_count, listen_count, completed_count, skip_count, total_listened_ms, first_heard_at, last_heard_at, avg_completion, updated_at)`

export function refreshTrackStats(db: Db, trackId: number): void {
  db.prepare('DELETE FROM track_stats WHERE track_id = ?').run(trackId)
  db.prepare(`${STATS_INSERT} ${STATS_SELECT} AND track_id = @trackId GROUP BY track_id`).run({ now: Date.now(), trackId })
}

export function rebuildAllStats(db: Db): number {
  db.prepare('DELETE FROM track_stats').run()
  return db.prepare(`${STATS_INSERT} ${STATS_SELECT} GROUP BY track_id`).run({ now: Date.now() }).changes
}

export function integrityCheck(): RepoIntegrity {
  const db = activeDb()
  if (!db) return { ok: false, messages: ['No database is open'], foreignKeyErrors: 0, ms: 0 }
  const t = Date.now()
  const messages = (db.pragma('integrity_check') as Array<{ integrity_check: string }>).map(r => r.integrity_check)
  const fk = (db.pragma('foreign_key_check') as unknown[]).length
  return { ok: messages.length === 1 && messages[0] === 'ok' && fk === 0, messages, foreignKeyErrors: fk, ms: Date.now() - t }
}

export interface StatsPlay {
  at: number
  videoId: string
  title: string
  artist: string
  album: string
  artwork: string
  duration: number
  seconds: number
}

export interface StatsRow {
  videoId: string
  title: string
  artist: string
  artwork: string
  plays: number
  seconds: number
}

export interface StatsSums {
  plays: number
  seconds: number
  tracks: number
  artists: number
  buckets: Array<{ key: string; seconds: number }>
  hours: Array<{ key: number; seconds: number }>
  weekdays: Array<{ key: number; seconds: number }>
  topTracks: StatsRow[]
  topArtists: StatsRow[]
  recent: StatsPlay[]
}

const QUALIFIED = `FROM plays p INDEXED BY plays_qualified_started LEFT JOIN track_sources s ON s.id = p.source_id
  WHERE p.qualified = 1 AND p.started_at >= @from`
const LOCAL = `p.started_at / 1000, 'unixepoch', 'localtime'`

export function statsSums(from: number, byMonth: boolean): StatsSums | null {
  const db = activeDb()
  if (!db) return null
  const params = { from }
  const totals = db
    .prepare(`SELECT count(*) AS plays, coalesce(sum(p.listened_ms), 0) / 1000.0 AS seconds, count(DISTINCT p.source_id) AS tracks,
      count(DISTINCT nullif(s.source_artist_text, '')) AS artists ${QUALIFIED}`)
    .get(params) as { plays: number; seconds: number; tracks: number; artists: number }
  const group = (expr: string) =>
    db.prepare(`SELECT ${expr} AS key, sum(p.listened_ms) / 1000.0 AS seconds ${QUALIFIED} GROUP BY key`).all(params) as Array<{ key: string; seconds: number }>
  const top = (by: string) =>
    (
      db
        .prepare(
          `SELECT s.provider_id AS videoId, s.source_title AS title, s.source_artist_text AS artist, max(s.artwork_url) AS artwork,
             count(*) AS plays, sum(p.listened_ms) / 1000.0 AS seconds
           ${QUALIFIED} AND ${by} IS NOT NULL AND ${by} <> '' GROUP BY ${by} ORDER BY plays DESC, seconds DESC LIMIT 10`,
        )
        .all(params) as StatsRow[]
    ).map(r => ({ ...r, artwork: r.artwork ?? '' }))
  const recent = db
    .prepare(
      `SELECT p.started_at AS at, s.provider_id AS videoId, s.source_title AS title, s.source_artist_text AS artist, s.source_album_text AS album,
         s.artwork_url AS artwork, coalesce(p.duration_ms, 0) / 1000 AS duration, p.listened_ms / 1000 AS seconds
       ${QUALIFIED} ORDER BY p.started_at DESC LIMIT 30`,
    )
    .all(params) as StatsPlay[]
  return {
    ...totals,
    buckets: group(byMonth ? `strftime('%Y-%m', ${LOCAL})` : `date(${LOCAL})`),
    hours: group(`CAST(strftime('%H', ${LOCAL}) AS INTEGER)`) as unknown as StatsSums['hours'],
    weekdays: group(`CAST(strftime('%w', ${LOCAL}) AS INTEGER)`) as unknown as StatsSums['weekdays'],
    topTracks: top('p.source_id'),
    topArtists: top('s.source_artist_text'),
    recent: recent.map(r => ({ ...r, duration: Math.round(r.duration), seconds: Math.round(r.seconds) })),
  }
}

export function firstQualifiedAt(): number {
  const db = activeDb()
  if (!db) return 0
  return (db.prepare('SELECT min(started_at) AS n FROM plays INDEXED BY plays_qualified_started WHERE qualified = 1').get() as { n: number | null }).n ?? 0
}

export function listeningDays(): string[] {
  const db = activeDb()
  if (!db) return []
  return (
    db.prepare(`SELECT DISTINCT date(${LOCAL}) AS d FROM plays p INDEXED BY plays_qualified_started WHERE p.qualified = 1 ORDER BY d`).all() as Array<{ d: string }>
  ).map(r => r.d)
}
