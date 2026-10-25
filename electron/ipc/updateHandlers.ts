import type { IpcMain } from 'electron'

import { checkForUpdate, getState, installUpdate } from '../services/UpdaterService'

export function registerUpdateHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('update:state', () => getState())
  ipcMain.handle('update:check', () => checkForUpdate())
  ipcMain.on('update:install', () => installUpdate())
}
