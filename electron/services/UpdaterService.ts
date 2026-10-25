import { app, type BrowserWindow } from 'electron'
import type { AppUpdater } from 'electron-updater'

const OWNER = 'Lyccoriis'
const REPO = 'tempo'

const FIRST_CHECK_MS = 15_000
const CHECK_EVERY_MS = 30 * 60_000

export type UpdateStage = 'idle' | 'checking' | 'none' | 'downloading' | 'ready' | 'restarting' | 'error'

export interface UpdateState {
  stage: UpdateStage
  version: string
  currentVersion: string
  notes: string
  percent: number
  message: string
  supported: boolean
  checkedAt: string
}

let win: BrowserWindow | null = null
let firstTimer: NodeJS.Timeout | null = null
let everyTimer: NodeJS.Timeout | null = null
let busy = false
let updater: AppUpdater | null = null

let state: UpdateState = {
  stage: 'idle',
  version: '',
  currentVersion: app.getVersion(),
  notes: '',
  percent: 0,
  message: '',
  supported: false,
  checkedAt: '',
}

function push(next: Partial<UpdateState>): void {
  state = { ...state, ...next }
  if (win && !win.isDestroyed()) win.webContents.send('update:state', state)
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function releaseNotes(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(item => (item as { note?: string }).note ?? '').join('\n')
  return ''
}

function installerSupported(): boolean {
  return app.isPackaged && process.env.PORTABLE_EXECUTABLE_DIR === undefined
}

function getUpdater(): AppUpdater {
  if (updater) return updater
  const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null
  autoUpdater.setFeedURL({ provider: 'github', owner: OWNER, repo: REPO })
  autoUpdater.on('download-progress', progress => {
    push({ stage: 'downloading', percent: Math.round(progress.percent) })
  })
  updater = autoUpdater
  return autoUpdater
}

export async function checkForUpdate(): Promise<UpdateState> {
  if (!state.supported) {
    push({ stage: 'idle', message: 'Updates only run in the installed build' })
    return state
  }
  if (busy || state.stage === 'ready' || state.stage === 'restarting') return state

  busy = true
  push({ stage: 'checking', message: '' })
  try {
    const result = await getUpdater().checkForUpdates()
    if (!result || !result.isUpdateAvailable) {
      push({ stage: 'none', percent: 0 })
    } else {
      push({
        stage: 'downloading',
        version: result.updateInfo.version,
        notes: releaseNotes(result.updateInfo.releaseNotes),
        percent: 0,
      })
      await getUpdater().downloadUpdate()
      push({ stage: 'ready', percent: 100 })
    }
  } catch (err) {
    push({ stage: 'error', message: errorText(err) })
  } finally {
    busy = false
    push({ checkedAt: new Date().toISOString() })
  }
  return state
}

export function getState(): UpdateState {
  return state
}

export function installUpdate(): void {
  if (state.stage !== 'ready') return
  push({ stage: 'restarting' })
  setTimeout(() => getUpdater().quitAndInstall(true, true), 150)
}

export function initUpdater(next: BrowserWindow): void {
  win = next
  state = { ...state, currentVersion: app.getVersion(), supported: installerSupported() }
  if (!state.supported) return
  firstTimer = setTimeout(() => void checkForUpdate(), FIRST_CHECK_MS)
  everyTimer = setInterval(() => void checkForUpdate(), CHECK_EVERY_MS)
}

export function stopUpdater(): void {
  if (firstTimer) clearTimeout(firstTimer)
  if (everyTimer) clearInterval(everyTimer)
  firstTimer = null
  everyTimer = null
  updater?.removeAllListeners()
  updater = null
  win = null
}
