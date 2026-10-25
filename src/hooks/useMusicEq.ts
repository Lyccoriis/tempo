import { useEffect } from 'react';

import { eqSound, genrePreset, readEq, readFade } from '@/lib/equalizer';
import { useMusicStore } from '@/stores/useMusicStore';
import { useProfileStore } from '@/stores/useProfileStore';

export function useMusicEq() {
  const saved = useProfileStore(s => s.activeConfig?.musicEq);
  const presets = useProfileStore(s => s.activeConfig?.musicEqPresets);
  const fade = useProfileStore(s => s.activeConfig?.musicFade);
  const videoId = useMusicStore(s => s.state?.videoId ?? '');
  const title = useMusicStore(s => s.state?.title ?? '');
  const artist = useMusicStore(s => s.state?.artist ?? '');
  const ad = useMusicStore(s => s.state?.ad ?? false);
  const autoPreset = useMusicStore(s => s.autoEq?.preset);
  const manual = useMusicStore(s => (s.eqManual?.videoId === videoId ? s.eqManual : null));
  const setAutoEq = useMusicStore(s => s.setAutoEq);

  const eq = readEq(saved);
  const auto = eq.enabled && eq.auto;

  useEffect(() => {
    if (!auto) {
      setAutoEq(null);
      return;
    }
    if (!videoId || ad || !title) return;
    const key = `${videoId}|${title}|${artist}|${eq.autoFallback}`;
    const before = useMusicStore.getState().autoEq;
    if (before?.key === key && !before.looking) return;
    setAutoEq({ key, genre: null, preset: before?.preset ?? '', looking: true });
    let live = true;
    window.api.ytmusic
      .genre(title, artist)
      .catch(err => {
        console.error('[music] genre lookup failed:', err);
        return null;
      })
      .then(genre => {
        if (!live) return;
        setAutoEq({ key, genre, preset: genrePreset(genre) ?? eq.autoFallback, looking: false });
      });
    return () => {
      live = false;
    };
  }, [auto, videoId, title, artist, ad, eq.autoFallback, setAutoEq]);

  const preset = auto ? autoPreset || null : null;

  useEffect(() => {
    const sound = eqSound(readEq(saved), presets ?? [], preset, manual);
    window.api.ytmusic.eq(sound).catch(err => console.error('[music] equalizer failed:', err));
  }, [saved, presets, preset, manual, videoId]);

  useEffect(() => {
    window.api.ytmusic.fade(readFade(fade)).catch(err => console.error('[music] fade failed:', err));
  }, [fade, videoId]);
}
