import { create } from 'zustand'
import { toast } from 'sonner'
import { APP_NAME } from '@/lib/appName'
import type { BackdropSettings } from '@/lib/backdrop'
import type { EqPreset, MusicEq, MusicFade } from '@/lib/equalizer'
import { useLayoutStore } from './useLayoutStore'

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

export type ThemeChoice = 'oled' | 'dark' | 'light' | 'system'
export type Density = 'normal' | 'compact'

export interface ProfileConfig {
  theme?: ThemeChoice
  accent?: string
  radius?: string
  density?: Density
  monoUi?: boolean
  keys?: Record<string, string>
  doubleShiftFinder?: boolean
  backdrop?: Partial<BackdropSettings>
  backdropKaraoke?: boolean
  musicEq?: Partial<MusicEq>
  musicEqPresets?: EqPreset[]
  musicFade?: Partial<MusicFade>
}

export const SETTINGS_DEFAULTS = {
  theme: 'oled',
  accent: 'blue',
  radius: '0.625rem',
  density: 'normal',
  monoUi: false,
  keys: {},
  doubleShiftFinder: true,
  backdrop: {} as Partial<BackdropSettings>,
  backdropKaraoke: false,
  musicEq: {} as Partial<MusicEq>,
  musicEqPresets: [] as EqPreset[],
  musicFade: {} as Partial<MusicFade>,
} satisfies ProfileConfig

export interface CreateProfileOpts {
  name: string
  color?: string
  role?: string
  picture?: string | null
}

interface ProfileStore {
  profiles: Profile[]
  activeProfileId: string | null
  activeConfig: ProfileConfig | null
  loading: boolean
  loaded: boolean
  error: string | null

  loadProfiles: () => Promise<void>
  switchProfile: (id: string) => Promise<void>
  createProfile: (opts: CreateProfileOpts) => Promise<Profile>
  updateProfile: (id: string, patch: Partial<Pick<Profile, 'name' | 'role' | 'color'>>) => Promise<void>
  setPicture: (id: string, dataUrl: string | null) => Promise<void>
  deleteProfile: (id: string) => Promise<void>
  updateConfig: (partial: Partial<ProfileConfig>) => Promise<void>
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profiles: [],
  activeProfileId: null,
  activeConfig: null,
  loading: false,
  loaded: false,
  error: null,

  loadProfiles: async () => {
    set({ loading: true, error: null })
    try {
      const profiles: Profile[] = await window.api.profile.list()

      if (profiles.length === 0) {
        set({ profiles: [], activeProfileId: null, activeConfig: null, loading: false, loaded: true })
        return
      }

      const first = profiles[0]
      const config: ProfileConfig = await window.api.profile.getConfig(first.id)

      set({
        profiles,
        activeProfileId: first.id,
        activeConfig: config,
        loading: false,
        loaded: true,
      })

      await useLayoutStore.getState().loadLayout(first.id)
      window.api.shell.setTitle(`${APP_NAME} | ${first.name}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[useProfileStore] loadProfiles failed:', err)
      set({ loading: false, loaded: true, error: message })
    }
  },

  switchProfile: async (id: string) => {
    const { profiles, activeProfileId } = get()
    if (id === activeProfileId) return

    const profile = profiles.find(p => p.id === id)
    if (!profile) {
      console.error('[useProfileStore] switchProfile: id not found:', id)
      return
    }

    set({ error: null })
    try {
      await useLayoutStore.getState().flush()

      await window.api.profile.switch(id)
      const config: ProfileConfig = await window.api.profile.getConfig(id)

      set({ activeProfileId: id, activeConfig: config })

      await useLayoutStore.getState().loadLayout(id)
      window.api.shell.setTitle(`${APP_NAME} | ${profile.name}`)
      toast.success(`Switched to ${profile.name}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[useProfileStore] switchProfile failed:', err)
      set({ error: message })
    }
  },

  createProfile: async (opts: CreateProfileOpts) => {
    set({ error: null })
    try {
      const newProfile: Profile = await window.api.profile.create(opts)

      set(state => ({ profiles: [...state.profiles, newProfile] }))

      await get().switchProfile(newProfile.id)

      return newProfile
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[useProfileStore] createProfile failed:', err)
      set({ error: message })
      throw err
    }
  },

  updateProfile: async (id: string, patch: Partial<Pick<Profile, 'name' | 'role' | 'color'>>) => {
    set(state => ({
      profiles: state.profiles.map(p =>
        p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
      ),
    }))

    try {
      const saved = await window.api.profile.update(id, patch)
      set(state => ({
        profiles: state.profiles.map(p => (p.id === id ? saved : p)),
      }))
      if (get().activeProfileId === id) {
        window.api.shell.setTitle(`${APP_NAME} | ${saved.name}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[useProfileStore] updateProfile failed:', err)
      set({ error: message })
      await get().loadProfiles()
    }
  },

  setPicture: async (id: string, dataUrl: string | null) => {
    try {
      const saved: Profile = await window.api.profile.setPicture(id, dataUrl)
      set(state => ({ profiles: state.profiles.map(p => (p.id === id ? saved : p)) }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[useProfileStore] setPicture failed:', err)
      set({ error: message })
      throw err
    }
  },

  deleteProfile: async (id: string) => {
    const { profiles, activeProfileId } = get()
    set({ error: null })

    try {
      await window.api.profile.delete(id)

      const remaining = profiles.filter(p => p.id !== id)
      set({ profiles: remaining })

      if (activeProfileId === id) {
        if (remaining.length > 0) {
          await get().switchProfile(remaining[0].id)
        } else {
          set({ activeProfileId: null, activeConfig: null })
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[useProfileStore] deleteProfile failed:', err)
      set({ error: message })
      throw err
    }
  },

  updateConfig: async (partial: Partial<ProfileConfig>) => {
    const { activeProfileId, activeConfig } = get()
    if (!activeProfileId) return

    const next: ProfileConfig = { ...activeConfig, ...partial }

    set({ activeConfig: next })

    try {
      await window.api.profile.saveConfig(activeProfileId, next)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[useProfileStore] updateConfig failed:', err)
      set({ error: message })
      set({ activeConfig })
    }
  },
}))
