import { app } from 'electron'
import type Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

import { onAfterOpen, setLegacyReader } from './MusicDatabase'
import { addEvent, completionOf, rebuildAllStats } from './MusicHistory'
import { ensureTrack } from './MusicRepository'
import type { RepoInfo } from './musicRepoTypes'

interface LegacyLine {
  at: number
  videoId: string
  title: string
  artist: string
  album: string
  artwork: string
  duration: number
  seconds: number
}

interface Marker {
  profileId: string
  at: number
  plays: number
}

function dir(): string {
  return path.join(app.getPath('userData'), 'music')
}

function readMarker(): Marker | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir(), 'plays.imported.json'), 'utf8')) as Marker
  } catch {
    return null
  }
}

function readLines(): LegacyLine[] {
  let text = ''
  try {
    text = fs.readFileSync(path.join(dir(), 'plays.jsonl'), 'utf8')
  } catch {
    return []
  }
  const lines: LegacyLine[] = []
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue
    try {
      const line = JSON.parse(raw) as LegacyLine
      if (line.videoId && Number.isFinite(line.at)) lines.push(line)
    } catch {
    }
  }
  return lines
}

function importInto(db: Database.Database, profileId: string): void {
  const marker = readMarker()
  if (marker && marker.profileId !== profileId) return
  const done = db.prepare("SELECT value FROM meta WHERE key = 'legacy_import'").get() as { value: string } | undefined
  if (done) return
  const lines = readLines()
  if (!lines.length) return

  const at = Date.now()
  let imported = 0
  db.transaction(() => {
    for (const line of lines) {
      const durationMs = line.duration > 0 ? line.duration * 1000 : null
      const { trackId, sourceId } = ensureTrack(
        db,
        { videoId: line.videoId, title: line.title, artistText: line.artist, artists: [], album: line.album, albumId: '', artwork: line.artwork, durationMs, kind: 'unknown' },
        'legacy',
        line.at,
      )
      const listenedMs = line.seconds * 1000
      const completion = completionOf(listenedMs, durationMs)
      const res = db
        .prepare(
          `INSERT INTO plays (track_id, source_id, started_at, updated_at, duration_ms, listened_ms, completion, end_reason, qualified, legacy, legacy_key, origin)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'legacy', 1, 1, ?, 'plays.jsonl') ON CONFLICT (legacy_key) DO NOTHING`,
        )
        .run(trackId, sourceId, line.at, line.at, durationMs, listenedMs, completion, `${line.at}:${line.videoId}`)
      if (!res.changes) continue
      imported++
      addEvent(db, {
        playId: Number(res.lastInsertRowid),
        trackId,
        sourceId,
        sessionId: null,
        type: 'legacy',
        at: line.at,
        positionMs: null,
        durationMs,
        listenedMs,
        completion,
        origin: 'plays.jsonl',
      })
    }
    rebuildAllStats(db)
    db.prepare("INSERT INTO meta (key, value) VALUES ('legacy_import', ?)").run(JSON.stringify({ at, plays: imported, lines: lines.length }))
  })()

  fs.writeFileSync(path.join(dir(), 'plays.imported.json'), JSON.stringify({ profileId, at, plays: imported } satisfies Marker, null, 2))
  console.log(`[music] imported ${imported} plays from plays.jsonl into profile ${profileId}`)
}

onAfterOpen((db, profileId) => {
  try {
    importInto(db, profileId)
  } catch (err) {
    console.error('[music] legacy import failed, plays.jsonl is untouched', err)
  }
})

setLegacyReader((db): RepoInfo['legacy'] => {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'legacy_import'").get() as { value: string } | undefined
  if (row) {
    const v = JSON.parse(row.value) as { at: number; plays: number }
    return { state: 'here', plays: v.plays, at: v.at, profileId: '' }
  }
  const marker = readMarker()
  if (marker) return { state: 'elsewhere', plays: marker.plays, at: marker.at, profileId: marker.profileId }
  return { state: 'none', plays: 0, at: 0, profileId: '' }
})
