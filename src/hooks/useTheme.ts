import { useEffect, useState } from 'react';
import { foregroundFor, isHexColor } from '@/lib/accents';
import { useProfileStore, SETTINGS_DEFAULTS } from '@/stores/useProfileStore';
import type { ThemeChoice } from '@/stores/useProfileStore';

export type ThemeName = 'oled' | 'dark' | 'light';

const SANS = '"Geist", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';

function usePrefersLight(): boolean {
  const [light, setLight] = useState(() => matchMedia('(prefers-color-scheme: light)').matches);

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setLight(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return light;
}

export function useThemeName(): ThemeName {
  const theme = (useProfileStore(s => s.activeConfig?.theme) ?? SETTINGS_DEFAULTS.theme) as ThemeChoice;
  const prefersLight = usePrefersLight();
  if (theme === 'system') return prefersLight ? 'light' : 'oled';
  return theme;
}

export function useApplyTheme(): void {
  const resolved = useThemeName();
  const accent = useProfileStore(s => s.activeConfig?.accent) ?? SETTINGS_DEFAULTS.accent;
  const density = useProfileStore(s => s.activeConfig?.density) ?? SETTINGS_DEFAULTS.density;
  const radius = useProfileStore(s => s.activeConfig?.radius) ?? SETTINGS_DEFAULTS.radius;
  const monoUi = useProfileStore(s => s.activeConfig?.monoUi) ?? SETTINGS_DEFAULTS.monoUi;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    const custom = isHexColor(accent);
    root.setAttribute('data-accent', custom ? 'custom' : accent);
    if (custom) {
      root.style.setProperty('--primary', accent);
      root.style.setProperty('--primary-foreground', foregroundFor(accent));
    } else {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--primary-foreground');
    }
    root.setAttribute('data-density', density);
    root.style.setProperty('--radius', radius);
    root.style.setProperty('--font-sans', monoUi ? 'var(--font-mono)' : SANS);
    window.api?.shell.setTheme(resolved);

    localStorage.setItem('ui:boot', JSON.stringify({ theme: resolved, accent, density, radius }));
  }, [resolved, accent, density, radius, monoUi]);
}
