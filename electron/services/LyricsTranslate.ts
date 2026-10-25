import { flatLine, type MusixmatchTranslation } from './MusixmatchTranslate'

const ENDPOINT = 'https://translate.googleapis.com/translate_a/single?sl=auto&tl=en&dt=t&dt=rm&client='
const CLIENTS = ['gtx', 'dict-chrome-ex', 'gtx', 'dict-chrome-ex']
const RETRY_MS = 1500
const MARK = '•'
const CHUNK_CHARS = 1800

const MIN_COVERAGE = 0.6

export type TranslationSource = 'musixmatch' | 'google'

export interface MachineTranslation {
  lang: string
  translated: string[]
  romanized: string[]
}

export interface LyricsTranslation extends MachineTranslation {
  target: string
  source: TranslationSource
  machineLines: number
}

type Segment = [string | null, string | null, string | null, string | null]

async function translateChunk(lines: string[]): Promise<{ lang: string; translated: string[]; romanized: string[] }> {
  const q = lines.map(l => l.replaceAll(MARK, ' ')).join(`\n${MARK}\n`)
  let res: Response | null = null
  for (const [attempt, client] of CLIENTS.entries()) {
    if (attempt >= 2) await new Promise(r => setTimeout(r, RETRY_MS))
    res = await fetch(ENDPOINT + client, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: `q=${encodeURIComponent(q)}`,
    })
    if (res.status !== 429) break
  }
  if (!res?.ok) throw new Error(`Google Translate replied ${res?.status}, try again in a minute`)
  const data = (await res.json()) as [Segment[] | null, unknown, string]
  const segments = data[0] ?? []
  const split = (joined: string) => {
    const parts = joined.split(MARK).map(p => p.trim().replace(/^-/, ''))
    return parts.length === lines.length ? parts : lines.map(() => '')
  }
  return {
    lang: data[2] ?? '',
    translated: split(segments.filter(s => s[0] != null).map(s => s[0]).join('')),
    romanized: split(segments.filter(s => s[0] == null && s[3]).map(s => s[3]).join(' ')),
  }
}

function same(a: string, b: string): boolean {
  const flat = (s: string) => s.toLowerCase().replace(/[\s\p{P}]/gu, '')
  return flat(a) === flat(b)
}

function scriptLang(text: string, detected: string): string {
  if (/[぀-ヿ]/.test(text)) return 'ja'
  if (/[가-힯]/.test(text)) return 'ko'
  if (/\p{Script=Han}/u.test(text)) return 'zh'
  return detected
}

export async function translateLines(lines: string[]): Promise<MachineTranslation> {
  const chunks: string[][] = [[]]
  let size = 0
  for (const line of lines) {
    if (size + line.length > CHUNK_CHARS && chunks[chunks.length - 1].length) {
      chunks.push([])
      size = 0
    }
    chunks[chunks.length - 1].push(line)
    size += line.length + 3
  }
  const done = []
  for (const chunk of chunks) done.push(await translateChunk(chunk))
  const translated = done.flatMap(d => d.translated)
  const romanized = done.flatMap(d => d.romanized)
  return {
    lang: scriptLang(lines.join(''), done[0]?.lang ?? ''),
    translated: translated.map((t, i) => (same(t, lines[i]) ? '' : t)),
    romanized: romanized.map((r, i) => (same(r, lines[i]) ? '' : r)),
  }
}

export function combine(lines: string[], machine: MachineTranslation, official: MusixmatchTranslation | null, target: string): LyricsTranslation {
  const matched = official ? matchLines(lines, official.lines) : []
  const sung = lines.map(flatLine).filter(Boolean).length
  const found = matched.filter((t, i) => t !== undefined && flatLine(lines[i])).length
  if (!official || !sung || found / sung < MIN_COVERAGE) {
    return { ...machine, target, source: 'google', machineLines: 0 }
  }
  return {
    lang: scriptLang(lines.join(''), official.lang || machine.lang),
    target,
    source: 'musixmatch',
    machineLines: sung - found,
    translated: lines.map((l, i) => {
      const t = matched[i]
      return t === undefined ? (machine.translated[i] ?? '') : same(t, l) ? '' : t
    }),
    romanized: machine.romanized,
  }
}

function matchLines(lines: string[], official: Map<string, string>): Array<string | undefined> {
  const out = lines.map(l => official.get(flatLine(l)))
  for (let i = 0; i < lines.length; i++) {
    if (out[i] !== undefined || !flatLine(lines[i])) continue
    out[i] = splitMatch(lines[i], official)
    if (out[i] !== undefined) continue
    let joined = flatLine(lines[i])
    for (let j = i + 1; j < Math.min(lines.length, i + 3) && out[j] === undefined; j++) {
      joined += flatLine(lines[j])
      const t = official.get(joined)
      if (t === undefined) continue
      out[i] = t
      out.fill('', i + 1, j + 1)
      break
    }
  }
  return out
}

function splitMatch(line: string, official: Map<string, string>): string | undefined {
  const parts = line.trim().split(/\s+/).map(flatLine).filter(Boolean)
  if (parts.length < 2) return undefined
  const found: string[] = []
  for (let i = 0; i < parts.length; ) {
    let end = parts.length
    while (end > i && !official.has(parts.slice(i, end).join(''))) end--
    if (end === i) return undefined
    found.push(official.get(parts.slice(i, end).join(''))!)
    i = end
  }
  return found.length > 1 ? found.join(' ') : undefined
}
