import type { Profile, ProfileConfig, CreateProfileOpts } from '../stores/useProfileStore'
import type { UpdateState } from './index'
import type { EqSound, MusicFade } from '../lib/equalizer'
import type {
  DiscoverProgress,
  DiscoverQuery,
  DiscoverRow,
  DiscoverTaste,
  DiscoverTrack,
  LyricsTranslation,
  MusicAbout,
  MusicAboutKind,
  MusicCommand,
  MusicFeel,
  MusicLyrics,
  MusicPage,
  MusicPlay,
  MusicQueue,
  MusicSearch,
  MusicShelf,
  MusicState,
  MusicStats,
  MusicStatsRange,
  MusicTrack,
  RepoAlbumDetail,
  RepoAlbumRow,
  RepoAlbumSort,
  RepoArtistDetail,
  RepoArtistRow,
  RepoArtistSort,
  RepoEventQuery,
  RepoEventRow,
  RepoInfo,
  RepoIntegrity,
  RepoListQuery,
  RepoPage,
  RepoPlayQuery,
  RepoPlayRow,
  RepoSearchEntry,
  RepoSummary,
  RepoTableCount,
  RepoTrackDetail,
  RepoTrackQuery,
  RepoTrackRow,
} from './index'

declare global {
  interface Window {
    api: {
      profile: {
        list: () => Promise<Profile[]>
        create: (opts: CreateProfileOpts) => Promise<Profile>
        switch: (id: string) => Promise<void>
        update: (
          id: string,
          patch: { name?: string; role?: string; color?: string },
        ) => Promise<Profile>
        setPicture: (id: string, dataUrl: string | null) => Promise<Profile>
        delete: (id: string) => Promise<void>
        paths: (id: string) => Promise<{
          root: string
          config: string
          layout: string
        }>
        getConfig: (id: string) => Promise<ProfileConfig>
        saveConfig: (id: string, config: ProfileConfig) => Promise<void>
        getLayout: (id: string) => Promise<unknown>
        saveLayout: (id: string, layout: unknown) => Promise<void>
      }

      ytmusic: {
        start: () => Promise<void>
        show: (bounds: { x: number; y: number; width: number; height: number }) => Promise<void>
        hide: () => Promise<void>
        home: () => Promise<void>
        signedIn: () => Promise<boolean>
        importCookies: (header: string) => Promise<number>
        loginBrowser: () => Promise<string | null>
        signInWithBrowser: () => Promise<number>
        signOut: () => Promise<void>
        state: () => Promise<MusicState | null>
        command: (command: MusicCommand) => Promise<void>
        onState: (cb: (state: MusicState) => void) => () => void
        onFeel: (cb: (feel: MusicFeel) => void) => () => void
        queue: () => Promise<MusicQueue | null>
        onQueue: (cb: (queue: MusicQueue) => void) => () => void
        eq: (eq: EqSound) => Promise<boolean>
        fade: (fade: MusicFade) => Promise<boolean>
        spectrum: () => Promise<{ afterEq: boolean; levels: number[] } | null>
        genre: (title: string, artist: string) => Promise<string | null>
        about: (kind: MusicAboutKind, title: string, artist: string) => Promise<MusicAbout | null>
        search: (query: string) => Promise<MusicSearch>
        browse: (browseId: string) => Promise<MusicPage>
        more: (token: string) => Promise<Omit<MusicShelf, 'title'>>
        lyrics: (videoId: string, hint?: { title: string; artist: string; duration: number }) => Promise<MusicLyrics | null>
        wordTimed: (videoIds: string[]) => Promise<string[]>
        translateLyrics: (videoId: string) => Promise<LyricsTranslation | null>
        stats: (range: MusicStatsRange) => Promise<MusicStats>
        onPlayed: (cb: (play: MusicPlay) => void) => () => void
      }

      musicRepo: {
        open: (profileId: string) => Promise<RepoInfo>
        info: () => Promise<RepoInfo>
        summary: () => Promise<RepoSummary | null>
        tables: () => Promise<RepoTableCount[]>
        tracks: (query: RepoTrackQuery) => Promise<RepoPage<RepoTrackRow>>
        track: (id: number) => Promise<RepoTrackDetail | null>
        trackByVideo: (videoId: string) => Promise<RepoTrackDetail | null>
        trackHistory: (id: number, offset: number, limit: number) => Promise<RepoPage<RepoEventRow>>
        artists: (query: RepoListQuery<RepoArtistSort>) => Promise<RepoPage<RepoArtistRow>>
        artist: (id: number) => Promise<RepoArtistDetail | null>
        albums: (query: RepoListQuery<RepoAlbumSort>) => Promise<RepoPage<RepoAlbumRow>>
        album: (id: number) => Promise<RepoAlbumDetail | null>
        events: (query: RepoEventQuery) => Promise<RepoPage<RepoEventRow>>
        plays: (query: RepoPlayQuery) => Promise<RepoPage<RepoPlayRow>>
        searchHistory: (limit: number) => Promise<RepoSearchEntry[]>
        recordSearch: (query: string, resultKind?: string, resultId?: string) => Promise<void>
        clearSearch: (id?: number) => Promise<void>
        integrity: () => Promise<RepoIntegrity>
        rebuildStats: () => Promise<{ tracks: number; ms: number }>
        setAside: () => Promise<RepoInfo>
        artwork: (url: string) => Promise<{ type: string; data: Uint8Array } | null>
        onChanged: (cb: () => void) => () => void
      }

      musicDiscover: {
        taste: () => Promise<DiscoverTaste | null>
        enrich: () => Promise<DiscoverProgress>
        library: (query: DiscoverQuery) => Promise<DiscoverTrack[]>
        fresh: (query: DiscoverQuery) => Promise<DiscoverTrack[]>
        find: (title: string, artist: string) => Promise<MusicTrack | null>
        home: () => Promise<DiscoverRow[]>
        onProgress: (cb: (progress: DiscoverProgress) => void) => () => void
      }

      update: {
        state: () => Promise<UpdateState>
        check: () => Promise<UpdateState>
        install: () => void
        onState: (fn: (state: UpdateState) => void) => () => void
      }

      shell: {
        setTitle: (title: string) => void
        openExternal: (url: string) => void
        showInFolder: (path: string) => void
        setTheme: (theme: string) => void
        minimize: () => void
        toggleMaximize: () => void
        close: () => void
        isMaximized: () => Promise<boolean>
        onMaximized: (fn: (value: boolean) => void) => () => void
      }
    }
  }
}

export {}
