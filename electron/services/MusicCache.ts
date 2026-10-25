import { app } from 'electron'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const MAX_FILES = 500

function dir(kind: string): string {
  return path.join(app.getPath('userData'), 'music', 'cache', kind)
}

function file(kind: string, key: string): string {
  return path.join(dir(kind), `${crypto.createHash('sha1').update(key).digest('hex')}.json`)
}

export function readCache<T>(kind: string, key: string): { value: T; at: number } | null {
  try {
    const entry = JSON.parse(fs.readFileSync(file(kind, key), 'utf8')) as { value: T; at: number }
    return 'value' in entry ? entry : null
  } catch {
    return null
  }
}

export function writeCache<T>(kind: string, key: string, value: T): void {
  try {
    fs.mkdirSync(dir(kind), { recursive: true })
    fs.writeFileSync(file(kind, key), JSON.stringify({ value, at: Date.now() }))
    prune(dir(kind))
  } catch (err) {
    console.error('[music] cache write failed', err)
  }
}

function prune(folder: string): void {
  const names = fs.readdirSync(folder)
  if (names.length <= MAX_FILES) return
  const oldest = names
    .map(name => ({ name, at: fs.statSync(path.join(folder, name)).mtimeMs }))
    .sort((a, b) => a.at - b.at)
  for (const { name } of oldest.slice(0, names.length - Math.floor(MAX_FILES * 0.8))) {
    fs.rmSync(path.join(folder, name), { force: true })
  }
}
