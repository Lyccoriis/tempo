import { nativeImage } from 'electron'
import fs from 'fs/promises'
import fss from 'fs'
import os from 'os'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { releaseMusicDb } from './MusicDatabase'

export interface Profile {
  id: string
  folder?: string
  name: string
  color?: string
  role?: string
  picture?: string
  createdAt: string
  updatedAt: string
}

export interface ProfileConfig {
  theme?: string
  accent?: string
  radius?: string
  density?: string
  monoUi?: boolean
  weekStart?: string
  calMetric?: string
  keys?: Record<string, string>
  doubleShiftFinder?: boolean
  backdrop?: Record<string, unknown>
  backdropKaraoke?: boolean
  musicEq?: Record<string, unknown>
  musicEqPresets?: unknown[]
  musicFade?: Record<string, unknown>
  panelsOff?: string[]
}

export type LayoutState = Record<string, unknown>

export interface CreateProfileOpts {
  name: string
  color?: string
  role?: string
  picture?: string | null
}

function baseDir(): string {
  return path.join(os.homedir(), 'tempo')
}

function profilesDir(): string {
  return path.join(baseDir(), 'profiles')
}

function registryPath(): string {
  return path.join(baseDir(), 'profiles.json')
}

const folders = new Map<string, string>()

function profileDir(id: string): string {
  return path.join(profilesDir(), folders.get(id) ?? id)
}

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'profile'
}

async function freeFolder(name: string): Promise<string> {
  const base = slugify(name)
  const taken = new Set(folders.values())
  let candidate = base
  let n = 2
  while (taken.has(candidate) || fss.existsSync(path.join(profilesDir(), candidate))) {
    candidate = `${base}-${n++}`
  }
  return candidate
}

function configPath(id: string): string {
  return path.join(profileDir(id), 'config.json')
}

function pictureFile(id: string): string {
  return path.join(profileDir(id), 'picture.png')
}

async function withPicture(profile: Profile): Promise<Profile> {
  try {
    const bytes = await fs.readFile(pictureFile(profile.id))
    return { ...profile, picture: `data:image/png;base64,${bytes.toString('base64')}` }
  } catch {
    const { picture: _gone, ...rest } = profile
    return rest
  }
}

async function savePicture(id: string, dataUrl: string | null): Promise<void> {
  if (!dataUrl) {
    await fs.rm(pictureFile(id), { force: true })
    return
  }
  const image = nativeImage.createFromDataURL(dataUrl)
  if (image.isEmpty()) throw new Error('That file is not a picture')
  const png = image.resize({ width: 256, height: 256, quality: 'best' }).toPNG()
  await fs.writeFile(pictureFile(id), png)
}

function layoutPath(id: string): string {
  return path.join(profileDir(id), 'layout.json')
}

async function ensureBaseDir(): Promise<void> {
  await fs.mkdir(profilesDir(), { recursive: true })
}

async function readRegistry(): Promise<Profile[]> {
  try {
    const raw = await fs.readFile(registryPath(), 'utf-8')
    const profiles = JSON.parse(raw) as Profile[]
    folders.clear()
    for (const profile of profiles) folders.set(profile.id, profile.folder ?? profile.id)
    return profiles
  } catch {
    return []
  }
}

async function writeRegistry(profiles: Profile[]): Promise<void> {
  folders.clear()
  for (const profile of profiles) folders.set(profile.id, profile.folder ?? profile.id)
  await fs.writeFile(registryPath(), JSON.stringify(profiles, null, 2), 'utf-8')
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export interface ProfilePaths {
  root: string
  config: string
  layout: string
  music: string
}

class ProfileService {
  getPaths(id: string): ProfilePaths {
    const root = profileDir(id)
    return {
      root,
      config: configPath(id),
      layout: layoutPath(id),
      music: path.join(root, 'music'),
    }
  }

  async listProfiles(): Promise<Profile[]> {
    await ensureBaseDir()
    return Promise.all((await readRegistry()).map(withPicture))
  }

  async updateProfile(
    id: string,
    patch: Partial<Pick<Profile, 'name' | 'role' | 'color'>>,
  ): Promise<Profile> {
    const profiles = await readRegistry()
    const found = profiles.find(p => p.id === id)
    if (!found) throw new Error(`Profile not found: ${id}`)

    if (patch.name !== undefined) {
      const name = patch.name.trim()
      if (!name) throw new Error('a profile needs a name')
      found.name = name
    }
    if (patch.role !== undefined) found.role = patch.role.trim()
    if (patch.color !== undefined) found.color = patch.color
    found.updatedAt = new Date().toISOString()

    await writeRegistry(profiles)
    return withPicture(found)
  }

  async setPicture(id: string, dataUrl: string | null): Promise<Profile> {
    const profiles = await readRegistry()
    const found = profiles.find(p => p.id === id)
    if (!found) throw new Error(`Profile not found: ${id}`)
    await savePicture(id, dataUrl)
    found.updatedAt = new Date().toISOString()
    await writeRegistry(profiles)
    return withPicture(found)
  }

  async createProfile(opts: CreateProfileOpts): Promise<Profile> {
    await ensureBaseDir()

    const id = uuidv4()
    const now = new Date().toISOString()
    const folder = await freeFolder(opts.name)
    folders.set(id, folder)

    const profile: Profile = {
      id,
      folder,
      name: opts.name.trim(),
      color: opts.color,
      role: opts.role?.trim(),
      createdAt: now,
      updatedAt: now,
    }

    const dir = profileDir(id)
    await fs.mkdir(path.join(dir, 'music'), { recursive: true })

    await writeJson(configPath(id), { theme: 'oled', accent: opts.color || 'blue' } as ProfileConfig)
    await writeJson(layoutPath(id), {} as LayoutState)

    const profiles = await readRegistry()
    profiles.push(profile)
    await writeRegistry(profiles)

    if (opts.picture) await savePicture(id, opts.picture)

    return withPicture(profile)
  }

  async switchProfile(id: string): Promise<void> {
    const profiles = await readRegistry()
    const exists = profiles.some((p) => p.id === id)
    if (!exists) throw new Error(`Profile not found: ${id}`)
  }

  async deleteProfile(id: string): Promise<void> {
    const profiles = await readRegistry()
    const dir = profileDir(id)

    const next = profiles.filter((p) => p.id !== id)
    if (next.length === profiles.length) {
      throw new Error(`Profile not found: ${id}`)
    }
    await writeRegistry(next)

    releaseMusicDb(id)

    try {
      await fs.rm(dir, { recursive: true, force: true })
      folders.delete(id)
    } catch (err) {
      console.error(`[ProfileService] Failed to delete folder for ${id}:`, err)
    }
  }

  async getConfig(id: string): Promise<ProfileConfig> {
    return readJson<ProfileConfig>(configPath(id), {})
  }

  async saveConfig(id: string, config: ProfileConfig): Promise<void> {
    const profiles = await readRegistry()
    const idx = profiles.findIndex((p) => p.id === id)
    if (idx !== -1) {
      profiles[idx].updatedAt = new Date().toISOString()
      await writeRegistry(profiles)
    }
    await writeJson(configPath(id), config)
  }

  async getLayout(id: string): Promise<LayoutState> {
    return readJson<LayoutState>(layoutPath(id), {})
  }

  async saveLayout(id: string, layout: LayoutState): Promise<void> {
    await writeJson(layoutPath(id), layout)
  }
}

export const profileService = new ProfileService()
