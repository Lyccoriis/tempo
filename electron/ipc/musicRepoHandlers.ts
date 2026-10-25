import type { IpcMain } from 'electron'

import { musicDbInfo, openMusicDb, setAsideMusicDb, write } from '../services/MusicDatabase'
import { integrityCheck, rebuildAllStats } from '../services/MusicHistory'
import '../services/MusicLegacy'
import { fetchArtwork } from '../services/ArtworkCors'
import { profileService } from '../services/ProfileService'
import {
  clearSearch,
  getAlbum,
  getArtist,
  getSummary,
  getTrack,
  getTrackByVideoId,
  getTrackHistory,
  listAlbums,
  listArtists,
  listEvents,
  listPlays,
  listTracks,
  recordSearch,
  searchHistory,
  tableCounts,
} from '../services/MusicRepository'
import type { RepoAlbumSort, RepoArtistSort, RepoEventQuery, RepoListQuery, RepoPlayQuery, RepoTrackQuery } from '../services/musicRepoTypes'

export function registerMusicRepoHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('musicRepo:open', async (_event, profileId: string) => {
    const id = String(profileId ?? '')
    if (!(await profileService.listProfiles()).some(p => p.id === id)) throw new Error(`Profile not found: ${id}`)
    return openMusicDb(id)
  })

  ipcMain.handle('musicRepo:info', () => musicDbInfo())

  ipcMain.handle('musicRepo:summary', () => {
    const info = musicDbInfo()
    return getSummary(info.sizeBytes + info.walBytes)
  })

  ipcMain.handle('musicRepo:tables', () => tableCounts())

  ipcMain.handle('musicRepo:tracks', (_event, query: RepoTrackQuery) => listTracks(query ?? {}))

  ipcMain.handle('musicRepo:track', (_event, id: number) => getTrack(Number(id)))

  ipcMain.handle('musicRepo:trackByVideo', (_event, videoId: string) => getTrackByVideoId(String(videoId ?? '')))

  ipcMain.handle('musicRepo:trackHistory', (_event, id: number, offset: number, limit: number) => getTrackHistory(Number(id), offset, limit))

  ipcMain.handle('musicRepo:artists', (_event, query: RepoListQuery<RepoArtistSort>) => listArtists(query ?? {}))

  ipcMain.handle('musicRepo:artist', (_event, id: number) => getArtist(Number(id)))

  ipcMain.handle('musicRepo:albums', (_event, query: RepoListQuery<RepoAlbumSort>) => listAlbums(query ?? {}))

  ipcMain.handle('musicRepo:album', (_event, id: number) => getAlbum(Number(id)))

  ipcMain.handle('musicRepo:events', (_event, query: RepoEventQuery) => listEvents(query ?? {}))

  ipcMain.handle('musicRepo:plays', (_event, query: RepoPlayQuery) => listPlays(query ?? {}))

  ipcMain.handle('musicRepo:searchHistory', (_event, limit: number) => searchHistory(Number(limit) || 50))

  ipcMain.handle('musicRepo:recordSearch', (_event, query: string, resultKind?: string, resultId?: string) => {
    write('record search', db => recordSearch(db, String(query ?? ''), String(resultKind ?? ''), String(resultId ?? '')))
  })

  ipcMain.handle('musicRepo:clearSearch', (_event, id?: number) => {
    write('clear search', db => clearSearch(db, id == null ? undefined : Number(id)))
  })

  ipcMain.handle('musicRepo:integrity', () => integrityCheck())

  ipcMain.handle('musicRepo:rebuildStats', () => {
    const t = Date.now()
    const tracks = write('rebuild stats', db => rebuildAllStats(db))
    if (tracks == null) throw new Error('The Music database is not open')
    return { tracks, ms: Date.now() - t }
  })

  ipcMain.handle('musicRepo:setAside', () => setAsideMusicDb())

  ipcMain.handle('musicRepo:artwork', (_event, url: string) => fetchArtwork(url))
}
