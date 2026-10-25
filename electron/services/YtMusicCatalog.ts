
type J = any

export interface MusicTrack {
  videoId: string
  title: string
  artist: string
  artistId: string
  album: string
  albumId: string
  duration: string
  thumbnail: string
  playlistId: string
  artists?: Array<{ name: string; id: string }>
  videoType?: string
}

export type MusicCardKind = 'album' | 'playlist' | 'artist' | 'profile' | 'song' | 'video' | 'other'

export interface MusicCard {
  kind: MusicCardKind
  title: string
  subtitle: string
  thumbnail: string
  browseId: string
  playlistId: string
  videoId: string
  wide: boolean
}

export interface MusicShelf {
  title: string
  tracks: MusicTrack[]
  cards: MusicCard[]
  continuation: string
}

export interface MusicSearch {
  top: MusicCard | null
  songs: MusicTrack[]
  artists: MusicCard[]
  albums: MusicCard[]
  playlists: MusicCard[]
}

export interface MusicPage {
  title: string
  subtitle: string
  ownerId: string
  detail: string
  thumbnail: string
  playlistId: string
  shelves: MusicShelf[]
}

const SHELVES = [
  'musicCarouselShelfRenderer',
  'musicImmersiveCarouselShelfRenderer',
  'musicShelfRenderer',
  'musicPlaylistShelfRenderer',
  'gridRenderer',
  'musicCardShelfRenderer',
  'itemSectionRenderer',
]

const HEADERS = [
  'musicResponsiveHeaderRenderer',
  'musicImmersiveHeaderRenderer',
  'musicVisualHeaderRenderer',
  'musicDetailHeaderRenderer',
  'musicEditablePlaylistDetailHeaderRenderer',
]

export function text(t: J): string {
  if (!t) return ''
  if (typeof t.simpleText === 'string') return t.simpleText
  return Array.isArray(t.runs) ? t.runs.map((r: J) => r.text ?? '').join('') : ''
}

function thumbnails(node: J): J[] {
  const list =
    node?.musicThumbnailRenderer?.thumbnail?.thumbnails ??
    node?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails ??
    node?.thumbnail?.thumbnails ??
    node?.thumbnails
  return Array.isArray(list) ? list : []
}

export function sized(url: string, px: number): string {
  return /googleusercontent\.com|ggpht\.com/.test(url) ? url.replace(/=w\d+-h\d+/, `=w${px}-h${px}`) : url
}

function pickThumb(node: J, px = 226): string {
  const list = thumbnails(node)
  if (!list.length) return ''
  const fit = list.find((t: J) => (t.width ?? 0) >= px) ?? list[list.length - 1]
  return sized(String(fit.url ?? ''), px)
}

function pageType(endpoint: J): string {
  return endpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType ?? ''
}

function kindOf(type: string): MusicCardKind {
  switch (type) {
    case 'MUSIC_PAGE_TYPE_ALBUM':
    case 'MUSIC_PAGE_TYPE_AUDIOBOOK':
      return 'album'
    case 'MUSIC_PAGE_TYPE_PLAYLIST':
      return 'playlist'
    case 'MUSIC_PAGE_TYPE_ARTIST':
      return 'artist'
    case 'MUSIC_PAGE_TYPE_USER_CHANNEL':
      return 'profile'
    default:
      return 'other'
  }
}

function playOverlay(node: J): J {
  return node?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint ??
    node?.thumbnailOverlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint
}

function dropKind(runs: J[]): string {
  const joined = runs.map(r => r.text ?? '').join('')
  const parts = joined.split(' • ')
  return parts.length > 1 && runs[0] && !runs[0].navigationEndpoint ? parts.slice(1).join(' • ') : joined
}

function splitByline(runs: J[]): { artist: string; artistId: string; album: string; albumId: string; duration: string } {
  const artists: string[] = []
  let artistId = ''
  let album = ''
  let albumId = ''
  let duration = ''
  for (const run of runs) {
    const browse = run.navigationEndpoint?.browseEndpoint
    const type = pageType(browse)
    if (type === 'MUSIC_PAGE_TYPE_ARTIST' || type === 'MUSIC_PAGE_TYPE_USER_CHANNEL') {
      artists.push(run.text)
      artistId ||= browse.browseId
    } else if (type === 'MUSIC_PAGE_TYPE_ALBUM') {
      album = run.text
      albumId = browse.browseId
    } else if (/^\d+:\d\d(:\d\d)?$/.test(String(run.text).trim())) {
      duration = String(run.text).trim()
    }
  }
  return { artist: artists.join(', '), artistId, album, albumId, duration }
}

export function parseResponsive(r: J): MusicTrack | MusicCard | null {
  const cols: J[] = (r.flexColumns ?? []).map((c: J) => c.musicResponsiveListItemFlexColumnRenderer?.text)
  const title = text(cols[0])
  if (!title) return null
  const firstRun = cols[0]?.runs?.[0]
  const overlay = playOverlay(r)
  const watch = firstRun?.navigationEndpoint?.watchEndpoint ?? overlay?.watchEndpoint
  const browse = r.navigationEndpoint?.browseEndpoint
  const videoId: string = browse ? '' : (r.playlistItemData?.videoId ?? watch?.videoId ?? '')
  const thumbnail = pickThumb(r.thumbnail, 120)

  if (videoId) {
    const runs = cols.slice(1).flatMap(c => c?.runs ?? [])
    const by = splitByline(runs)
    const fixed = text(r.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text)
    return {
      videoId,
      title,
      artist: by.artist,
      artistId: by.artistId,
      album: by.album,
      albumId: by.albumId,
      duration: fixed || by.duration,
      thumbnail,
      playlistId: watch?.playlistId ?? '',
    }
  }

  if (!browse) return null
  return {
    kind: kindOf(pageType(browse)),
    title,
    subtitle: dropKind(cols.slice(1).flatMap(c => c?.runs ?? [])),
    thumbnail: pickThumb(r.thumbnail, 302),
    browseId: browse.browseId ?? '',
    playlistId: overlay?.watchPlaylistEndpoint?.playlistId ?? overlay?.watchEndpoint?.playlistId ?? '',
    videoId: '',
    wide: false,
  }
}

export function parseTwoRow(r: J): MusicCard | null {
  const title = text(r.title)
  if (!title) return null
  const nav = r.navigationEndpoint ?? {}
  const overlay = playOverlay(r)
  const thumbnail = pickThumb(r.thumbnailRenderer, 302)
  const wide = String(r.aspectRatio ?? '').includes('16_9')
  const subtitle = dropKind(r.subtitle?.runs ?? [])
  if (nav.watchEndpoint) {
    return {
      kind: wide ? 'video' : 'song',
      title,
      subtitle,
      thumbnail,
      browseId: '',
      playlistId: nav.watchEndpoint.playlistId ?? '',
      videoId: nav.watchEndpoint.videoId ?? '',
      wide,
    }
  }
  const browse = nav.browseEndpoint
  if (!browse) return null
  return {
    kind: kindOf(pageType(browse)),
    title,
    subtitle,
    thumbnail,
    browseId: browse.browseId ?? '',
    playlistId: overlay?.watchPlaylistEndpoint?.playlistId ?? overlay?.watchEndpoint?.playlistId ?? '',
    videoId: '',
    wide,
  }
}

function isTrack(item: MusicTrack | MusicCard): item is MusicTrack {
  return 'videoId' in item && !('kind' in item)
}

function parseItems(list: J[]): { tracks: MusicTrack[]; cards: MusicCard[]; continuation: string } {
  const tracks: MusicTrack[] = []
  const cards: MusicCard[] = []
  let continuation = ''
  for (const entry of list ?? []) {
    if (entry.musicResponsiveListItemRenderer) {
      const item = parseResponsive(entry.musicResponsiveListItemRenderer)
      if (item) (isTrack(item) ? tracks.push(item) : cards.push(item))
    } else if (entry.musicTwoRowItemRenderer) {
      const card = parseTwoRow(entry.musicTwoRowItemRenderer)
      if (card) cards.push(card)
    } else if (entry.continuationItemRenderer) {
      continuation = entry.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token ?? ''
    }
  }
  return { tracks, cards, continuation }
}

function shelfTitle(key: string, s: J): string {
  return (
    text(s.header?.musicCarouselShelfBasicHeaderRenderer?.title) ||
    text(s.header?.musicImmersiveCarouselShelfBasicHeaderRenderer?.title) ||
    text(s.header?.gridHeaderRenderer?.title) ||
    text(s.title) ||
    (key === 'musicPlaylistShelfRenderer' ? 'Songs' : '')
  )
}

function parseShelf(key: string, s: J): MusicShelf {
  if (key === 'musicCardShelfRenderer') {
    const nav = s.title?.runs?.[0]?.navigationEndpoint ?? s.onTap ?? {}
    const browse = nav.browseEndpoint
    const watch = nav.watchEndpoint
    const top: MusicCard = {
      kind: watch ? 'song' : kindOf(pageType(browse)),
      title: text(s.title),
      subtitle: dropKind(s.subtitle?.runs ?? []),
      thumbnail: pickThumb(s.thumbnail, 302),
      browseId: browse?.browseId ?? '',
      playlistId: watch?.playlistId ?? '',
      videoId: watch?.videoId ?? '',
      wide: false,
    }
    const items = parseItems(s.contents)
    return { title: 'Top result', tracks: items.tracks, cards: [top, ...items.cards], continuation: '' }
  }
  const items = parseItems(key === 'gridRenderer' ? s.items : s.contents)
  return { title: shelfTitle(key, s), ...items }
}

export function findShelves(json: J): MusicShelf[] {
  const shelves: MusicShelf[] = []
  const walk = (node: J) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    for (const [key, value] of Object.entries(node)) {
      if (SHELVES.includes(key)) {
        const shelf = parseShelf(key, value)
        if (shelf.tracks.length || shelf.cards.length) shelves.push(shelf)
      } else if (!HEADERS.includes(key)) {
        walk(value)
      }
    }
  }
  walk(json.contents)
  return shelves
}

function findFirst(json: J, keys: string[]): [string, J] | null {
  let found: [string, J] | null = null
  const walk = (node: J) => {
    if (found || !node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    for (const [key, value] of Object.entries(node)) {
      if (keys.includes(key)) {
        found = [key, value]
        return
      }
      walk(value)
    }
  }
  walk(json)
  return found
}

export function parseSearch(all: J, songs: J): MusicSearch {
  const shelves = findShelves(all)
  const cards = shelves.flatMap(shelf => shelf.cards)
  const top = shelves.find(shelf => shelf.title === 'Top result')?.cards[0] ?? null
  const rest = top ? cards.filter(card => card !== top) : cards
  return {
    top,
    songs: findShelves(songs).flatMap(shelf => shelf.tracks).slice(0, 20),
    artists: rest.filter(card => card.kind === 'artist'),
    albums: rest.filter(card => card.kind === 'album'),
    playlists: rest.filter(card => card.kind === 'playlist'),
  }
}

export function parseBrowse(json: J, browseId: string): MusicPage {
  const shelves = findShelves(json)
  const header = findFirst(json.header ?? json.contents, HEADERS)?.[1] ?? {}
  const firstTrack = shelves.find(s => s.tracks.length)?.tracks[0]
  const listId = findFirst(header, ['watchPlaylistEndpoint'])?.[1]?.playlistId ?? findFirst(json.contents, ['watchPlaylistEndpoint'])?.[1]?.playlistId
  const playlistId: string =
    (browseId.startsWith('VL') ? browseId.slice(2) : '') || listId || firstTrack?.playlistId || ''
  const owner = text(header.straplineTextOne)
  for (const shelf of shelves) {
    for (const track of shelf.tracks) {
      if (!track.artist) track.artist = owner
    }
  }
  return {
    title: text(header.title),
    subtitle: text(header.straplineTextOne) || text(header.subtitle),
    ownerId: findFirst(header.straplineTextOne ?? header.subtitle, ['browseEndpoint'])?.[1]?.browseId ?? '',
    detail: [text(header.subtitle), text(header.secondSubtitle)].filter(Boolean).filter(s => s !== text(header.straplineTextOne)).join(' • '),
    thumbnail: pickThumb(header.thumbnail ?? header.foregroundThumbnail, 544),
    playlistId,
    shelves,
  }
}

export function parseContinuation(json: J): Omit<MusicShelf, 'title'> {
  const items =
    json.onResponseReceivedActions?.[0]?.appendContinuationItemsAction?.continuationItems ??
    json.continuationContents?.musicPlaylistShelfContinuation?.contents ??
    json.continuationContents?.musicShelfContinuation?.contents ??
    []
  return parseItems(items)
}
