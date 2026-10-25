import type { IpcMain } from 'electron'

import { discoverFresh, discoverLibrary, discoverProgress, discoverTaste, enrich, findOnYouTube, homeRows } from '../services/MusicDiscover'
import type { DiscoverQuery } from '../services/musicRepoTypes'

function query(q: DiscoverQuery): DiscoverQuery {
  return {
    tags: Array.isArray(q?.tags) ? q.tags.map(String).slice(0, 20) : [],
    axes: q?.axes && typeof q.axes === 'object' ? q.axes : {},
    fresh: Number(q?.fresh) || 0,
    seed: Number(q?.seed) || 0,
    limit: q?.limit == null ? undefined : Number(q.limit),
  }
}

export function registerMusicDiscoverHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('musicDiscover:taste', () => discoverTaste())

  ipcMain.handle('musicDiscover:enrich', () => {
    enrich()
    return discoverProgress()
  })

  ipcMain.handle('musicDiscover:library', (_event, q: DiscoverQuery) => discoverLibrary(query(q)))

  ipcMain.handle('musicDiscover:fresh', (_event, q: DiscoverQuery) => discoverFresh(query(q)))

  ipcMain.handle('musicDiscover:find', (_event, title: string, artist: string) => findOnYouTube(String(title ?? ''), String(artist ?? '')))

  ipcMain.handle('musicDiscover:home', () => homeRows())
}
