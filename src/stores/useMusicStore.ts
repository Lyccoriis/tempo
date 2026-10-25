import { create } from 'zustand';
import { toast } from 'sonner';

import type { EqManual } from '@/lib/equalizer';
import { useLayoutStore } from '@/stores/useLayoutStore';
import type {
  DiscoverSettings,
  LyricsTranslation,
  MusicAboutKind,
  MusicCommand,
  MusicDataLayout,
  MusicLayout,
  MusicLibraryFilter,
  MusicLyrics,
  MusicPage,
  MusicQueue,
  MusicSearch,
  MusicState,
  MusicStatsRange,
  MusicView,
} from '@/types';

export type { DiscoverSettings, MusicDataLayout, MusicDataTab, MusicView } from '@/types';

export interface CoverView {
  src: string;
  kind: MusicAboutKind | null;
  title: string;
  artist: string;
  videoId?: string;
}

export const DISCOVER_DEFAULTS: DiscoverSettings = { tags: [], axes: {}, fresh: 0.25, seed: 1 };

interface MusicStore {
  state: MusicState | null;
  stateAt: number;
  queue: MusicQueue | null;
  view: MusicView;
  back: MusicView[];
  query: string;
  search: MusicSearch | null;
  searching: boolean;
  pages: Record<string, MusicPage>;
  lyrics: Record<string, MusicLyrics | null>;
  wordTimed: Record<string, boolean>;
  translations: Record<string, LyricsTranslation | null>;
  lyricsExtras: string[];
  discover: DiscoverSettings;
  setDiscover: (patch: Partial<DiscoverSettings>) => void;
  focus: boolean;
  queueOpen: boolean;
  setQueueOpen: (open: boolean) => void;
  statsRange: MusicStatsRange;
  setStatsRange: (range: MusicStatsRange) => void;
  libraryFilter: MusicLibraryFilter;
  setLibraryFilter: (filter: MusicLibraryFilter) => void;
  miniOpen: boolean;
  viewer: CoverView | null;
  dataLayout: Record<'tracks' | 'artists' | 'albums', MusicDataLayout>;
  setDataLayout: (tab: 'tracks' | 'artists' | 'albums', layout: MusicDataLayout) => void;
  setViewer: (viewer: CoverView | null) => void;
  autoEq: { key: string; genre: string | null; preset: string; looking: boolean } | null;
  setAutoEq: (autoEq: MusicStore['autoEq']) => void;
  eqManual: EqManual | null;
  setEqManual: (eqManual: EqManual | null) => void;
  send: (command: MusicCommand) => Promise<void>;
  go: (view: MusicView) => void;
  goBack: () => void;
  runSearch: (query: string) => Promise<void>;
  loadPage: (browseId: string, force?: boolean) => Promise<MusicPage | null>;
  loadMore: (browseId: string, shelf: number) => Promise<void>;
  loadLyrics: (videoId: string) => Promise<void>;
  checkWordTimed: (videoIds: string[]) => Promise<void>;
  loadTranslation: (videoId: string) => Promise<void>;
  setLyricsExtras: (extras: string[]) => void;
  setFocus: (focus: boolean) => void;
  setMiniOpen: (open: boolean) => void;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err);
}

let searchSeq = 0;
const lyricsLoading = new Set<string>();
const translationsLoading = new Set<string>();

export const useMusicStore = create<MusicStore>((set, get) => ({
  state: null,
  stateAt: 0,
  queue: null,
  view: { kind: 'home' },
  back: [],
  query: '',
  search: null,
  searching: false,
  pages: {},
  lyrics: {},
  wordTimed: {},
  translations: {},
  lyricsExtras: [],
  discover: DISCOVER_DEFAULTS,
  focus: false,
  queueOpen: true,
  statsRange: 'week',
  libraryFilter: 'all',
  miniOpen: true,
  viewer: null,
  dataLayout: { tracks: 'gallery', artists: 'gallery', albums: 'gallery' },
  autoEq: null,
  eqManual: null,

  setAutoEq: autoEq => set({ autoEq }),

  setDiscover: patch => set(s => ({ discover: { ...s.discover, ...patch } })),

  setEqManual: eqManual => set({ eqManual }),

  setViewer: viewer => set({ viewer }),

  setDataLayout: (tab, layout) => set(s => ({ dataLayout: { ...s.dataLayout, [tab]: layout } })),

  send: async command => {
    try {
      await window.api.ytmusic.command(command);
    } catch (err) {
      toast.error(message(err));
    }
  },

  go: view => {
    const current = get().view;
    if (JSON.stringify(current) === JSON.stringify(view)) return;
    set(s => ({ view, back: [...s.back, current].slice(-30) }));
  },

  goBack: () => {
    const back = get().back;
    if (!back.length) return;
    set({ view: back[back.length - 1], back: back.slice(0, -1) });
  },

  runSearch: async query => {
    set({ query });
    const q = query.trim();
    const seq = ++searchSeq;
    if (!q) {
      set({ search: null, searching: false });
      return;
    }
    set({ searching: true });
    try {
      const search = await window.api.ytmusic.search(q);
      if (seq === searchSeq) set({ search, searching: false });
    } catch (err) {
      if (seq === searchSeq) set({ searching: false });
      toast.error(message(err));
    }
  },

  loadPage: async (browseId, force = false) => {
    const cached = get().pages[browseId];
    if (cached && !force) return cached;
    try {
      const page = await window.api.ytmusic.browse(browseId);
      set(s => ({ pages: { ...s.pages, [browseId]: page } }));
      return page;
    } catch (err) {
      toast.error(message(err));
      return null;
    }
  },

  loadMore: async (browseId, index) => {
    const page = get().pages[browseId];
    const shelf = page?.shelves[index];
    if (!page || !shelf?.continuation) return;
    try {
      const more = await window.api.ytmusic.more(shelf.continuation);
      const shelves = page.shelves.map((s, i) =>
        i === index
          ? { ...s, tracks: [...s.tracks, ...more.tracks], cards: [...s.cards, ...more.cards], continuation: more.continuation }
          : s,
      );
      set(s => ({ pages: { ...s.pages, [browseId]: { ...page, shelves } } }));
    } catch (err) {
      toast.error(message(err));
    }
  },

  loadLyrics: async videoId => {
    if (!videoId || videoId in get().lyrics || lyricsLoading.has(videoId)) return;
    lyricsLoading.add(videoId);
    try {
      const s = get().state;
      const hint = s?.videoId === videoId ? { title: s.title, artist: s.artist, duration: s.duration } : undefined;
      const found = await window.api.ytmusic.lyrics(videoId, hint);
      const timed = !!found?.lines.some(l => l.words);
      set(s => ({ lyrics: { ...s.lyrics, [videoId]: found }, wordTimed: { ...s.wordTimed, [videoId]: timed } }));
    } catch (err) {
      set(s => ({ lyrics: { ...s.lyrics, [videoId]: null } }));
      toast.error(`Lyrics: ${message(err)}`);
    } finally {
      lyricsLoading.delete(videoId);
    }
  },

  checkWordTimed: async videoIds => {
    const known = get().wordTimed;
    const ask = [...new Set(videoIds)].filter(id => id && !(id in known));
    if (!ask.length) return;
    try {
      const timed = new Set(await window.api.ytmusic.wordTimed(ask));
      set(s => ({ wordTimed: { ...s.wordTimed, ...Object.fromEntries(ask.map(id => [id, timed.has(id)])) } }));
    } catch (err) {
      console.error('[music] word timed check failed', err);
    }
  },

  loadTranslation: async videoId => {
    if (!videoId || get().translations[videoId] || translationsLoading.has(videoId)) return;
    translationsLoading.add(videoId);
    try {
      const found = await window.api.ytmusic.translateLyrics(videoId);
      set(s => ({ translations: { ...s.translations, [videoId]: found } }));
    } catch (err) {
      set(s => ({ translations: { ...s.translations, [videoId]: null } }));
      toast.error(`Translation: ${message(err)}`);
    } finally {
      translationsLoading.delete(videoId);
    }
  },

  setLyricsExtras: extras => set({ lyricsExtras: extras }),

  setFocus: focus => set({ focus }),

  setMiniOpen: miniOpen => set({ miniOpen }),

  setQueueOpen: queueOpen => set({ queueOpen }),

  setStatsRange: statsRange => set({ statsRange }),

  setLibraryFilter: libraryFilter => set({ libraryFilter }),
}));

function musicLayout(s: MusicStore): MusicLayout {
  return {
    view: s.view,
    back: s.back,
    query: s.query,
    discover: s.discover,
    dataLayout: s.dataLayout,
    lyricsExtras: s.lyricsExtras,
    queueOpen: s.queueOpen,
    focus: s.focus,
    statsRange: s.statsRange,
    libraryFilter: s.libraryFilter,
  };
}

let saved: MusicLayout | null = null;

function restoreMusic(music: MusicLayout | null): void {
  saved = music;
  const fresh = musicLayout(useMusicStore.getInitialState());
  useMusicStore.setState({ ...fresh, ...(music ?? {}), search: null });
}

useLayoutStore.subscribe((s, prev) => {
  if (s.hydrated && (!prev.hydrated || s.music !== prev.music) && s.music !== saved) restoreMusic(s.music);
});
if (useLayoutStore.getState().hydrated) restoreMusic(useLayoutStore.getState().music);

useMusicStore.subscribe(s => {
  if (!useLayoutStore.getState().hydrated) return;
  const next = musicLayout(s);
  if (saved && (Object.keys(next) as Array<keyof MusicLayout>).every(k => next[k] === saved![k])) return;
  saved = next;
  useLayoutStore.getState().setMusic(next);
});

window.api.ytmusic.onState(state =>
  useMusicStore.setState(s => ({
    state,
    stateAt: performance.now(),
    ...(state?.videoId && state.videoId !== s.state?.videoId ? { miniOpen: true, eqManual: null } : {}),
  })),
);
window.api.ytmusic.onQueue(queue => useMusicStore.setState({ queue }));
window.api.ytmusic
  .state()
  .then(state => {
    if (state) useMusicStore.setState({ state, stateAt: performance.now() });
  })
  .catch(err => console.error('[music] state failed', err));
window.api.ytmusic
  .queue()
  .then(queue => {
    if (queue) useMusicStore.setState({ queue });
  })
  .catch(err => console.error('[music] queue failed', err));

export function isPlaying(state: MusicState | null): boolean {
  return state?.state === 1 || state?.state === 3;
}

export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}
