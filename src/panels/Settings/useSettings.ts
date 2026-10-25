import { SETTINGS_DEFAULTS, useProfileStore } from '@/stores/useProfileStore';
import type { ProfileConfig } from '@/stores/useProfileStore';

type Defaults = typeof SETTINGS_DEFAULTS;

export function useSettings() {
  const config = useProfileStore(s => s.activeConfig);
  const updateConfig = useProfileStore(s => s.updateConfig);

  function get<K extends keyof Defaults>(key: K): Defaults[K] {
    return (config?.[key] ?? SETTINGS_DEFAULTS[key]) as Defaults[K];
  }

  function set(patch: Partial<ProfileConfig>) {
    void updateConfig(patch);
  }

  return { config, get, set };
}

export const SECTION_KEYS = {
  appearance: ['theme', 'accent', 'radius', 'density', 'monoUi'],
  backdrop: ['backdrop', 'backdropKaraoke'],
  equalizer: ['musicEq'],
  music: ['musicFade'],
} satisfies Record<string, (keyof Defaults)[]>;

export function defaultsFor(keys: readonly (keyof Defaults)[]): Partial<ProfileConfig> {
  const out: Partial<ProfileConfig> = {};
  for (const key of keys) Object.assign(out, { [key]: SETTINGS_DEFAULTS[key] });
  return out;
}
