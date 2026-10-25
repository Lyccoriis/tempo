export type RepoEventType = 'start' | 'pause' | 'resume' | 'seek' | 'complete' | 'skip' | 'stop' | 'interrupted' | 'legacy'

export type RepoEndReason = 'complete' | 'skip' | 'stop' | 'interrupted' | 'legacy'

export type RepoSortDir = 'asc' | 'desc'

export interface RepoPage<T> {
  rows: T[]
  total: number
  offset: number
  limit: number
}

export interface RepoMigration {
  version: number
  name: string
  appliedAt: number | null
}

export type RepoStatus = 'closed' | 'open' | 'error'

export interface RepoInfo {
  status: RepoStatus
  error: string
  profileId: string
  path: string
  fileName: string
  sizeBytes: number
  walBytes: number
  shmBytes: number
  schemaVersion: number
  latestVersion: number
  migrations: RepoMigration[]
  openedAt: number
  lastWriteAt: number
  journalMode: string
  foreignKeys: boolean
  legacy: { state: 'none' | 'here' | 'elsewhere'; plays: number; at: number; profileId: string }
}

export interface RepoSummary {
  knownTracks: number
  heardTracks: number
  unheardTracks: number
  artists: number
  albums: number
  plays: number
  events: number
  listenedMs: number
  firstListenAt: number
  lastListenAt: number
  sizeBytes: number
}

export interface RepoTableCount {
  name: string
  rows: number
}

export type RepoTrackSort = 'title' | 'artist' | 'album' | 'duration' | 'known' | 'firstHeard' | 'lastHeard' | 'plays' | 'listened' | 'completion' | 'skips'

export interface RepoTrackQuery {
  search?: string
  heard?: 'all' | 'heard' | 'unheard'
  artistId?: number
  albumId?: number
  sort?: RepoTrackSort
  dir?: RepoSortDir
  offset?: number
  limit?: number
}

export interface RepoTrackRow {
  id: number
  title: string
  artist: string
  album: string
  albumId: number | null
  artwork: string
  durationMs: number | null
  knownAt: number
  knownVia: string
  firstHeardAt: number | null
  lastHeardAt: number | null
  plays: number
  listenedMs: number
  completion: number | null
  skips: number
  provider: string
  videoId: string
}

export interface RepoArtistRef {
  id: number
  name: string
  role: string
}

export interface RepoSource {
  id: number
  provider: string
  providerId: string
  kind: string
  title: string
  artistText: string
  albumText: string
  artwork: string
  durationMs: number | null
  firstSeenAt: number
  lastSeenAt: number
  preferred: boolean
}

export interface RepoExternalId {
  provider: string
  externalId: string
  confidence: number | null
  createdAt: number
}

export interface RepoFeature {
  feature: string
  valueNum: number | null
  valueText: string | null
  provider: string
  confidence: number | null
  fetchedAt: number
}

export interface RepoGenre {
  genre: string
  kind: string
  weight: number | null
  provider: string
  fetchedAt: number
}

export interface RepoTrackStats {
  plays: number
  listens: number
  completed: number
  skips: number
  listenedMs: number
  firstHeardAt: number | null
  lastHeardAt: number | null
  avgCompletion: number | null
}

export interface RepoTrackDetail {
  id: number
  title: string
  durationMs: number | null
  releaseYear: number | null
  explicit: boolean | null
  instrumental: boolean | null
  knownAt: number
  knownVia: string
  knownContext: string
  createdAt: number
  updatedAt: number
  artwork: string
  album: { id: number; title: string } | null
  artists: RepoArtistRef[]
  sources: RepoSource[]
  externalIds: RepoExternalId[]
  features: RepoFeature[]
  genres: RepoGenre[]
  stats: RepoTrackStats
}

export interface RepoEventQuery {
  from?: number
  to?: number
  types?: RepoEventType[]
  trackId?: number
  artistId?: number
  playId?: number
  search?: string
  offset?: number
  limit?: number
}

export type RepoPlayOutcome = 'all' | 'complete' | 'skip' | 'other'

export interface RepoPlayQuery {
  from?: number
  to?: number
  search?: string
  trackId?: number
  artistId?: number
  outcome?: RepoPlayOutcome
  counted?: boolean
  offset?: number
  limit?: number
}

export interface RepoPlayRow {
  id: number
  trackId: number
  title: string
  artist: string
  artwork: string
  startedAt: number
  endedAt: number | null
  durationMs: number | null
  listenedMs: number
  completion: number | null
  endReason: RepoEndReason | null
  qualified: boolean
  origin: string
  events: number
}

export interface RepoEventRow {
  id: number
  type: RepoEventType
  at: number
  playId: number
  trackId: number
  title: string
  artist: string
  artwork: string
  positionMs: number | null
  durationMs: number | null
  listenedMs: number | null
  completion: number | null
  origin: string
  detail: string
}

export type RepoArtistSort = 'name' | 'tracks' | 'heard' | 'albums' | 'plays' | 'listened' | 'firstHeard' | 'lastHeard'

export interface RepoListQuery<S extends string> {
  search?: string
  artistId?: number
  sort?: S
  dir?: RepoSortDir
  offset?: number
  limit?: number
}

export interface RepoArtistRow {
  id: number
  name: string
  artwork: string
  tracks: number
  heard: number
  albums: number
  plays: number
  listenedMs: number
  skips: number
  avgCompletion: number | null
  firstHeardAt: number | null
  lastHeardAt: number | null
  topTrack: string
}

export interface RepoArtistDetail extends RepoArtistRow {
  sortName: string
  createdAt: number
  externalIds: RepoExternalId[]
}

export type RepoAlbumSort = 'title' | 'artist' | 'year' | 'tracks' | 'heard' | 'plays' | 'listened'

export interface RepoAlbumRow {
  id: number
  title: string
  artist: string
  artwork: string
  year: number | null
  tracks: number
  heard: number
  plays: number
  listenedMs: number
  firstHeardAt: number | null
  lastHeardAt: number | null
}

export interface RepoAlbumDetail extends RepoAlbumRow {
  artists: RepoArtistRef[]
  releaseDate: string
  createdAt: number
  externalIds: RepoExternalId[]
  avgCompletion: number | null
}

export interface RepoSearchEntry {
  id: number
  query: string
  count: number
  searchedAt: number
  resultKind: string
  resultId: string
}

export interface RepoIntegrity {
  ok: boolean
  messages: string[]
  foreignKeyErrors: number
  ms: number
}

export type DiscoverAxis = 'bright' | 'energy' | 'electronic' | 'popular'

export type DiscoverAxes = Record<DiscoverAxis, number | null>

export interface DiscoverQuery {
  tags: string[]
  axes: Partial<Record<DiscoverAxis, number>>
  fresh: number
  seed: number
  limit?: number
}

export interface DiscoverTrack {
  key: string
  trackId: number | null
  videoId: string
  title: string
  artist: string
  album: string
  artwork: string
  durationMs: number | null
  heard: boolean
  plays: number
  lastHeardAt: number | null
  tags: string[]
  reason: string
  axes: DiscoverAxes
}

export interface DiscoverTag {
  tag: string
  share: number
  tracks: number
}

export interface DiscoverProgress {
  running: boolean
  done: number
  total: number
  phase: string
}

export interface DiscoverTaste {
  tags: DiscoverTag[]
  center: DiscoverAxes
  heard: number
  artists: number
  artistsTagged: number
  tracksLookedUp: number
  tracksMeasured: number
  progress: DiscoverProgress
}

export interface DiscoverRow {
  id: string
  title: string
  tracks: DiscoverTrack[]
}
