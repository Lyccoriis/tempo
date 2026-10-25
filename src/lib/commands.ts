import {
  BarChart3,
  Compass,
  Database,
  Eye,
  Languages,
  Maximize2,
  MicVocal,
  Music,
  PanelLeft,
  Play,
  Search,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useFinderStore } from '@/stores/useFinderStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useMusicStore } from '@/stores/useMusicStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useUiStore } from '@/stores/useUiStore';
import type { PanelId } from '@/types';

export interface AppCommand {
  id: string;
  label: string;
  hint: string;
  icon?: LucideIcon;
  panelId?: PanelId;
  defaultKey: string;
  run: () => void;
}

function goTo(panelId: PanelId, label: string, defaultKey: string): AppCommand {
  return {
    id: `panel.${panelId}`,
    label: `Go to ${label}`,
    hint: 'Panel',
    panelId,
    defaultKey,
    run: () => useLayoutStore.getState().setActivePanel(panelId),
  };
}

function toggleLyricsExtra(extra: string): void {
  useLayoutStore.getState().setActivePanel('music');
  const music = useMusicStore.getState();
  const shown = music.lyricsExtras;
  music.setLyricsExtras(shown.includes(extra) ? shown.filter(e => e !== extra) : [...shown, extra]);
  if (!music.focus) music.go({ kind: 'lyrics' });
}

export const APP_COMMANDS: AppCommand[] = [
  {
    id: 'finder.open',
    label: 'Open finder',
    hint: 'Search everything',
    icon: Search,
    defaultKey: 'Ctrl+K',
    run: () => useFinderStore.getState().toggle(),
  },
  {
    id: 'nav.toggle',
    label: 'Toggle nav sidebar',
    hint: 'Expand or retract the left sidebar',
    icon: PanelLeft,
    defaultKey: 'Ctrl+B',
    run: () => {
      const { navSidebar, setNavSidebar } = useLayoutStore.getState();
      setNavSidebar({ mode: navSidebar.mode === 'expanded' ? 'retracted' : 'expanded' });
    },
  },
  {
    id: 'app.backdropOnly',
    label: 'Show only the backdrop',
    hint: 'Hide the app and leave the dither, again to bring it back',
    icon: Eye,
    defaultKey: '',
    run: () => useUiStore.getState().toggleBackdropOnly(),
  },
  {
    id: 'app.karaoke',
    label: 'Toggle karaoke line',
    hint: 'The line being sung, at the bottom while only the backdrop shows',
    icon: MicVocal,
    defaultKey: '',
    run: () => {
      const { activeConfig, updateConfig } = useProfileStore.getState();
      void updateConfig({ backdropKaraoke: !activeConfig?.backdropKaraoke });
    },
  },
  {
    id: 'finder.find',
    label: 'Find',
    hint: 'Same as the finder, bound to Ctrl+F as well',
    icon: Search,
    defaultKey: 'Ctrl+F',
    run: () => useFinderStore.getState().toggle(),
  },
  {
    id: 'music.toggle',
    label: 'Play or pause music',
    hint: 'YouTube Music',
    icon: Play,
    defaultKey: '',
    run: () => void useMusicStore.getState().send({ kind: 'toggle' }),
  },
  {
    id: 'music.next',
    label: 'Next song',
    hint: 'YouTube Music',
    icon: SkipForward,
    defaultKey: '',
    run: () => void useMusicStore.getState().send({ kind: 'next' }),
  },
  {
    id: 'music.previous',
    label: 'Previous song',
    hint: 'YouTube Music',
    icon: SkipBack,
    defaultKey: '',
    run: () => void useMusicStore.getState().send({ kind: 'previous' }),
  },
  {
    id: 'music.search',
    label: 'Search music',
    hint: 'YouTube Music',
    icon: Search,
    defaultKey: '',
    run: () => {
      useLayoutStore.getState().setActivePanel('music');
      useMusicStore.getState().go({ kind: 'search' });
    },
  },
  {
    id: 'music.discover',
    label: 'Discover music',
    hint: 'YouTube Music, picks from what you listen to, by genre and mood',
    icon: Compass,
    defaultKey: '',
    run: () => {
      useLayoutStore.getState().setActivePanel('music');
      useMusicStore.getState().go({ kind: 'discover' });
    },
  },
  {
    id: 'music.stats',
    label: 'Listening stats',
    hint: 'YouTube Music, what you played',
    icon: BarChart3,
    defaultKey: '',
    run: () => {
      useLayoutStore.getState().setActivePanel('music');
      useMusicStore.getState().go({ kind: 'stats' });
    },
  },
  {
    id: 'music.data',
    label: 'Music data',
    hint: 'YouTube Music, the listening database of this profile',
    icon: Database,
    defaultKey: '',
    run: () => {
      useLayoutStore.getState().setActivePanel('music');
      useMusicStore.getState().go({ kind: 'data', tab: 'overview' });
    },
  },
  {
    id: 'music.lyrics',
    label: 'Song lyrics',
    hint: 'YouTube Music, sung along as it plays',
    icon: MicVocal,
    defaultKey: '',
    run: () => {
      useLayoutStore.getState().setActivePanel('music');
      useMusicStore.getState().setFocus(false);
      useMusicStore.getState().go({ kind: 'lyrics' });
    },
  },
  {
    id: 'music.lyricsRomanized',
    label: 'Lyrics in Latin letters',
    hint: 'YouTube Music, romaji, pinyin and the like under each line',
    icon: Languages,
    defaultKey: '',
    run: () => toggleLyricsExtra('romanized'),
  },
  {
    id: 'music.lyricsTranslated',
    label: 'Translate lyrics to English',
    hint: 'YouTube Music, English under each line',
    icon: Languages,
    defaultKey: '',
    run: () => toggleLyricsExtra('translated'),
  },
  {
    id: 'music.focus',
    label: 'Music focus mode',
    hint: 'YouTube Music, cover and lyrics full size',
    icon: Maximize2,
    defaultKey: '',
    run: () => {
      useLayoutStore.getState().setActivePanel('music');
      useMusicStore.getState().setFocus(!useMusicStore.getState().focus);
    },
  },
  {
    id: 'music.equalizer',
    label: 'Music equalizer',
    hint: 'Settings, bands, presets and balance for YouTube Music',
    icon: SlidersHorizontal,
    defaultKey: '',
    run: () => {
      useLayoutStore.getState().setSettingsSection('equalizer');
      useLayoutStore.getState().setActivePanel('settings');
    },
  },
  {
    id: 'music.nowPlaying',
    label: 'Show now playing',
    hint: 'YouTube Music, the floating player outside the Music panel',
    icon: Music,
    defaultKey: '',
    run: () => useMusicStore.getState().setMiniOpen(true),
  },
  goTo('music', 'Music', 'Ctrl+1'),
  goTo('settings', 'Settings', 'Ctrl+,'),
];

export function resolveBindings(overrides: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const command of APP_COMMANDS) {
    const custom = overrides?.[command.id];
    out[command.id] = custom === undefined ? command.defaultKey : custom;
  }
  return out;
}
