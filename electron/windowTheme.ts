import { app, nativeTheme, type BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export type ThemeName = 'oled' | 'dark' | 'light'

export const THEME_BG: Record<ThemeName, string> = { oled: '#000000', dark: '#0a0a0a', light: '#ffffff' }

function themePath(): string {
  return path.join(app.getPath('userData'), 'theme.json')
}

export function readTheme(): ThemeName {
  try {
    const theme = JSON.parse(fs.readFileSync(themePath(), 'utf8')).theme
    if (theme === 'oled' || theme === 'dark' || theme === 'light') return theme
  } catch {}
  return 'oled'
}

export function writeTheme(theme: ThemeName): void {
  try {
    fs.writeFileSync(themePath(), JSON.stringify({ theme }))
  } catch {}
}

export function applyTheme(win: BrowserWindow, theme: ThemeName): void {
  nativeTheme.themeSource = theme === 'light' ? 'light' : 'dark'
  win.setBackgroundColor(THEME_BG[theme])
}
