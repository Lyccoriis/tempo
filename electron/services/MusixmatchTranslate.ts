import crypto from 'crypto'
import { readCache, writeCache } from './MusicCache'

const API = 'https://apic.musixmatch.com/ws/1.1/'
const APP_ID = 'mac-ios-v2.0'
const AGENT = 'Musixmatch/7.12.0 (iPhone; iOS 16.0; Scale/3.00)'
const TOKEN_CACHE = 'musixmatch'
const COOLDOWN_MS = 10 * 60 * 1000

let blockedUntil = 0

export class MusixmatchUnavailable extends Error {}

export interface MusixmatchTranslation {
  lang: string
  lines: Map<string, string>
}

interface Reply<T> {
  message?: { header?: { status_code?: number; hint?: string }; body?: T }
}

export function flatLine(s: string): string {
  return s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '')
}

async function request<T>(method: string, params: Record<string, string>): Promise<{ status: number; hint: string; body?: T }> {
  const query = new URLSearchParams({ format: 'json', app_id: APP_ID, ...params })
  const res = await fetch(`${API}${method}?${query}`, { headers: { 'User-Agent': AGENT } })
  if (!res.ok) throw new MusixmatchUnavailable(`Musixmatch replied ${res.status}`)
  const reply = (await res.json()) as Reply<T>
  return { status: reply.message?.header?.status_code ?? 0, hint: reply.message?.header?.hint ?? '', body: reply.message?.body }
}

async function token(fresh: boolean): Promise<string> {
  const kept = fresh ? '' : readCache<string>(TOKEN_CACHE, 'token')?.value
  if (kept) return kept
  if (Date.now() < blockedUntil) throw new MusixmatchUnavailable('Musixmatch is asking for a captcha')
  const { status, body } = await request<{ user_token?: string }>('token.get', { guid: crypto.randomUUID() })
  const value = body?.user_token ?? ''
  if (status !== 200 || !value || /^0+$/.test(value) || value.startsWith('UpgradeOnly')) {
    blockedUntil = Date.now() + COOLDOWN_MS
    throw new MusixmatchUnavailable('Musixmatch is asking for a captcha')
  }
  writeCache(TOKEN_CACHE, 'token', value)
  return value
}

async function call<T>(method: string, params: Record<string, string>): Promise<T | null> {
  for (const fresh of [false, true]) {
    const reply = await request<T>(method, { ...params, usertoken: await token(fresh) })
    if (reply.status === 200) return reply.body ?? null
    if (reply.status === 404) return null
    if (reply.status !== 401 || reply.hint === 'captcha') break
  }
  throw new MusixmatchUnavailable(`Musixmatch refused ${method}`)
}

export async function findCommontrack(title: string, artist: string): Promise<string> {
  const body = await call<{ track?: { commontrack_id?: number } }>('matcher.track.get', { q_track: title, q_artist: artist })
  return body?.track?.commontrack_id ? String(body.track.commontrack_id) : ''
}

interface TranslationEntry {
  translation?: { matched_line?: string; snippet?: string; description?: string; language_from?: string }
}

export async function musixmatchTranslation(commontrackId: string, target: string): Promise<MusixmatchTranslation | null> {
  const body = await call<{ translations_list?: TranslationEntry[] }>('crowd.track.translations.get', {
    commontrack_id: commontrackId,
    selected_language: target,
    part: 'user',
    translation_fields_set: 'minimal',
  })
  const lines = new Map<string, string>()
  let lang = ''
  for (const { translation: t } of body?.translations_list ?? []) {
    const original = flatLine(t?.matched_line || t?.snippet || '')
    if (!original || !t?.description?.trim()) continue
    lines.set(original, t.description.trim())
    lang ||= t.language_from ?? ''
  }
  return lines.size ? { lang, lines } : null
}
