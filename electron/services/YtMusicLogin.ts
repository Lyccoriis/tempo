import { app, net, session } from 'electron'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import type { Readable, Writable } from 'stream'

interface Browser {
  name: string
  exe: string
}

export interface CdpCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  httpOnly: boolean
  secure: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

const SIGN_IN_URL = 'https://accounts.google.com/ServiceLogin?continue=https://music.youtube.com/'
const GOOGLE_COOKIE = /(^|\.)(google|youtube)\.com$/
const SAME_SITE = { Strict: 'strict', Lax: 'lax', None: 'no_restriction' } as const
const HARVEST_MS = 20000

function profileDir(): string {
  return path.join(app.getPath('userData'), 'ytm-login')
}

export function findBrowser(): Browser | null {
  const pf = process.env['ProgramFiles'] ?? 'C:\\Program Files'
  const pf86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  const local = process.env['LOCALAPPDATA'] ?? ''
  const candidates: Browser[] = [
    { name: 'Edge', exe: path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe') },
    { name: 'Edge', exe: path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe') },
    { name: 'Chrome', exe: path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe') },
    { name: 'Chrome', exe: path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe') },
    { name: 'Chrome', exe: path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe') },
  ]
  return candidates.find(b => fs.existsSync(b.exe)) ?? null
}

export function openSignIn(browser: Browser, url = SIGN_IN_URL, dir = profileDir()): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(browser.exe, [`--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-extensions', url], { stdio: 'ignore' })
    child.on('error', reject)
    child.on('exit', () => resolve())
  })
}

export function harvest(browser: Browser, dir = profileDir()): Promise<{ cookies: CdpCookie[]; product: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      browser.exe,
      [`--user-data-dir=${dir}`, '--headless=new', '--remote-debugging-pipe', '--no-first-run', '--disable-sync', '--disable-extensions', 'about:blank'],
      { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] },
    )
    const input = child.stdio[3] as Writable
    const output = child.stdio[4] as Readable
    let buffer = ''
    let done = false
    let cookies: CdpCookie[] | null = null
    let product: string | null = null
    const finish = (err: Error | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (err) {
        child.kill()
        reject(err)
        return
      }
      input.write(JSON.stringify({ id: 2, method: 'Browser.close' }) + '\0')
      resolve({ cookies: cookies ?? [], product: product ?? '' })
    }
    const timer = setTimeout(() => finish(new Error(`${browser.name} did not answer, close any ${browser.name} window left open from the sign in and try again`)), HARVEST_MS)

    child.on('error', err => finish(err))
    child.on('exit', () => finish(new Error(`${browser.name} closed before the cookies were read`)))
    output.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      let at: number
      while ((at = buffer.indexOf('\0')) >= 0) {
        const msg = JSON.parse(buffer.slice(0, at)) as { id?: number; result?: { cookies?: CdpCookie[]; product?: string }; error?: { message: string } }
        buffer = buffer.slice(at + 1)
        if (msg.id !== 1 && msg.id !== 3) continue
        if (msg.error) {
          finish(new Error(msg.error.message))
          return
        }
        if (msg.id === 1) cookies = msg.result?.cookies ?? []
        else product = msg.result?.product ?? ''
        if (cookies && product !== null) finish(null)
      }
    })
    input.write(JSON.stringify({ id: 1, method: 'Storage.getCookies' }) + '\0')
    input.write(JSON.stringify({ id: 3, method: 'Browser.getVersion' }) + '\0')
  })
}

export async function importInto(partition: string, cookies: CdpCookie[]): Promise<void> {
  const jar = session.fromPartition(partition).cookies
  await session.fromPartition(partition).clearStorageData({ storages: ['cookies'] })
  for (const c of cookies) {
    const host = c.domain.replace(/^\./, '')
    await jar.set({
      url: `https://${host}${c.path}`,
      name: c.name,
      value: c.value,
      domain: c.domain.startsWith('.') ? c.domain : undefined,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite ? SAME_SITE[c.sameSite] : 'unspecified',
      expirationDate: c.expires > 0 ? c.expires : undefined,
    })
  }
}

export async function signInWithBrowser(partition: string): Promise<number> {
  const browser = findBrowser()
  if (!browser) throw new Error('Neither Edge nor Chrome was found, use the cookie header instead')
  await openSignIn(browser)
  const cookies = (await harvest(browser)).cookies.filter(c => GOOGLE_COOKIE.test(c.domain))
  if (!cookies.some(c => c.name === 'SAPISID' && c.domain === '.youtube.com')) {
    throw new Error(`${browser.name} closed without a YouTube sign in, sign in and wait for YouTube Music to load before closing it`)
  }
  await importInto(partition, cookies)
  return cookies.length
}

export function rotateCookies(partition: string): Promise<boolean> {
  const ses = session.fromPartition(partition)
  const current = () => ses.cookies.get({ domain: '.google.com', name: '__Secure-1PSIDTS' }).then(c => c[0]?.value)
  return current().then(before => {
    if (!before) return false
    return new Promise<boolean>((resolve, reject) => {
      const req = net.request({ method: 'POST', url: 'https://accounts.google.com/RotateCookies', session: ses, useSessionCookies: true })
      req.setHeader('Content-Type', 'application/json')
      req.on('response', res => {
        res.on('data', () => {})
        res.on('end', () => void current().then(after => resolve(after !== before), reject))
      })
      req.on('error', reject)
      req.end('[000,"-0000000000000000000"]')
    })
  })
}
