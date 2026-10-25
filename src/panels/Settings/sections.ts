import { AudioLines, Keyboard, Palette, RefreshCw, SlidersHorizontal, Users, Wallpaper } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useLayoutStore } from '@/stores/useLayoutStore';
import type { SettingsSection } from '@/types';

export interface SectionInfo {
  id: SettingsSection;
  label: string;
  hint: string;
  icon: LucideIcon;
  rows: string[];
}

export const SETTINGS_SECTIONS: SectionInfo[] = [
  {
    id: 'appearance',
    label: 'Appearance',
    hint: 'Theme, accent, corners and density',
    icon: Palette,
    rows: ['Theme', 'Accent', 'Corner radius', 'Density', 'Monospace interface'],
  },
  {
    id: 'backdrop',
    label: 'Backdrop',
    hint: 'The moving background, how it looks and how it follows the music',
    icon: Wallpaper,
    rows: ['Backdrop', 'Colors', 'Mouse Interaction', 'React to music', 'Karaoke line'],
  },
  {
    id: 'equalizer',
    label: 'Equalizer',
    hint: 'How YouTube Music sounds, ten bands, presets and balance',
    icon: SlidersHorizontal,
    rows: ['Equalizer', 'Auto EQ', 'When no genre is found', 'Preset', 'Frequency response', 'Bands', 'Preamp', 'Band width', 'Balance', 'Limiter', 'Save preset'],
  },
  {
    id: 'music',
    label: 'Music',
    hint: 'How songs follow each other',
    icon: AudioLines,
    rows: ['Playback', 'Fade between songs', 'Keep albums whole'],
  },
  {
    id: 'keystrokes',
    label: 'Keystrokes',
    hint: 'Shortcuts for every command, and the double Shift finder',
    icon: Keyboard,
    rows: ['Keystrokes', 'Double Shift opens the finder'],
  },
  {
    id: 'updates',
    label: 'Updates',
    hint: 'Check for a newer build and install it',
    icon: RefreshCw,
    rows: ['Updates', 'Check for updates'],
  },
  {
    id: 'profiles',
    label: 'Profiles',
    hint: 'Create, rename and delete profiles',
    icon: Users,
    rows: ['Profiles', 'New profile'],
  },
];

export function openSettings(section: SettingsSection) {
  const layout = useLayoutStore.getState();
  layout.setSettingsSection(section);
  layout.setActivePanel('settings');
}
