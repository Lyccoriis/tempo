import { IpcMain } from 'electron'
import { profileService } from '../services/ProfileService'
import type { ProfileConfig, LayoutState, CreateProfileOpts } from '../services/ProfileService'

export function registerProfileHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('profile:list', async () => {
    return profileService.listProfiles()
  })

  ipcMain.handle('profile:create', async (_event, opts: CreateProfileOpts) => {
    if (!opts?.name?.trim()) {
      throw new Error('Profile name is required')
    }
    return profileService.createProfile(opts)
  })

  ipcMain.handle('profile:switch', async (_event, id: string) => {
    if (!id) throw new Error('id is required')
    return profileService.switchProfile(id)
  })

  ipcMain.handle(
    'profile:update',
    async (_event, id: string, patch: { name?: string; role?: string; color?: string }) => {
      return profileService.updateProfile(id, patch)
    },
  )

  ipcMain.handle('profile:delete', async (_event, id: string) => {
    if (!id) throw new Error('id is required')
    return profileService.deleteProfile(id)
  })

  ipcMain.handle('profile:paths', async (_event, id: string) => {
    return profileService.getPaths(id)
  })

  ipcMain.handle('profile:getConfig', async (_event, id: string) => {
    if (!id) throw new Error('id is required')
    return profileService.getConfig(id)
  })

  ipcMain.handle('profile:saveConfig', async (_event, id: string, config: ProfileConfig) => {
    if (!id) throw new Error('id is required')
    return profileService.saveConfig(id, config)
  })

  ipcMain.handle('profile:getLayout', async (_event, id: string) => {
    if (!id) throw new Error('id is required')
    return profileService.getLayout(id)
  })

  ipcMain.handle('profile:saveLayout', async (_event, id: string, layout: LayoutState) => {
    if (!id) throw new Error('id is required')
    return profileService.saveLayout(id, layout)
  })
}
