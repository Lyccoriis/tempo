import { app, globalShortcut, session, shell, WebContentsView, type BrowserWindow, type Rectangle } from 'electron'
import fs from 'fs'
import path from 'path'

import { readCache, writeCache } from './MusicCache'
import { findBrowser, rotateCookies, signInWithBrowser } from './YtMusicLogin'
import { flushFeel, observeFeel } from './MusicFeel'
import { musicStatsService } from './MusicStatsService'
import { parseBrowse, parseContinuation, parseSearch, type MusicPage, type MusicSearch, type MusicShelf, type MusicTrack } from './YtMusicCatalog'

const PARTITION = 'persist:ytmusic'
const HOME = 'https://music.youtube.com/'

const USER_AGENT =
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`

const COOKIE_DAYS = 365

const SCRIPT_COOKIES = /APISID$|^PREF$/

const POLL_MS = 1000

const ROTATE_MS = 60 * 60 * 1000

const FEEL_MS = 20

const SONGS_FILTER = 'EgWKAQIIAWoMEAMQBBAJEA4QChAF'

const VOLUME_STEP = 5

const SAVE_MS = 5000

const GET_QUEUE_CHUNK = 200

const SEARCH_MS = 24 * 60 * 60 * 1000

const MEDIA_KEYS: Array<[string, YtMusicCommand]> = [
  ['MediaPlayPause', { kind: 'toggle' }],
  ['MediaNextTrack', { kind: 'next' }],
  ['MediaPreviousTrack', { kind: 'previous' }],
  ['MediaStop', { kind: 'pause' }],
]

const VOLUME_KEYS: Array<[string, YtMusicCommand]> = [
  ['VolumeUp', { kind: 'volumeStep', delta: VOLUME_STEP }],
  ['VolumeDown', { kind: 'volumeStep', delta: -VOLUME_STEP }],
  ['VolumeMute', { kind: 'mute' }],
]

export interface YtMusicState {
  signedIn: boolean
  videoId: string
  title: string
  artist: string
  album: string
  artwork: string
  state: number
  position: number
  duration: number
  volume: number
  muted: boolean
  like: 'LIKE' | 'DISLIKE' | 'INDIFFERENT'
  ad: boolean
  shuffle: boolean
  repeat: 'NONE' | 'ALL' | 'ONE'
  bpm: number
}

export interface YtMusicFeel {
  bass: number
  mid: number
  high: number
  bpm: number
  beatAgo: number
  kick: number
  rise: number
  flux: number[]
  gain: number
}

export interface YtMusicQueue {
  items: MusicTrack[]
  current: number
}

interface YtMusicSession {
  ids: string[]
  current: number
  position: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: 'NONE' | 'ALL' | 'ONE'
}

export type YtMusicCommand =
  | { kind: 'play' | 'pause' | 'toggle' | 'next' | 'previous' | 'like' | 'dislike' }
  | { kind: 'seek'; seconds: number }
  | { kind: 'volume'; level: number }
  | { kind: 'volumeStep'; delta: number }
  | { kind: 'playVideo'; videoId: string; playlistId?: string }
  | { kind: 'playPlaylist'; playlistId: string }
  | { kind: 'playQueueIndex'; index: number }
  | { kind: 'shuffle' | 'repeat' | 'mute' }

const QUEUE_ROW = `(i => i && ((i.playlistPanelVideoWrapperRenderer && i.playlistPanelVideoWrapperRenderer.primaryRenderer.playlistPanelVideoRenderer) || i.playlistPanelVideoRenderer))`

const SONG_LENGTH = `(p => {
  const r = p.getPlayerResponse ? p.getPlayerResponse() : null
  const vd = r && r.videoDetails
  const whole = vd && vd.videoId === p.getVideoData().video_id ? Number(vd.lengthSeconds) || 0 : 0
  const d = p.getDuration()
  if (!whole) return d
  const s = p.getProgressState ? p.getProgressState().seekableEnd : 0
  return [d, s].find(x => Math.abs(x - whole) < 1) || whole
})`

const QUEUE_READ = `
  const qe = document.querySelector('ytmusic-player-queue')
  const qs = qe && qe.getState ? qe.getState().queue : null
  const text = t => (t && t.runs ? t.runs.map(r => r.text).join('') : '')
  const items = (qs ? qs.items : []).map(i => {
    const r = ${QUEUE_ROW}(i)
    if (!r) return null
    const runs = (r.longBylineText && r.longBylineText.runs) || []
    const cut = runs.findIndex(x => x.text === ' • ')
    const thumbs = (r.thumbnail && r.thumbnail.thumbnails) || []
    const w = r.navigationEndpoint && r.navigationEndpoint.watchEndpoint
    const albumRun = runs.find(x => x.navigationEndpoint && x.navigationEndpoint.browseEndpoint && /ALBUM/.test(JSON.stringify(x.navigationEndpoint.browseEndpoint)))
    const artistRun = runs.find(x => x.navigationEndpoint && x.navigationEndpoint.browseEndpoint && /ARTIST|USER_CHANNEL/.test(JSON.stringify(x.navigationEndpoint.browseEndpoint)))
    const artistRuns = (cut < 0 ? runs : runs.slice(0, cut)).filter(x => x.navigationEndpoint && x.navigationEndpoint.browseEndpoint && /ARTIST|USER_CHANNEL/.test(JSON.stringify(x.navigationEndpoint.browseEndpoint)))
    const cfg = w && w.watchEndpointMusicSupportedConfigs && w.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig
    return {
      videoId: r.videoId || (w && w.videoId) || '',
      title: text(r.title),
      artist: (cut < 0 ? runs : runs.slice(0, cut)).map(x => x.text).join(''),
      artistId: artistRun ? artistRun.navigationEndpoint.browseEndpoint.browseId : '',
      artists: artistRuns.map(x => ({ name: x.text, id: x.navigationEndpoint.browseEndpoint.browseId })),
      videoType: (cfg && cfg.musicVideoType) || '',
      album: albumRun ? albumRun.text : '',
      albumId: albumRun ? albumRun.navigationEndpoint.browseEndpoint.browseId : '',
      duration: text(r.lengthText),
      thumbnail: (thumbs.find(t => t.width >= 120) || thumbs[thumbs.length - 1] || {}).url || '',
      playlistId: (w && w.playlistId) || '',
    }
  }).filter(Boolean)
`

const TEMPO_READ = `(() => {
  try {
    const v = document.querySelector('#movie_player video')
    const p = document.getElementById('movie_player')
    if (!v || !p || !p.getVideoData) return 0
    let t = window.__ctTempo
    // A page that outlived an app update may hold an older tap without the analyser.
    if (t && t.v !== 6) {
      t.ctx.close()
      t = null
    }
    if (!t) {
      const ctx = new AudioContext()
      const low = ctx.createBiquadFilter()
      low.type = 'lowpass'
      low.frequency.value = 180
      const proc = ctx.createScriptProcessor(512, 1, 1)
      const silent = ctx.createGain()
      silent.gain.value = 0
      const an = ctx.createAnalyser()
      an.fftSize = 2048
      an.smoothingTimeConstant = 0.5
      low.connect(proc)
      proc.connect(silent)
      // Unsmoothed, so a note shows as a jump between two reads 11ms apart.
      const fx = ctx.createAnalyser()
      fx.fftSize = 2048
      fx.smoothingTimeConstant = 0
      an.connect(silent)
      fx.connect(silent)
      silent.connect(ctx.destination)
      t = window.__ctTempo = { v: 6, ctx, low, proc, an, fx, bins: new Uint8Array(an.frequencyBinCount), now: new Float32Array(fx.frequencyBinCount), was: new Float32Array(fx.frequencyBinCount).fill(-100), source: null, track: null, onsets: [], level: 0, votes: [], bpm: 0, beatAt: 0, id: '', hop: 512 / ctx.sampleRate, floor: Math.log(1e-4), peak: 0, rise: 0, flux: [0, 0, 0] }
      // The capture is taken before the volume, mute and fade, so how much of
      // it is heard is read off the player.
      const heard = () => {
        const p = document.getElementById('movie_player')
        if (p && p.isMuted && (p.isMuted() || p.getVolume() === 0)) return 0
        const e = window.__ctEq
        return e && typeof e.fadeGain === 'number' ? e.fadeGain : 1
      }
      t.feel = () => {
        const video = document.querySelector('#movie_player video')
        const kick = t.peak
        const rise = t.rise
        const flux = t.flux
        t.peak = 0
        t.rise = 0
        t.flux = [0, 0, 0]
        if (!t.source || !video || video.paused) return null
        t.an.getByteFrequencyData(t.bins)
        const hz = t.ctx.sampleRate / t.an.fftSize
        const band = (lo, hi) => {
          let s = 0
          let c = 0
          for (let i = Math.max(1, Math.floor(lo / hz)); i <= Math.ceil(hi / hz) && i < t.bins.length; i++) {
            s += t.bins[i]
            c++
          }
          return c ? s / c / 255 : 0
        }
        return { bass: band(30, 150), mid: band(150, 2000), high: band(2000, 10000), bpm: t.bpm, beatAgo: t.beatAt ? t.ctx.currentTime - t.beatAt : -1, kick, rise, flux, gain: heard() }
      }
      const binHz = ctx.sampleRate / fx.fftSize
      const edges = [30, 250, 4000, 12000].map(hz => Math.max(1, Math.round(hz / binHz)))
      const keep = Math.round(8 / t.hop)
      // The floor trails the bass by about 0.2s, so a kick stands out against
      // it and a held bass note sinks back to nothing.
      const trail = 1 - Math.exp(-t.hop / 0.2)
      proc.onaudioprocess = e => {
        const d = e.inputBuffer.getChannelData(0)
        let sum = 0
        for (let i = 0; i < d.length; i++) sum += d[i] * d[i]
        const rms = Math.sqrt(sum / d.length)
        const level = Math.log(1e-4 + rms)
        t.onsets.push(Math.max(0, level - t.level))
        t.level = level
        t.peak = Math.max(t.peak, rms)
        t.rise = Math.max(t.rise, level - t.floor)
        t.floor += (level - t.floor) * trail
        // Spectral flux: how many dB each bin rose since the last read, so a
        // new note counts even when the overall loudness stays the same.
        t.fx.getFloatFrequencyData(t.now)
        for (let b = 0; b < 3; b++) {
          let s = 0
          for (let i = edges[b]; i < edges[b + 1]; i++) {
            const v = Number.isFinite(t.now[i]) ? Math.max(-100, t.now[i]) : -100
            t.now[i] = v
            if (v > -80 && v > t.was[i]) s += v - t.was[i]
          }
          t.flux[b] = Math.max(t.flux[b], s / (edges[b + 1] - edges[b]))
        }
        const swap = t.was
        t.was = t.now
        t.now = swap
        if (t.onsets.length > keep) t.onsets.shift()
      }
    }
    if (t.ctx.state === 'suspended') t.ctx.resume()
    const id = p.getVideoData().video_id || ''
    if (id !== t.id) {
      t.id = id
      t.onsets = []
      t.votes = []
      t.beatAt = 0
    }
    // Each song gets a new media source, and the old capture stays live but
    // silent, so a new src means capturing again.
    if (!t.track || t.track.readyState !== 'live' || t.src !== v.src) {
      if (t.source) t.source.disconnect()
      if (t.track) t.track.stop()
      t.source = null
      t.track = null
      const stream = v.captureStream()
      if (!stream.getAudioTracks().length) return Math.round(t.bpm)
      t.src = v.src
      t.track = stream.getAudioTracks()[0]
      t.source = t.ctx.createMediaStreamSource(stream)
      t.source.connect(t.low)
      t.source.connect(t.an)
      t.source.connect(t.fx)
    }
    const f = t.onsets
    const n = f.length
    if (v.paused || n < 4 / t.hop) return Math.round(t.bpm)
    const mean = f.reduce((a, b) => a + b, 0) / n
    let best = 0
    let bestLag = 0
    for (let lag = Math.floor(60 / 180 / t.hop); lag <= Math.ceil(60 / 60 / t.hop); lag++) {
      let s = 0
      for (let i = lag; i < n; i++) s += (f[i] - mean) * (f[i - lag] - mean)
      const bpm = 60 / (lag * t.hop)
      const lean = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2))
      const score = (s / (n - lag)) * lean
      if (score > best) {
        best = score
        bestLag = lag
      }
    }
    if (bestLag) {
      t.votes.push(60 / (bestLag * t.hop))
      if (t.votes.length > 9) t.votes.shift()
      const sorted = [...t.votes].sort((a, b) => a - b)
      t.bpm = sorted[sorted.length >> 1]
    }
    // Where the beats fall: the offset whose every period back lines up with
    // the most onsets is taken as the last beat.
    if (t.bpm) {
      const period = 60 / t.bpm / t.hop
      let top = 0
      let at = -1
      for (let o = 0; o < period; o++) {
        let s = 0
        for (let k = o; k < n; k += period) s += f[n - 1 - Math.round(k)]
        if (s > top) {
          top = s
          at = o
        }
      }
      if (at >= 0) t.beatAt = t.ctx.currentTime - at * t.hop
    }
    return Math.round(t.bpm)
  } catch {
    return 0
  }
})()`

const FEEL_SCRIPT = `window.__ctTempo && window.__ctTempo.feel ? window.__ctTempo.feel() : null`

export interface YtMusicEq {
  enabled: boolean
  preamp: number
  gains: number[]
  q: number
  balance: number
  limiter: boolean
}

export interface YtMusicFade {
  seconds: number
  keepAlbums: boolean
}

const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

const FADE_MS = 50

const FADE_TICK = `() => {
  const e = window.__ctEq
  const f = e.fadeWant
  const p = document.getElementById('movie_player')
  if (!p || !p.getCurrentTime || !f.seconds) return
  const data = p.getVideoData ? p.getVideoData() : null
  const id = (data && data.video_id) || ''
  const pos = p.getCurrentTime()
  const dur = ${SONG_LENGTH}(p)
  const ad = p.classList.contains('ad-showing')
  if (id !== e.fadeId) {
    e.fadeIn = e.fadingOut && !ad
    e.fadeId = id
  }
  const qe = document.querySelector('ytmusic-player-queue')
  const qs = qe && qe.getState ? qe.getState().queue : null
  const rows = qs ? qs.items.map(${QUEUE_ROW}) : []
  const albumAt = i => {
    const r = rows[i]
    const runs = (r && r.longBylineText && r.longBylineText.runs) || []
    const a = runs.find(x => x.navigationEndpoint && x.navigationEndpoint.browseEndpoint && /ALBUM/.test(JSON.stringify(x.navigationEndpoint.browseEndpoint)))
    return a ? a.navigationEndpoint.browseEndpoint.browseId : ''
  }
  const found = rows.findIndex(r => r && r.videoId === id)
  const at = found >= 0 ? found : qs ? qs.selectedItemIndex : -1
  const album = f.keepAlbums && at >= 0 ? albumAt(at) : ''
  const sameAlbum = !!album && albumAt(at + 1) === album
  const curve = x => Math.sin(Math.min(1, Math.max(0, x)) * Math.PI / 2)
  let g = 1
  e.fadingOut = false
  if (!ad && dur > 0) {
    if (e.fadeIn && pos >= f.seconds) e.fadeIn = false
    if (e.fadeIn) g = curve(pos / f.seconds)
    const left = dur - pos
    if (left < f.seconds && !sameAlbum && !(qs && qs.repeatMode === 'ONE')) {
      g = Math.min(g, curve(left / f.seconds))
      e.fadingOut = true
    }
  }
  if (Math.abs(g - e.fadeGain) > 0.001) {
    e.out.gain.setTargetAtTime(g, e.ctx.currentTime, 0.02)
    e.fadeGain = g
  }
}`

function eqScript(eq: YtMusicEq | null, fade: YtMusicFade | null): string {
  const want = {
    enabled: eq?.enabled === true,
    preamp: finite(eq?.preamp ?? 0),
    gains: EQ_BANDS.map((_, i) => finite(eq?.gains[i] ?? 0)),
    q: Math.max(0.1, finite(eq?.q ?? 1.41)),
    balance: Math.min(1, Math.max(-1, finite(eq?.balance ?? 0))),
    limiter: eq?.limiter === true,
  }
  const fadeWant = {
    seconds: Math.min(12, Math.max(0, finite(fade?.seconds ?? 0))),
    keepAlbums: fade?.keepAlbums !== false,
  }
  return `(() => {
    const want = ${JSON.stringify(want)}
    const fadeWant = ${JSON.stringify(fadeWant)}
    const v = document.querySelector('#movie_player video')
    let e = window.__ctEq
    if (!v || (!e && !want.enabled && !fadeWant.seconds)) return false
    if (!e) {
      const ctx = new AudioContext({ latencyHint: 'playback' })
      const pre = ctx.createGain()
      const bands = ${JSON.stringify(EQ_BANDS)}.map((hz, i, all) => {
        const f = ctx.createBiquadFilter()
        f.type = i === 0 ? 'lowshelf' : i === all.length - 1 ? 'highshelf' : 'peaking'
        f.frequency.value = hz
        return f
      })
      const pan = ctx.createStereoPanner()
      const lim = ctx.createDynamicsCompressor()
      lim.threshold.value = -2
      lim.knee.value = 0
      lim.ratio.value = 20
      lim.attack.value = 0.002
      lim.release.value = 0.1
      const an = ctx.createAnalyser()
      an.fftSize = 8192
      an.smoothingTimeConstant = 0.7
      let at = pre
      for (const f of bands) {
        at.connect(f)
        at = f
      }
      at.connect(pan)
      e = window.__ctEq = { ctx, pre, bands, pan, lim, an, el: null, src: null, limiter: null, json: '' }
    }
    // After the analyser, so the spectrum shows the song and not the fade.
    if (!e.out) {
      e.an.disconnect()
      e.out = e.ctx.createGain()
      e.an.connect(e.out)
      e.out.connect(e.ctx.destination)
      Object.assign(e, { fadeTimer: null, fadeGain: 1, fadeId: '', fadeIn: false, fadingOut: false })
    }
    e.fadeWant = fadeWant
    if (fadeWant.seconds && !e.fadeTimer) e.fadeTimer = setInterval(${FADE_TICK}, ${FADE_MS})
    if (!fadeWant.seconds && e.fadeTimer) {
      clearInterval(e.fadeTimer)
      e.fadeTimer = null
      e.fadingOut = false
      e.fadeIn = false
      e.fadeGain = 1
      e.out.gain.setTargetAtTime(1, e.ctx.currentTime, 0.02)
    }
    if (e.el !== v) {
      if (e.src) e.src.disconnect()
      e.src = e.ctx.createMediaElementSource(v)
      e.src.connect(e.pre)
      e.el = v
    }
    if (e.ctx.state === 'suspended') e.ctx.resume()
    const limiter = want.enabled && want.limiter
    if (e.limiter !== limiter) {
      e.pan.disconnect()
      e.lim.disconnect()
      if (limiter) {
        e.pan.connect(e.lim)
        e.lim.connect(e.an)
      } else e.pan.connect(e.an)
      e.limiter = limiter
    }
    const json = JSON.stringify(want)
    if (json === e.json) return true
    e.json = json
    const t = e.ctx.currentTime
    const on = want.enabled
    e.pre.gain.setTargetAtTime(on ? Math.pow(10, want.preamp / 20) : 1, t, 0.015)
    e.bands.forEach((f, i) => {
      f.gain.setTargetAtTime(on ? want.gains[i] : 0, t, 0.015)
      f.Q.setTargetAtTime(want.q, t, 0.015)
    })
    e.pan.pan.setTargetAtTime(on ? want.balance : 0, t, 0.015)
    return true
  })()`
}

const SPECTRUM_BANDS = 96

const SPECTRUM_SCRIPT = `(() => {
  const e = window.__ctEq
  const t = window.__ctTempo
  const an = e ? e.an : t && t.an
  const v = document.querySelector('#movie_player video')
  if (!an || !v || v.paused) return null
  if (!an.__bins || an.__bins.length !== an.frequencyBinCount) an.__bins = new Float32Array(an.frequencyBinCount)
  const bins = an.__bins
  an.getFloatFrequencyData(bins)
  const hz = an.context.sampleRate / an.fftSize
  const out = []
  for (let i = 0; i < ${SPECTRUM_BANDS}; i++) {
    const lo = Math.floor((20 * Math.pow(1000, i / ${SPECTRUM_BANDS})) / hz)
    const hi = Math.max(lo, Math.floor((20 * Math.pow(1000, (i + 1) / ${SPECTRUM_BANDS})) / hz))
    let top = -Infinity
    for (let k = lo; k <= hi && k < bins.length; k++) if (bins[k] > top) top = bins[k]
    out.push(Math.round(Math.min(1, Math.max(0, (top + 100) / 80)) * 1000) / 1000)
  }
  return { afterEq: !!e, levels: out }
})()`

const STATE_SCRIPT = `(() => {
  ${QUEUE_READ}
  const p = document.getElementById('movie_player')
  const m = navigator.mediaSession && navigator.mediaSession.metadata
  const data = p && p.getVideoData ? p.getVideoData() : null
  const like = document.querySelector('ytmusic-player-bar ytmusic-like-button-renderer')
  const art = m && m.artwork && m.artwork.length ? m.artwork[m.artwork.length - 1].src : ''
  const ready = !!(p && p.getPlayerState)
  const state = {
    signedIn: !!(window.ytcfg && ytcfg.data_ && ytcfg.data_.LOGGED_IN),
    videoId: (data && data.video_id) || '',
    title: (m && m.title) || (data && data.title) || '',
    artist: (m && m.artist) || (data && data.author) || '',
    album: (m && m.album) || '',
    artwork: art,
    state: ready ? p.getPlayerState() : -1,
    position: ready ? p.getCurrentTime() : 0,
    duration: ready ? ${SONG_LENGTH}(p) : 0,
    volume: ready ? p.getVolume() : 0,
    muted: ready ? p.isMuted() : false,
    like: (like && like.getAttribute('like-status')) || 'INDIFFERENT',
    ad: !!(p && p.classList.contains('ad-showing')),
    shuffle: !!(qs && qs.shuffleEnabled),
    repeat: (qs && qs.repeatMode) || 'NONE',
    bpm: ${TEMPO_READ},
  }
  return { state, queue: { items, current: qs ? qs.selectedItemIndex : -1 } }
})()`

function commandScript(command: YtMusicCommand): string {
  const player = `const p = document.getElementById('movie_player'); if (!p) throw new Error('The player has not loaded yet');`
  const press = (shape: string) => `
    const bar = document.querySelector('ytmusic-player-bar');
    const root = bar && bar.querySelector('ytmusic-like-button-renderer');
    const inside = root ? [...root.querySelectorAll('button')] : [];
    const named = root && root.querySelector('#button-shape-${shape} button, yt-button-shape.${shape} button');
    const labelled = bar && [...bar.querySelectorAll('button[aria-label]')].find(x => /${shape === 'like' ? '^(like|unlike|remove like)' : '^(dislike|remove dislike)'}/i.test(x.getAttribute('aria-label')));
    const b = named || labelled || inside[${shape === 'like' ? 0 : 1}];
    if (!b) return 'No ${shape} button on the player bar, ' + (bar ? inside.length + ' buttons in its like control' : 'the player bar is not on the page');
    b.click();
    return '';`
  switch (command.kind) {
    case 'play': return `(() => { ${player} p.playVideo() })()`
    case 'pause': return `(() => { ${player} p.pauseVideo() })()`
    case 'toggle': return `(() => { ${player} p.getPlayerState() === 1 ? p.pauseVideo() : p.playVideo() })()`
    case 'next': return `(() => { ${player} p.nextVideo() })()`
    case 'previous': return `(() => { ${player} p.previousVideo() })()`
    case 'like': return `(() => { ${press('like')} })()`
    case 'dislike': return `(() => { ${press('dislike')} })()`
    case 'seek': return `(() => { ${player} p.seekTo(${finite(command.seconds)}, true) })()`
    case 'volume': return `(() => { ${player} p.setVolume(${Math.min(100, Math.max(0, finite(command.level)))}) })()`
    case 'volumeStep': return `(() => { ${player} const d = ${finite(command.delta)}; if (d > 0 && p.isMuted()) p.unMute(); p.setVolume(Math.min(100, Math.max(0, p.getVolume() + d))) })()`
    case 'playVideo': {
      const endpoint = { watchEndpoint: { videoId: command.videoId, ...(command.playlistId ? { playlistId: command.playlistId } : {}) } }
      return navigate(JSON.stringify(endpoint))
    }
    case 'playPlaylist':
      return navigate(JSON.stringify({ watchPlaylistEndpoint: { playlistId: command.playlistId } }))
    case 'playQueueIndex': {
      const index = Math.floor(finite(command.index))
      return navigate(`(() => {
        const r = ${QUEUE_ROW}(document.querySelector('ytmusic-player-queue').getState().queue.items[${index}])
        if (!r) throw new Error('No song at that place in the queue')
        return r.navigationEndpoint
      })()`)
    }
    case 'shuffle':
    case 'repeat':
      return `(() => { const b = document.querySelector('ytmusic-player-bar yt-icon-button.${command.kind}'); if (!b) throw new Error('No ${command.kind} button on the player bar'); b.click() })()`
    case 'mute': return `(() => { ${player} p.isMuted() ? p.unMute() : p.mute() })()`
  }
}

function navigate(endpoint: string): string {
  return `(async () => {
    const p = document.getElementById('movie_player')
    const before = p && p.getVideoData ? p.getVideoData().video_id : ''
    const endpoint = ${endpoint}
    const want = endpoint.watchEndpoint && endpoint.watchEndpoint.videoId
    document.querySelector('ytmusic-app').dispatchEvent(new CustomEvent('yt-navigate', { bubbles: true, detail: { endpoint } }))
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 150))
      const q = document.getElementById('movie_player')
      const id = q && q.getVideoData ? q.getVideoData().video_id : ''
      if (id && (want ? id === want : id !== before)) {
        if (q.getPlayerState() !== 1) q.playVideo()
        return
      }
    }
  })()`
}

function restoreScript(s: YtMusicSession): string {
  const chunks: string[][] = []
  for (let i = 0; i < s.ids.length; i += GET_QUEUE_CHUNK) chunks.push(s.ids.slice(i, i + GET_QUEUE_CHUNK))
  const queue = `
    p.mute()
    const items = []
    for (const r of await Promise.all([${chunks.map(ids => apiScript('music/get_queue', { videoIds: ids })).join(',')}])) {
      items.push(...(r.queueDatas || []).map(d => d.content).filter(Boolean))
    }
    if (items.length && !window.__ctActed) {
      const want = ${JSON.stringify(s.ids[s.current] ?? '')}
      const found = items.findIndex(i => ${QUEUE_ROW}(i).videoId === want)
      const at = found >= 0 ? found : Math.min(${Math.floor(finite(s.current))}, items.length - 1)
      qe.dispatch({ type: 'CLEAR' })
      qe.dispatch({ type: 'ADD_ITEMS', payload: { nextQueueItemId: qe.getState().queue.nextQueueItemId, index: 0, items, shouldAssignIds: true } })
      qe.dispatch({ type: 'SET_SHUFFLE_ENABLED', payload: ${s.shuffle === true} })
      qe.dispatch({ type: 'SET_REPEAT', payload: ${JSON.stringify(s.repeat)} })
      qe.dispatch({ type: 'SET_INDEX', payload: at })
      const id = ${QUEUE_ROW}(items[at]).videoId
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 100))
        if (window.__ctActed || (p.getVideoData().video_id === id && p.getDuration() > 0)) break
      }
      if (!window.__ctActed) {
        p.pauseVideo()
        p.seekTo(${Math.max(0, finite(s.position))}, true)
      }
    }`
  return `(async () => {
    const qe = document.querySelector('ytmusic-player-queue')
    const p = document.getElementById('movie_player')
    if (!qe || !qe.dispatch || !p || !p.getPlayerState || !window.ytcfg) return false
    ${s.ids.length ? queue : ''}
    p.setVolume(${Math.min(100, Math.max(0, finite(s.volume)))})
    ${s.muted ? 'p.mute()' : 'p.unMute()'}
    return true
  })()`
}

function apiScript(endpoint: string, body: object): string {
  return `(async () => {
    const sapisid = (document.cookie.split('; ').find(c => c.startsWith('SAPISID=')) || '').slice(8)
    const ts = Math.floor(Date.now() / 1000)
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(ts + ' ' + sapisid + ' https://music.youtube.com'))
    const hash = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
    const res = await fetch('/youtubei/v1/${endpoint}?prettyPrint=false', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Authorization: 'SAPISIDHASH ' + ts + '_' + hash, 'X-Goog-AuthUser': '0', 'X-Origin': 'https://music.youtube.com' },
      body: JSON.stringify(Object.assign({ context: ytcfg.get('INNERTUBE_CONTEXT') }, ${JSON.stringify(body)})),
    })
    if (!res.ok) throw new Error('YouTube Music replied ' + res.status)
    return res.json()
  })()`
}

function finite(n: number): number {
  if (!Number.isFinite(n)) throw new Error(`Not a number: ${n}`)
  return n
}

let mainWindow: BrowserWindow | null = null
let view: WebContentsView | null = null
let poll: NodeJS.Timeout | null = null
let feelTimer: NodeJS.Timeout | null = null
let feelVideo = ''
let rotateTimer: NodeJS.Timeout | null = null
let lastState = ''
let lastQueue = ''
let volumeKeysHeld = false
let restored = false
let current: YtMusicSession | null = null
let savedJson = ''
let savedAt = 0
let eq: YtMusicEq | null = null
let fade: YtMusicFade | null = null

function sessionFile(): string {
  return path.join(app.getPath('userData'), 'music', 'session.json')
}

function loadSession(): YtMusicSession | null {
  try {
    const s = JSON.parse(fs.readFileSync(sessionFile(), 'utf8')) as YtMusicSession
    return Array.isArray(s.ids) ? s : null
  } catch {
    return null
  }
}

function writeSession(): void {
  if (!current) return
  const json = JSON.stringify(current)
  if (json === savedJson) return
  try {
    const file = sessionFile()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(`${file}.tmp`, json)
    fs.renameSync(`${file}.tmp`, file)
    savedJson = json
    savedAt = Date.now()
  } catch (err) {
    console.error('[ytmusic] session save failed', err)
  }
}

function remember(state: YtMusicState, queue: YtMusicQueue): void {
  if (!restored || !state.videoId || state.ad) return
  const before = current
  current = {
    ids: queue.items.map(i => i.videoId),
    current: queue.current,
    position: state.position,
    volume: state.volume,
    muted: state.muted,
    shuffle: state.shuffle,
    repeat: state.repeat,
  }
  const moved = before && JSON.stringify({ ...before, position: 0 }) === JSON.stringify({ ...current, position: 0 })
  if (moved && Date.now() - savedAt < SAVE_MS) return
  writeSession()
}

async function restore(wc: Electron.WebContents): Promise<void> {
  const saved = loadSession()
  if (!saved) {
    restored = true
    return
  }
  try {
    restored = (await wc.executeJavaScript(restoreScript(saved), true)) as boolean
  } catch (err) {
    console.error('[ytmusic] session restore failed', err)
    restored = true
  }
}

export function setYtMusicWindow(win: BrowserWindow): void {
  mainWindow = win
  musicStatsService.setListener(play => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ytmusic:played', play)
  })
}

function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return host === 'music.youtube.com' || host === 'www.youtube.com'
  } catch {
    return false
  }
}

function ensureView(): WebContentsView {
  if (view && !view.webContents.isDestroyed()) return view
  if (!mainWindow) throw new Error('YouTube Music has no window yet')

  session.fromPartition(PARTITION).setUserAgent(USER_AGENT)

  view = new WebContentsView({
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  })
  view.setVisible(false)
  mainWindow.contentView.addChildView(view)

  const wc = view.webContents
  wc.setWindowOpenHandler(({ url }) => {
    if (isYouTubeUrl(url)) wc.loadURL(url)
    else if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  wc.on('did-finish-load', () => {
    restored = false
  })

  void wc.loadURL(HOME)
  startPolling()
  bindKeys(MEDIA_KEYS)
  rotateTimer ??= setInterval(() => {
    rotateCookies(PARTITION)
      .then(rotated => rotated && console.log('[ytmusic] sign in cookies rotated'))
      .catch(err => console.error('[ytmusic] cookie rotation failed', err))
  }, ROTATE_MS)
  return view
}

function bindKeys(keys: Array<[string, YtMusicCommand]>): void {
  for (const [key, command] of keys) {
    if (globalShortcut.isRegistered(key)) continue
    globalShortcut.register(key, () => void ytMusicService.command(command).catch(() => {}))
  }
}

function unbindKeys(keys: Array<[string, YtMusicCommand]>): void {
  for (const [key] of keys) globalShortcut.unregister(key)
}

function holdVolumeKeys(playing: boolean): void {
  if (playing === volumeKeysHeld) return
  volumeKeysHeld = playing
  if (playing) bindKeys(VOLUME_KEYS)
  else unbindKeys(VOLUME_KEYS)
}

function startPolling(): void {
  if (poll) return
  let busy = false
  poll = setInterval(async () => {
    if (busy || !view || view.webContents.isDestroyed() || view.webContents.isLoading()) return
    busy = true
    try {
      if (!restored) await restore(view.webContents)
      if (eq || fade) await view.webContents.executeJavaScript(eqScript(eq, fade), true).catch(err => console.error('[ytmusic] equalizer failed', err))
      const read = (await view.webContents.executeJavaScript(STATE_SCRIPT, false)) as { state: YtMusicState; queue: YtMusicQueue }
      musicStatsService.observe(read.state, read.queue)
      remember(read.state, read.queue)
      holdVolumeKeys(read.state.state === 1 && !read.state.ad)
      feelVideo = read.state.videoId
      streamFeel(read.state.state === 1 && !read.state.ad)
      if (!mainWindow || mainWindow.isDestroyed()) return
      const json = JSON.stringify(read.state)
      if (json !== lastState) {
        lastState = json
        mainWindow.webContents.send('ytmusic:state', read.state)
      }
      const queue = JSON.stringify(read.queue)
      if (queue !== lastQueue) {
        lastQueue = queue
        mainWindow.webContents.send('ytmusic:queue', read.queue)
      }
    } catch {
    } finally {
      busy = false
    }
  }, POLL_MS)
}

function streamFeel(on: boolean): void {
  if (!on) {
    if (feelTimer) clearInterval(feelTimer)
    feelTimer = null
    return
  }
  if (feelTimer) return
  let busy = false
  feelTimer = setInterval(async () => {
    if (busy || !view || view.webContents.isDestroyed() || !mainWindow || mainWindow.isDestroyed()) return
    busy = true
    try {
      const feel = (await view.webContents.executeJavaScript(FEEL_SCRIPT, false)) as YtMusicFeel | null
      if (feel) observeFeel(feelVideo, feel)
      if (feel && !mainWindow.isDestroyed()) mainWindow.webContents.send('ytmusic:feel', feel)
    } catch {
    } finally {
      busy = false
    }
  }, FEEL_MS)
}

function parseCookieHeader(header: string): Array<[string, string]> {
  return header
    .replace(/^\s*cookie:\s*/i, '')
    .split(';')
    .map(part => part.trim())
    .filter(part => part.includes('='))
    .map(part => {
      const at = part.indexOf('=')
      return [part.slice(0, at), part.slice(at + 1)]
    })
}

export const ytMusicService = {
  start(): void {
    ensureView()
  },

  show(bounds: Rectangle): void {
    const v = ensureView()
    v.setBounds(roundBounds(bounds))
    v.setVisible(true)
  },

  hide(): void {
    view?.setVisible(false)
  },

  home(): void {
    void ensureView().webContents.loadURL(HOME)
  },

  async signedIn(): Promise<boolean> {
    const cookies = await session.fromPartition(PARTITION).cookies.get({ url: HOME, name: 'SAPISID' })
    return cookies.length > 0
  },

  async importCookies(header: string): Promise<number> {
    const pairs = parseCookieHeader(header)
    if (!pairs.some(([name]) => name === 'SAPISID')) {
      throw new Error('That header has no SAPISID cookie, copy it from a signed in music.youtube.com request')
    }
    const cookies = session.fromPartition(PARTITION).cookies
    const expirationDate = Math.floor(Date.now() / 1000) + COOKIE_DAYS * 24 * 60 * 60
    for (const [name, value] of pairs) {
      const domain = name.startsWith('__Host-') ? undefined : '.youtube.com'
      const httpOnly = !SCRIPT_COOKIES.test(name)
      await cookies.set({ url: HOME, name, value, domain, path: '/', secure: true, httpOnly, expirationDate })
    }
    void ensureView().webContents.loadURL(HOME)
    return pairs.length
  },

  loginBrowser(): string | null {
    return findBrowser()?.name ?? null
  },

  async signInWithBrowser(): Promise<number> {
    const count = await signInWithBrowser(PARTITION)
    void ensureView().webContents.loadURL(HOME)
    return count
  },

  async signOut(): Promise<void> {
    await session.fromPartition(PARTITION).clearStorageData()
    if (view && !view.webContents.isDestroyed()) void view.webContents.loadURL(HOME)
  },

  async run<T>(script: string): Promise<T> {
    return ensureView().webContents.executeJavaScript(script, true) as Promise<T>
  },

  state(): YtMusicState | null {
    return lastState ? (JSON.parse(lastState) as YtMusicState) : null
  },

  queue(): YtMusicQueue | null {
    return lastQueue ? (JSON.parse(lastQueue) as YtMusicQueue) : null
  },

  async command(command: YtMusicCommand): Promise<void> {
    const failure = await ytMusicService.run<string | undefined>(`window.__ctActed = true; ${commandScript(command)}`)
    if (typeof failure === 'string' && failure) throw new Error(failure)
  },

  async setEq(next: YtMusicEq): Promise<boolean> {
    const script = eqScript(next, fade)
    eq = next
    if (!view || view.webContents.isDestroyed() || view.webContents.isLoading()) return false
    return view.webContents.executeJavaScript(script, true) as Promise<boolean>
  },

  async setFade(next: YtMusicFade): Promise<boolean> {
    const script = eqScript(eq, next)
    fade = next
    if (!view || view.webContents.isDestroyed() || view.webContents.isLoading()) return false
    return view.webContents.executeJavaScript(script, true) as Promise<boolean>
  },

  async spectrum(): Promise<{ afterEq: boolean; levels: number[] } | null> {
    if (!view || view.webContents.isDestroyed() || view.webContents.isLoading()) return null
    return view.webContents.executeJavaScript(SPECTRUM_SCRIPT, false) as Promise<{ afterEq: boolean; levels: number[] } | null>
  },

  async search(query: string): Promise<MusicSearch> {
    const q = String(query).slice(0, 200)
    const key = q.trim().toLowerCase()
    const cached = readCache<MusicSearch>('search', key)
    if (cached && Date.now() - cached.at < SEARCH_MS) return cached.value
    const [all, songs] = await Promise.all([
      ytMusicService.run(apiScript('search', { query: q })),
      ytMusicService.run(apiScript('search', { query: q, params: SONGS_FILTER })),
    ])
    const found = parseSearch(all, songs)
    writeCache('search', key, found)
    return found
  },

  async browse(browseId: string): Promise<MusicPage> {
    return parseBrowse(await ytMusicService.run(apiScript('browse', { browseId: String(browseId) })), String(browseId))
  },

  async more(token: string): Promise<Omit<MusicShelf, 'title'>> {
    return parseContinuation(await ytMusicService.run(apiScript('browse', { continuation: String(token) })))
  },

  stop(): void {
    if (poll) clearInterval(poll)
    poll = null
    if (rotateTimer) clearInterval(rotateTimer)
    rotateTimer = null
    streamFeel(false)
    flushFeel()
    lastState = ''
    lastQueue = ''
    writeSession()
    restored = false
    current = null
    savedJson = ''
    unbindKeys(MEDIA_KEYS)
    unbindKeys(VOLUME_KEYS)
    volumeKeysHeld = false
    musicStatsService.flush()
    if (view && mainWindow && !mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(view)
    if (view && !view.webContents.isDestroyed()) view.webContents.close()
    view = null
  },
}

function roundBounds(b: Rectangle): Rectangle {
  return { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) }
}
