import type { IpcMain } from 'electron'

import { musicStatsService, type MusicStatsRange } from '../services/MusicStatsService'
import { about, type AboutKind } from '../services/MusicAbout'
import { genre } from '../services/YtMusicGenre'
import { lyrics, translatedLyrics, wordTimed, type LyricsHint } from '../services/YtMusicLyrics'
import { ytMusicService, type YtMusicCommand, type YtMusicEq, type YtMusicFade } from '../services/YtMusicService'

export function registerYtMusicHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('ytmusic:start', () => ytMusicService.start())

  ipcMain.handle('ytmusic:show', (_event, bounds: { x: number; y: number; width: number; height: number }) =>
    ytMusicService.show(bounds),
  )

  ipcMain.handle('ytmusic:hide', () => ytMusicService.hide())

  ipcMain.handle('ytmusic:home', () => ytMusicService.home())

  ipcMain.handle('ytmusic:signedIn', () => ytMusicService.signedIn())

  ipcMain.handle('ytmusic:importCookies', (_event, header: string) => ytMusicService.importCookies(header))

  ipcMain.handle('ytmusic:loginBrowser', () => ytMusicService.loginBrowser())

  ipcMain.handle('ytmusic:signInWithBrowser', () => ytMusicService.signInWithBrowser())

  ipcMain.handle('ytmusic:signOut', () => ytMusicService.signOut())

  ipcMain.handle('ytmusic:state', () => ytMusicService.state())

  ipcMain.handle('ytmusic:queue', () => ytMusicService.queue())

  ipcMain.handle('ytmusic:command', (_event, command: YtMusicCommand) => ytMusicService.command(command))

  ipcMain.handle('ytmusic:eq', (_event, eq: YtMusicEq) => ytMusicService.setEq(eq))

  ipcMain.handle('ytmusic:fade', (_event, fade: YtMusicFade) => ytMusicService.setFade(fade))

  ipcMain.handle('ytmusic:genre', (_event, title: string, artist: string) => genre(title, artist))

  ipcMain.handle('ytmusic:about', (_event, kind: AboutKind, title: string, artist: string) => about(kind, title, artist))

  ipcMain.handle('ytmusic:spectrum', () => ytMusicService.spectrum())

  ipcMain.handle('ytmusic:search', (_event, query: string) => ytMusicService.search(query))

  ipcMain.handle('ytmusic:browse', (_event, browseId: string) => ytMusicService.browse(browseId))

  ipcMain.handle('ytmusic:more', (_event, token: string) => ytMusicService.more(token))

  ipcMain.handle('ytmusic:lyrics', (_event, videoId: string, hint?: LyricsHint) => lyrics(videoId, hint))

  ipcMain.handle('ytmusic:wordTimed', (_event, videoIds: string[]) => wordTimed(videoIds))

  ipcMain.handle('ytmusic:translateLyrics', (_event, videoId: string) => translatedLyrics(videoId))

  ipcMain.handle('ytmusic:stats', (_event, range: MusicStatsRange) => musicStatsService.stats(range))
}
