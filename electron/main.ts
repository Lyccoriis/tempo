import { app, BrowserWindow, ipcMain, Menu, nativeTheme, shell } from 'electron'
import path from 'node:path'
import { allowArtworkCors } from './services/ArtworkCors'
import { closeMusicDb, setMusicDbWindow } from './services/MusicDatabase'
import { stopDiscover } from './services/MusicDiscover'
import { initUpdater, stopUpdater } from './services/UpdaterService'
import { setYtMusicWindow, ytMusicService } from './services/YtMusicService'
import { registerProfileHandlers } from './ipc/profileHandlers'
import { registerUpdateHandlers } from './ipc/updateHandlers'
import { registerYtMusicHandlers } from './ipc/ytMusicHandlers'
import { registerMusicDiscoverHandlers } from './ipc/musicDiscoverHandlers'
import { registerMusicRepoHandlers } from './ipc/musicRepoHandlers'
import { applyTheme, readTheme, THEME_BG, writeTheme, type ThemeName } from './windowTheme'

const isDev = !app.isPackaged

let unbindWindow: (() => void) | null = null
let unbindArtworkCors: (() => void) | null = null

function registerShellHandlers(target: BrowserWindow): () => void {
  ipcMain.on('shell:setTitle', (_event, title: string) => {
    target.setTitle(title)
  })

  ipcMain.on('shell:setTheme', (_event, value: string) => {
    const theme: ThemeName = value === 'light' ? 'light' : value === 'dark' ? 'dark' : 'oled'
    applyTheme(target, theme)
    writeTheme(theme)
  })

  ipcMain.on('window:minimize', () => target.minimize())
  ipcMain.on('window:maximize', () => (target.isMaximized() ? target.unmaximize() : target.maximize()))
  ipcMain.on('window:close', () => target.close())
  ipcMain.handle('window:isMaximized', () => target.isMaximized())

  const sendMaximized = () => {
    if (!target.isDestroyed()) target.webContents.send('window:maximized', target.isMaximized())
  }
  target.on('maximize', sendMaximized)
  target.on('unmaximize', sendMaximized)

  ipcMain.on('shell:openExternal', (_event, url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
  })

  ipcMain.on('shell:showInFolder', (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  return () => {
    target.off('maximize', sendMaximized)
    target.off('unmaximize', sendMaximized)
  }
}

function createWindow(): BrowserWindow {
  const created = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    frame: false,
    backgroundColor: THEME_BG[readTheme()],
    ...(isDev ? { icon: path.join(__dirname, '../../build/icon.png') } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  created.once('ready-to-show', () => created.show())

  if (isDev) {
    created.webContents.openDevTools()
    created.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      if (level >= 2) console.log(`[renderer] ${message} (${sourceId}:${line})`)
    })
  }

  return created
}

function registerHandlers(): void {
  registerProfileHandlers(ipcMain)
  registerUpdateHandlers(ipcMain)
  registerYtMusicHandlers(ipcMain)
  registerMusicRepoHandlers(ipcMain)
  registerMusicDiscoverHandlers(ipcMain)
}

function stop(): void {
  stopUpdater()
  ytMusicService.stop()
  stopDiscover()
  closeMusicDb()
  unbindWindow?.()
  unbindWindow = null
  unbindArtworkCors?.()
  unbindArtworkCors = null
}

app.whenReady().then(async () => {
  if (!isDev) Menu.setApplicationMenu(null)

  nativeTheme.themeSource = readTheme() === 'light' ? 'light' : 'dark'

  registerHandlers()

  const win = createWindow()
  unbindWindow = registerShellHandlers(win)
  unbindArtworkCors = allowArtworkCors(win)
  setYtMusicWindow(win)
  setMusicDbWindow(win)
  initUpdater(win)
  app.setAppUserModelId(app.isPackaged ? 'com.tempo.player' : process.execPath)

  if (isDev) await win.loadURL('http://localhost:5173')
  else await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
})

app.on('before-quit', () => {
  stop()
})

app.on('window-all-closed', () => {
  app.quit()
})
