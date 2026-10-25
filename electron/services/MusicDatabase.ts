import type { BrowserWindow } from 'electron'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

import { LATEST_VERSION, MIGRATIONS } from './MusicMigrations'
import { profileService } from './ProfileService'
import type { RepoInfo, RepoMigration, RepoStatus } from './musicRepoTypes'

const FILE = 'music.sqlite'
const KEEP_BACKUPS = 3
const CHANGED_MS = 1500

type Db = Database.Database

let db: Db | null = null
let profileId = ''
let status: RepoStatus = 'closed'
let error = ''
let openedAt = 0
let lastWriteAt = 0
let win: BrowserWindow | null = null
let changedTimer: NodeJS.Timeout | null = null

const beforeClose: Array<(db: Db) => void> = []
const afterOpen: Array<(db: Db, profileId: string) => void> = []

export function setMusicDbWindow(next: BrowserWindow): void {
  win = next
}

export function onBeforeClose(fn: (db: Db) => void): void {
  beforeClose.push(fn)
}

export function onAfterOpen(fn: (db: Db, profileId: string) => void): void {
  afterOpen.push(fn)
}

export function musicDbPath(id: string): string {
  return path.join(profileService.getPaths(id).root, 'music', FILE)
}

export function activeDb(): Db | null {
  return status === 'open' ? db : null
}

export function activeProfileId(): string {
  return profileId
}

export function write<T>(label: string, fn: (db: Db) => T): T | null {
  const handle = activeDb()
  if (!handle) return null
  try {
    const result = handle.transaction(() => fn(handle))()
    lastWriteAt = Date.now()
    changed()
    return result
  } catch (err) {
    console.error(`[music db] ${label} failed`, err)
    return null
  }
}

export function notify(channel: string, payload: unknown): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

function changed(): void {
  if (changedTimer) return
  changedTimer = setTimeout(() => {
    changedTimer = null
    if (win && !win.isDestroyed()) win.webContents.send('musicRepo:changed')
  }, CHANGED_MS)
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function appliedVersions(handle: Db): Map<number, number> {
  handle.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)')
  const rows = handle.prepare('SELECT version, applied_at FROM schema_migrations').all() as Array<{ version: number; applied_at: number }>
  return new Map(rows.map(r => [r.version, r.applied_at]))
}

function backup(handle: Db, file: string, from: number): void {
  const dir = path.dirname(file)
  const target = path.join(dir, `music.pre-v${from + 1}-${Date.now()}.sqlite`)
  handle.exec(`VACUUM INTO ${sqlString(target)}`)
  const old = fs
    .readdirSync(dir)
    .filter(name => /^music\.pre-v\d+-\d+\.sqlite$/.test(name))
    .sort((a, b) => Number(b.split('-').pop()!.split('.')[0]) - Number(a.split('-').pop()!.split('.')[0]))
  for (const name of old.slice(KEEP_BACKUPS)) fs.rmSync(path.join(dir, name), { force: true })
}

function migrate(handle: Db, file: string): void {
  const applied = appliedVersions(handle)
  const current = Math.max(0, ...applied.keys())
  if (current > LATEST_VERSION) {
    throw new Error(`This database is at schema version ${current}, made by a newer Tempo than this one (knows ${LATEST_VERSION}). It was left untouched.`)
  }
  const pending = MIGRATIONS.filter(m => !applied.has(m.version))
  if (!pending.length) return
  const hasData = !!handle.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name NOT IN ('schema_migrations') AND name NOT LIKE 'sqlite_%'").get()
  if (hasData) backup(handle, file, current)
  for (const m of pending) {
    try {
      handle.transaction(() => {
        handle.exec(m.sql)
        handle.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(m.version, m.name, Date.now())
      })()
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err)
      throw new Error(`Migration ${m.version} (${m.name}) failed and was rolled back, the database stays at version ${Math.max(0, ...appliedVersions(handle).keys())}: ${why}`)
    }
  }
}

function lastModified(file: string): number {
  let at = 0
  for (const f of [file, `${file}-wal`]) {
    try {
      at = Math.max(at, fs.statSync(f).mtimeMs)
    } catch {
    }
  }
  return Math.round(at)
}

export function openMusicDb(id: string): RepoInfo {
  if (id === profileId && status === 'open') return musicDbInfo()
  closeMusicDb()
  profileId = id
  const file = musicDbPath(id)
  let handle: Db | null = null
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    handle = new Database(file)
    handle.pragma('journal_mode = WAL')
    handle.pragma('synchronous = NORMAL')
    handle.pragma('foreign_keys = ON')
    handle.pragma('busy_timeout = 5000')
    handle.prepare('SELECT count(*) FROM sqlite_master').get()
    migrate(handle, file)
    db = handle
    status = 'open'
    error = ''
    openedAt = Date.now()
    lastWriteAt = lastModified(file)
  } catch (err) {
    console.error(`[music db] could not open ${file}`, err)
    try {
      handle?.close()
    } catch {
    }
    db = null
    status = 'error'
    error = err instanceof Error ? err.message : String(err)
    return musicDbInfo()
  }
  for (const fn of afterOpen) {
    try {
      fn(db, id)
    } catch (err) {
      console.error('[music db] open hook failed', err)
    }
  }
  changed()
  return musicDbInfo()
}

export function closeMusicDb(): void {
  if (changedTimer) clearTimeout(changedTimer)
  changedTimer = null
  if (db) {
    for (const fn of beforeClose) {
      try {
        fn(db)
      } catch (err) {
        console.error('[music db] close hook failed', err)
      }
    }
    try {
      db.pragma('optimize')
      db.close()
    } catch (err) {
      console.error('[music db] close failed', err)
    }
  }
  db = null
  status = 'closed'
  error = ''
  profileId = ''
  openedAt = 0
}

export function releaseMusicDb(id: string): void {
  if (id === profileId) closeMusicDb()
}

export function checkpointMusicDb(id: string): void {
  if (id !== profileId || !db) return
  try {
    db.pragma('wal_checkpoint(TRUNCATE)')
  } catch (err) {
    console.error('[music db] checkpoint failed', err)
  }
}

export function setAsideMusicDb(): RepoInfo {
  if (status !== 'error' || !profileId) return musicDbInfo()
  const id = profileId
  const file = musicDbPath(id)
  const stamp = Date.now()
  for (const suffix of ['', '-wal', '-shm']) {
    const from = `${file}${suffix}`
    if (fs.existsSync(from)) fs.renameSync(from, path.join(path.dirname(file), `music.damaged-${stamp}.sqlite${suffix}`))
  }
  profileId = ''
  return openMusicDb(id)
}

function size(file: string): number {
  try {
    return fs.statSync(file).size
  } catch {
    return 0
  }
}

export function musicDbInfo(): RepoInfo {
  const file = profileId ? musicDbPath(profileId) : ''
  let applied = new Map<number, number>()
  let journalMode = ''
  let foreignKeys = false
  let legacy: RepoInfo['legacy'] = { state: 'none', plays: 0, at: 0, profileId: '' }
  if (db && status === 'open') {
    applied = new Map(
      (db.prepare('SELECT version, applied_at FROM schema_migrations').all() as Array<{ version: number; applied_at: number }>).map(r => [r.version, r.applied_at]),
    )
    journalMode = String(db.pragma('journal_mode', { simple: true }))
    foreignKeys = db.pragma('foreign_keys', { simple: true }) === 1
    legacy = legacyInfo(db)
  }
  const migrations: RepoMigration[] = MIGRATIONS.map(m => ({ version: m.version, name: m.name, appliedAt: applied.get(m.version) ?? null }))
  return {
    status,
    error,
    profileId,
    path: file,
    fileName: file ? path.basename(file) : '',
    sizeBytes: file ? size(file) : 0,
    walBytes: file ? size(`${file}-wal`) : 0,
    shmBytes: file ? size(`${file}-shm`) : 0,
    schemaVersion: Math.max(0, ...applied.keys()),
    latestVersion: LATEST_VERSION,
    migrations,
    openedAt,
    lastWriteAt,
    journalMode,
    foreignKeys,
    legacy,
  }
}

let legacyReader: ((db: Db) => RepoInfo['legacy']) | null = null

export function setLegacyReader(fn: (db: Db) => RepoInfo['legacy']): void {
  legacyReader = fn
}

function legacyInfo(handle: Db): RepoInfo['legacy'] {
  return legacyReader ? legacyReader(handle) : { state: 'none', plays: 0, at: 0, profileId: '' }
}
