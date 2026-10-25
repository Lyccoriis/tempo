import type Database from 'better-sqlite3'

import { onBeforeClose, write } from './MusicDatabase'
import { PROVIDER } from './MusicRepository'

type Db = Database.Database

export interface FeelSample {
  bass: number
  mid: number
  high: number
  bpm: number
  rise: number
  gain: number
}

const AUDIO = 'audio'
const MIN_SAMPLES = 500
const MAX_SAMPLES = 20000

interface Acc {
  videoId: string
  n: number
  bass: number
  mid: number
  high: number
  rise: number
  bpm: number
}

let acc: Acc | null = null

function fresh(videoId: string): Acc {
  return { videoId, n: 0, bass: 0, mid: 0, high: 0, rise: 0, bpm: 0 }
}

function save(db: Db, a: Acc): void {
  if (a.n < MIN_SAMPLES) return
  const src = db.prepare('SELECT track_id FROM track_sources WHERE provider = ? AND provider_id = ?').get(PROVIDER, a.videoId) as { track_id: number } | undefined
  if (!src) return
  const rows = db.prepare('SELECT feature, value_num FROM track_features WHERE track_id = ? AND provider = ?').all(src.track_id, AUDIO) as Array<{ feature: string; value_num: number | null }>
  const old = new Map(rows.map(r => [r.feature, r.value_num ?? 0]))
  const n0 = Math.min(old.get('samples') ?? 0, MAX_SAMPLES)
  const total = a.bass + a.mid + a.high
  const next: Record<string, number> = {
    brightness: total > 0 ? a.high / total : 0,
    punch: a.rise / a.n,
    loudness: total / a.n / 3,
  }
  const now = Date.now()
  const put = db.prepare(
    `INSERT INTO track_features (track_id, feature, value_num, provider, fetched_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (track_id, feature, provider) DO UPDATE SET value_num = excluded.value_num, updated_at = excluded.updated_at`,
  )
  for (const [feature, value] of Object.entries(next)) {
    const merged = old.has(feature) ? (old.get(feature)! * n0 + value * a.n) / (n0 + a.n) : value
    put.run(src.track_id, feature, merged, AUDIO, now, now)
  }
  put.run(src.track_id, 'samples', n0 + a.n, AUDIO, now, now)
  if (a.bpm > 0) put.run(src.track_id, 'bpm', Math.round(a.bpm), AUDIO, now, now)
}

export function flushFeel(): void {
  const a = acc
  acc = null
  if (a && a.n >= MIN_SAMPLES) write('save feel', db => save(db, a))
}

export function observeFeel(videoId: string, feel: FeelSample): void {
  if (!videoId) return
  if (acc?.videoId !== videoId) {
    flushFeel()
    acc = fresh(videoId)
  }
  if (feel.gain < 0.9 || feel.bass + feel.mid + feel.high < 0.05) return
  acc.n++
  acc.bass += feel.bass
  acc.mid += feel.mid
  acc.high += feel.high
  acc.rise += Math.max(0, feel.rise)
  if (feel.bpm > 0) acc.bpm = feel.bpm
}

onBeforeClose(db => {
  const a = acc
  acc = null
  if (!a) return
  try {
    db.transaction(() => save(db, a))()
  } catch (err) {
    console.error('[music feel] save on close failed', err)
  }
})
