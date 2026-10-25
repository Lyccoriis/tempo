import { activeDb, onAfterOpen, onBeforeClose, write } from './MusicDatabase'
import { addEvent, closeInterrupted, closePlay, firstQualifiedAt, listeningDays, openPlay, statsSums, touchPlay, type StatsPlay } from './MusicHistory'
import { ensureTrack, type SeenTrack } from './MusicRepository'


export type MusicPlay = StatsPlay

export type MusicStatsRange = 'week' | 'month' | 'year' | 'all'

export interface MusicTopTrack {
  videoId: string
  title: string
  artist: string
  artwork: string
  plays: number
  minutes: number
}

export interface MusicTopArtist {
  name: string
  artwork: string
  plays: number
  minutes: number
}

export interface MusicStats {
  range: MusicStatsRange
  minutes: number
  plays: number
  tracks: number
  artists: number
  series: Array<{ label: string; minutes: number }>
  hours: number[]
  weekdays: number[]
  topTracks: MusicTopTrack[]
  topArtists: MusicTopArtist[]
  recent: MusicPlay[]
  streak: number
  longestStreak: number
  since: number
}

interface Observed {
  signedIn: boolean
  videoId: string
  title: string
  artist: string
  album: string
  artwork: string
  state: number
  position: number
  duration: number
  ad: boolean
  repeat: 'NONE' | 'ALL' | 'ONE'
}

interface QueueRow {
  videoId: string
  title: string
  artist: string
  artists?: Array<{ name: string; id: string }>
  album: string
  albumId: string
  thumbnail: string
  playlistId: string
  videoType?: string
}

interface ObservedQueue {
  items: QueueRow[]
  current: number
}

const MAX_TICK_MS = 3000
const END_SLACK_MS = 3000
const SEEK_MS = 3000
const TOUCH_MS = 10000
const DAY_MS = 24 * 60 * 60 * 1000

interface Current {
  videoId: string
  trackId: number
  sourceId: number
  playId: number
  sessionId: number
  origin: string
  durationMs: number | null
  listenedMs: number
  positionMs: number
  maxPositionMs: number
  state: number
  touchedAt: number
  metaKey: string
}

let current: Current | null = null
let lastTick = 0
let lastQueueKey = ''
let onPlayed: ((play: MusicPlay) => void) | null = null

function videoType(type: string | undefined): string {
  switch (type) {
    case 'MUSIC_VIDEO_TYPE_ATV': return 'song'
    case 'MUSIC_VIDEO_TYPE_OMV': return 'video'
    case 'MUSIC_VIDEO_TYPE_UGC': return 'upload'
    case 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE': return 'episode'
    default: return 'unknown'
  }
}

function parseLength(text: string): number | null {
  if (!/^\d+(:\d{1,2}){1,2}$/.test(text)) return null
  return text.split(':').reduce((acc, part) => acc * 60 + Number(part), 0) * 1000
}

function seenFromRow(row: QueueRow & { duration?: string }): SeenTrack {
  return {
    videoId: row.videoId,
    title: row.title,
    artistText: row.artist,
    artists: (row.artists ?? []).filter(a => a.name),
    album: row.album,
    albumId: row.albumId,
    artwork: row.thumbnail,
    durationMs: parseLength(row.duration ?? ''),
    kind: videoType(row.videoType),
  }
}

function seenFromState(state: Observed, row: QueueRow | undefined): SeenTrack {
  const fromRow = row ? seenFromRow(row) : null
  return {
    videoId: state.videoId,
    title: state.title || fromRow?.title || '',
    artistText: state.artist || fromRow?.artistText || '',
    artists: fromRow?.artists ?? [],
    album: state.album || fromRow?.album || '',
    albumId: fromRow?.albumId ?? '',
    artwork: state.artwork || fromRow?.artwork || '',
    durationMs: state.duration > 0 ? Math.round(state.duration * 1000) : (fromRow?.durationMs ?? null),
    kind: fromRow?.kind ?? 'unknown',
  }
}

function rowFor(queue: ObservedQueue | null, videoId: string): QueueRow | undefined {
  if (!queue) return undefined
  const at = queue.items[queue.current]
  return at?.videoId === videoId ? at : queue.items.find(r => r.videoId === videoId)
}

function end(reason: 'complete' | 'skip' | 'stop', at = Date.now()): void {
  const play = current
  current = null
  if (!play) return
  const done = write('close play', db =>
    closePlay(db, {
      playId: play.playId,
      trackId: play.trackId,
      sourceId: play.sourceId,
      sessionId: play.sessionId,
      at,
      reason,
      listenedMs: play.listenedMs,
      positionMs: play.positionMs,
      maxPositionMs: play.maxPositionMs,
      durationMs: play.durationMs,
      origin: play.origin,
    }),
  )
  if (!done?.qualified || !onPlayed) return
  const db = activeDb()
  const meta = db?.prepare('SELECT source_title, source_artist_text, source_album_text, artwork_url FROM track_sources WHERE id = ?').get(play.sourceId) as
    | { source_title: string; source_artist_text: string; source_album_text: string; artwork_url: string }
    | undefined
  onPlayed({
    at: at - play.listenedMs,
    videoId: play.videoId,
    title: meta?.source_title ?? '',
    artist: meta?.source_artist_text ?? '',
    album: meta?.source_album_text ?? '',
    artwork: meta?.artwork_url ?? '',
    duration: Math.round((play.durationMs ?? 0) / 1000),
    seconds: Math.round(play.listenedMs / 1000),
  })
}

function reasonFor(play: Current): 'complete' | 'skip' {
  return play.durationMs && play.positionMs >= play.durationMs - END_SLACK_MS ? 'complete' : 'skip'
}

function event(play: Current, type: 'pause' | 'resume' | 'seek', at: number, positionMs: number, detail?: Record<string, unknown>): void {
  write(`${type} event`, db =>
    addEvent(db, {
      playId: play.playId,
      trackId: play.trackId,
      sourceId: play.sourceId,
      sessionId: play.sessionId,
      type,
      at,
      positionMs,
      durationMs: play.durationMs,
      listenedMs: play.listenedMs,
      origin: play.origin,
      detail,
    }),
  )
}

function learnQueue(queue: ObservedQueue | null): void {
  if (!queue?.items.length) return
  const key = queue.items.map(r => `${r.videoId}${r.title ? '' : '?'}`).join()
  if (key === lastQueueKey) return
  const now = Date.now()
  const done = write('learn queue', db => {
    for (const row of queue.items) {
      if (row.videoId && row.title) ensureTrack(db, seenFromRow(row), 'queue', now, row.playlistId)
    }
    return true
  })
  if (done) lastQueueKey = key
}

function observe(state: Observed, queue: ObservedQueue | null): void {
  const now = Date.now()
  const gap = lastTick ? now - lastTick : 0
  const elapsed = Math.min(gap, MAX_TICK_MS)
  lastTick = now
  if (!activeDb()) {
    current = null
    return
  }
  if (state.ad) return
  learnQueue(queue)

  if (!state.videoId) {
    end('stop', now)
    return
  }

  const positionMs = Math.max(0, state.position * 1000)
  const durationMs = state.duration > 0 ? Math.round(state.duration * 1000) : null

  if (current && current.videoId !== state.videoId) end(reasonFor(current), now)

  if (current && state.repeat === 'ONE' && positionMs + 5000 < current.positionMs && current.durationMs && current.positionMs > current.durationMs * 0.8) {
    end('complete', now)
  }

  if (!current) {
    if (state.state !== 1) return
    const row = rowFor(queue, state.videoId)
    const seen = seenFromState(state, row)
    const origin = row?.playlistId ?? ''
    const opened = write('open play', db => {
      const { trackId, sourceId } = ensureTrack(db, seen, 'playback', now, origin)
      return { trackId, sourceId, ...openPlay(db, { trackId, sourceId, at: now, durationMs, positionMs, origin }) }
    })
    if (!opened) return
    current = {
      videoId: state.videoId,
      ...opened,
      origin,
      durationMs,
      listenedMs: 0,
      positionMs,
      maxPositionMs: positionMs,
      state: state.state,
      touchedAt: now,
      metaKey: JSON.stringify(seen),
    }
    return
  }

  const play = current
  const seen = seenFromState(state, rowFor(queue, state.videoId))
  const metaKey = JSON.stringify(seen)
  if (metaKey !== play.metaKey) {
    play.metaKey = metaKey
    write('update track', db => ensureTrack(db, seen, 'playback', now))
  }
  if (durationMs) play.durationMs = durationMs

  const expected = play.positionMs + (play.state === 1 ? gap : 0)
  if ((state.state === 1 || state.state === 2) && Math.abs(positionMs - expected) > SEEK_MS) {
    event(play, 'seek', now, positionMs, { fromMs: Math.round(play.positionMs), toMs: Math.round(positionMs) })
  }
  if (play.state === 1 && state.state === 2) event(play, 'pause', now, positionMs)
  if (play.state === 2 && state.state === 1) event(play, 'resume', now, positionMs)
  if (state.state === 1) play.listenedMs += elapsed
  if (state.state !== 3) play.state = state.state
  play.positionMs = positionMs
  play.maxPositionMs = Math.max(play.maxPositionMs, positionMs)

  if (state.state === 0) {
    end('complete', now)
    return
  }
  if (now - play.touchedAt >= TOUCH_MS) {
    play.touchedAt = now
    write('save play', db => touchPlay(db, play.playId, { at: now, listenedMs: play.listenedMs, maxPositionMs: play.maxPositionMs, durationMs: play.durationMs }))
  }
}

onBeforeClose(db => {
  const play = current
  current = null
  lastQueueKey = ''
  if (!play) return
  try {
    db.transaction(() =>
      closePlay(db, {
        playId: play.playId,
        trackId: play.trackId,
        sourceId: play.sourceId,
        sessionId: play.sessionId,
        at: Date.now(),
        reason: 'stop',
        listenedMs: play.listenedMs,
        positionMs: play.positionMs,
        maxPositionMs: play.maxPositionMs,
        durationMs: play.durationMs,
        origin: play.origin,
      }),
    )()
  } catch (err) {
    console.error('[music] could not close the play on switch', err)
  }
})

onAfterOpen(db => {
  try {
    const n = db.transaction(() => closeInterrupted(db))()
    if (n) console.log(`[music] closed ${n} play(s) cut off by the last exit`)
  } catch (err) {
    console.error('[music] closing cut off plays failed', err)
  }
})


function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function rangeStart(range: MusicStatsRange, now: number): number {
  const today = startOfDay(now)
  switch (range) {
    case 'week': return today - 6 * DAY_MS
    case 'month': return today - 29 * DAY_MS
    case 'year': {
      const d = new Date(today)
      d.setDate(1)
      d.setMonth(d.getMonth() - 11)
      return d.getTime()
    }
    case 'all': return 0
  }
}

function streaks(days: Set<string>, now: number): { streak: number; longest: number } {
  let longest = 0
  let run = 0
  let prev = ''
  for (const key of [...days].sort()) {
    const next = prev ? dayKey(new Date(`${prev}T12:00:00`).getTime() + DAY_MS) : ''
    run = key === next ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = key
  }
  let streak = 0
  let day = startOfDay(now)
  if (!days.has(dayKey(day))) day -= DAY_MS
  while (days.has(dayKey(day))) {
    streak++
    day -= DAY_MS
  }
  return { streak, longest }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function series(range: MusicStatsRange, from: number, buckets: Array<{ key: string; seconds: number }>, first: number, now: number): MusicStats['series'] {
  const byMonth = range === 'year' || range === 'all'
  const byKey = new Map(buckets.map(b => [b.key, b.seconds]))
  const out: MusicStats['series'] = []
  const label = (key: string, text: string) => out.push({ label: text, minutes: Math.round((byKey.get(key) ?? 0) / 60) })
  if (byMonth) {
    const d = new Date(range === 'all' ? first || now : from)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    for (; d.getTime() <= now; d.setMonth(d.getMonth() + 1)) {
      label(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`)
    }
  } else {
    for (let day = from; day <= now; day += DAY_MS) {
      const d = new Date(day)
      label(dayKey(day), `${MONTHS[d.getMonth()]} ${d.getDate()}`)
    }
  }
  return out
}

export const musicStatsService = {
  setListener(fn: (play: MusicPlay) => void): void {
    onPlayed = fn
  },

  observe(state: Observed, queue: ObservedQueue | null = null): void {
    try {
      observe(state, queue)
    } catch (err) {
      console.error('[music] recording failed', err)
      current = null
    }
  },

  flush(): void {
    try {
      end('stop')
    } catch (err) {
      console.error('[music] closing the play failed', err)
    }
    current = null
    lastTick = 0
  },

  stats(range: MusicStatsRange): MusicStats {
    const now = Date.now()
    const from = rangeStart(range, now)
    const sums = statsSums(from, range === 'year' || range === 'all')
    const first = firstQualifiedAt()
    const { streak, longest } = streaks(new Set(listeningDays()), now)
    const hours = new Array(24).fill(0)
    for (const h of sums?.hours ?? []) hours[h.key] = Math.round(h.seconds / 60)
    const weekdays = new Array(7).fill(0)
    for (const w of sums?.weekdays ?? []) weekdays[(w.key + 6) % 7] = Math.round(w.seconds / 60)
    const minutes = (x: { seconds: number }) => Math.round(x.seconds / 60)

    return {
      range,
      minutes: minutes(sums ?? { seconds: 0 }),
      plays: sums?.plays ?? 0,
      tracks: sums?.tracks ?? 0,
      artists: sums?.artists ?? 0,
      series: series(range, from, sums?.buckets ?? [], first, now),
      hours,
      weekdays,
      topTracks: (sums?.topTracks ?? []).map(t => ({ videoId: t.videoId, title: t.title, artist: t.artist, artwork: t.artwork, plays: t.plays, minutes: minutes(t) })),
      topArtists: (sums?.topArtists ?? []).map(a => ({ name: a.artist, artwork: a.artwork, plays: a.plays, minutes: minutes(a) })),
      recent: sums?.recent ?? [],
      streak,
      longestStreak: longest,
      since: first,
    }
  },
}
