import type { DiscoverAxis } from './musicRepo';

export type PanelId = 'music' | 'settings';

export type SettingsSection = 'appearance' | 'backdrop' | 'equalizer' | 'music' | 'keystrokes' | 'updates' | 'profiles';

export type UpdateStage = 'idle' | 'checking' | 'none' | 'downloading' | 'ready' | 'restarting' | 'error';

export interface UpdateState {
  stage: UpdateStage;
  version: string;
  currentVersion: string;
  notes: string;
  percent: number;
  message: string;
  supported: boolean;
  checkedAt: string;
}

export interface SidebarState {
  mode: 'retracted' | 'expanded' | 'locked-retracted';
  width: number;
}

export interface LayoutState {
  activePanel: PanelId;
  navSidebar: SidebarState;
  settingsSection: SettingsSection;
  music: MusicLayout | null;
}

export interface MusicState {
  signedIn: boolean;
  videoId: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  state: number;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  like: 'LIKE' | 'DISLIKE' | 'INDIFFERENT';
  ad: boolean;
  shuffle: boolean;
  repeat: 'NONE' | 'ALL' | 'ONE';
  bpm: number;
}

export interface MusicFeel {
  bass: number;
  mid: number;
  high: number;
  bpm: number;
  beatAgo: number;
  kick: number;
  rise: number;
  flux: number[];
  gain: number;
}

export type MusicCommand =
  | { kind: 'play' | 'pause' | 'toggle' | 'next' | 'previous' | 'like' | 'dislike' }
  | { kind: 'seek'; seconds: number }
  | { kind: 'volume'; level: number }
  | { kind: 'volumeStep'; delta: number }
  | { kind: 'playVideo'; videoId: string; playlistId?: string }
  | { kind: 'playPlaylist'; playlistId: string }
  | { kind: 'playQueueIndex'; index: number }
  | { kind: 'shuffle' | 'repeat' | 'mute' };

export interface MusicTrack {
  videoId: string;
  title: string;
  artist: string;
  artistId: string;
  album: string;
  albumId: string;
  duration: string;
  thumbnail: string;
  playlistId: string;
  artists?: Array<{ name: string; id: string }>;
  videoType?: string;
}

export type MusicCardKind = 'album' | 'playlist' | 'artist' | 'profile' | 'song' | 'video' | 'other';

export interface MusicCard {
  kind: MusicCardKind;
  title: string;
  subtitle: string;
  thumbnail: string;
  browseId: string;
  playlistId: string;
  videoId: string;
  wide: boolean;
}

export interface MusicShelf {
  title: string;
  tracks: MusicTrack[];
  cards: MusicCard[];
  continuation: string;
}

export interface MusicSearch {
  top: MusicCard | null;
  songs: MusicTrack[];
  artists: MusicCard[];
  albums: MusicCard[];
  playlists: MusicCard[];
}

export interface MusicPage {
  title: string;
  subtitle: string;
  ownerId: string;
  detail: string;
  thumbnail: string;
  playlistId: string;
  shelves: MusicShelf[];
}

export type MusicAboutKind = 'song' | 'album' | 'artist';

export interface MusicAbout {
  title: string;
  description: string;
  text: string;
  url: string;
}

export interface MusicQueue {
  items: MusicTrack[];
  current: number;
}

export interface MusicLyricWord {
  start: number;
  end: number;
  text: string;
}

export interface MusicLyricLine {
  start: number;
  end: number;
  text: string;
  words?: MusicLyricWord[];
}

export interface MusicLyrics {
  videoId: string;
  lines: MusicLyricLine[];
  text: string;
  source: string;
  musixmatchId?: string;
}

export interface LyricsTranslation {
  lang: string;
  target: string;
  source: 'musixmatch' | 'google';
  machineLines: number;
  translated: string[];
  romanized: string[];
}

export interface MusicPlay {
  at: number;
  videoId: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  seconds: number;
}

export type MusicStatsRange = 'week' | 'month' | 'year' | 'all';

export interface MusicStats {
  range: MusicStatsRange;
  minutes: number;
  plays: number;
  tracks: number;
  artists: number;
  series: Array<{ label: string; minutes: number }>;
  hours: number[];
  weekdays: number[];
  topTracks: Array<{ videoId: string; title: string; artist: string; artwork: string; plays: number; minutes: number }>;
  topArtists: Array<{ name: string; artwork: string; plays: number; minutes: number }>;
  recent: MusicPlay[];
  streak: number;
  longestStreak: number;
  since: number;
}

export type MusicDataTab = 'overview' | 'tracks' | 'artists' | 'albums' | 'history' | 'database';

export type MusicDataLayout = 'gallery' | 'table';

export type MusicLibraryFilter = 'all' | 'playlist' | 'artist' | 'album';

export type MusicView =
  | { kind: 'home' | 'search' | 'library' | 'stats' | 'lyrics' }
  | { kind: 'page'; browseId: string; title: string }
  | { kind: 'discover'; tag?: string }
  | { kind: 'data'; tab: MusicDataTab; heard?: 'unheard' }
  | { kind: 'dataTrack' | 'dataArtist' | 'dataAlbum'; id: number; title: string };

export interface DiscoverSettings {
  tags: string[];
  axes: Partial<Record<DiscoverAxis, number>>;
  fresh: number;
  seed: number;
}

export interface MusicLayout {
  view: MusicView;
  back: MusicView[];
  query: string;
  discover: DiscoverSettings;
  dataLayout: Record<'tracks' | 'artists' | 'albums', MusicDataLayout>;
  lyricsExtras: string[];
  queueOpen: boolean;
  focus: boolean;
  statsRange: MusicStatsRange;
  libraryFilter: MusicLibraryFilter;
}
export * from './musicRepo';
