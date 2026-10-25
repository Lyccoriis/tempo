import { memo, useEffect, useMemo, useRef, useState } from 'react';

import Dither, { type WaveFeel } from '@/components/reactbits/Dither';
import ClassicDither from '@/components/reactbits/ClassicDither';
import Balatro from '@/components/reactbits/Balatro';
import { toDitherProps, toBalatroProps } from '@/lib/backdropAdapters';
import { resolveBackdropSettings, type BackdropSettings } from '@/lib/backdrop';
import { isPlaying, useMusicStore } from '@/stores/useMusicStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useUiStore } from '@/stores/useUiStore';
import type { MusicFeel } from '@/types';

type Rgb = [number, number, number];

interface Palette {
  wave: Rgb;
  accent: Rgb;
  glow: Rgb;
}

function tokenRgb(name: string, fallback: Rgb): Rgb {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!value || !ctx) return fallback;
  ctx.canvas.width = 1;
  ctx.canvas.height = 1;
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

function plain(c: Rgb): Palette {
  return { wave: c, accent: c, glow: c };
}


function tint(c: Rgb): Palette {
  return {
    wave: c,
    accent: c.map(v => v * 0.6) as Rgb,
    glow: c.map(v => v + (1 - v) * 0.4) as Rgb,
  };
}

function hexRgb(hex: string): Rgb | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb;
}


function brighten(c: Rgb): Rgb {
  const peak = Math.max(...c, 0.01);
  return c.map(v => Math.min(1, (v / peak) * 0.85)) as Rgb;
}


function coverPalette(src: string): Promise<Palette | null> {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      try {
        const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.canvas.width = 24;
        ctx.canvas.height = 24;
        ctx.drawImage(img, 0, 0, 24, 24);
        const data = ctx.getImageData(0, 0, 24, 24).data;
        const hues = Array.from({ length: 12 }, () => ({ r: 0, g: 0, b: 0, w: 0 }));
        const all = { r: 0, g: 0, b: 0, w: 0 };
        const lights: Array<[number, number, number, number]> = [];
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const w = 1 + (max - min) / 16;
          all.r += r * w;
          all.g += g * w;
          all.b += b * w;
          all.w += w;
          lights.push([r, g, b, 0.2126 * r + 0.7152 * g + 0.0722 * b]);
          const sat = max ? (max - min) / max : 0;
          if (sat < 0.15 || max < 30) continue;
          const d = max - min;
          const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
          const bucket = hues[Math.floor(h * 2) % 12];
          const weight = sat * (max / 255);
          bucket.r += r * weight;
          bucket.g += g * weight;
          bucket.b += b * weight;
          bucket.w += weight;
        }
        const mean = (x: { r: number; g: number; b: number; w: number }): Rgb => [
          x.r / x.w / 255,
          x.g / x.w / 255,
          x.b / x.w / 255,
        ];
        const ranked = hues
          .map((x, i) => ({ x, i }))
          .filter(h => h.x.w > 0)
          .sort((a, b) => b.x.w - a.x.w);
        const top = ranked[0];
        const apart =
          top &&
          ranked.find(h => Math.min(Math.abs(h.i - top.i), 12 - Math.abs(h.i - top.i)) >= 2 && h.x.w > top.x.w * 0.15);
        const wave = top ? mean(top.x) : mean(all);
        const accent = apart ? mean(apart.x) : (wave.map(v => v * 0.7) as Rgb);
        lights.sort((a, b) => b[3] - a[3]);
        const bright = lights.slice(0, Math.ceil(lights.length / 10));
        const glow = [0, 1, 2].map(k => bright.reduce((sum, p) => sum + p[k], 0) / bright.length / 255) as Rgb;
        resolve({ wave: brighten(wave), accent: brighten(accent), glow: brighten(glow) });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));


function useMusicFeel(settings: BackdropSettings): (dt: number) => WaveFeel {

  const knobs = useRef(settings);
  knobs.current = settings;

  const feel = useMemo(() => {
    let sample: MusicFeel | null = null;
    let at = 0;

    let anchor = 0;
    const s = { slowHigh: 0, note: 0, heavy: 0, busy: 0, short: 0, long: 0, energy: 0, shimmer: 0, lift: 0, alive: 0, loud: 0.5 };

    let ref = 0;

    let hit = 0;
    let power = 0;
    let powerNow = 0;

    let bassTop = 0;
    let heavyNow = 0;

    const fluxRef = [0, 0, 0];
    const fluxUsual = [0, 0, 0];
    const notes = [0, 0, 0];

    const receive = (f: MusicFeel) => {

      const values = [f.bass, f.mid, f.high, f.bpm, f.beatAgo, f.kick, f.rise, f.gain, ...(f.flux ?? [])];
      if (values.some(v => typeof v === 'number' && !Number.isFinite(v))) return;
      const now = performance.now() / 1000;
      const k = knobs.current;
      const gap = Math.min(1, now - at);
      if (Array.isArray(f.flux)) {
        f.flux.forEach((v, b) => {
          fluxRef[b] = Math.max(v, fluxRef[b] * Math.exp(-gap / 8), 0.05);
          fluxUsual[b] = fluxUsual[b] ? fluxUsual[b] + (v - fluxUsual[b]) * (1 - Math.exp(-gap / 2)) : v;

          const over = v / Math.max(fluxUsual[b], 0.02);
          const sharp = clamp01((over - 1.6 / k.noteSense) / 1.5);
          notes[b] = Math.max(notes[b], Math.pow(v / fluxRef[b], 2 / k.noteSense) * sharp);
        });
      }
      if (typeof f.kick === 'number') {

        ref = Math.max(f.kick, ref * Math.exp(-gap / 8), 0.01);
        bassTop = Math.max(f.kick, bassTop * Math.exp(-gap / 45), 0.01);
        heavyNow = Math.pow(f.kick / bassTop, 1.5);

        const size = Math.pow(f.kick / ref, 2.5 / k.kickSense);
        const threshold = 0.35 / k.kickSense;
        const sharp = clamp01((f.rise - threshold) / threshold);
        hit = Math.max(hit, size * sharp);
        powerNow = size;
      }
      if (f.bpm > 0 && f.beatAgo >= 0) {
        const beat = now - f.beatAgo;
        const period = 60 / f.bpm;
        if (!anchor) anchor = beat;
        else {
          const off = (beat - anchor) / period;
          anchor += (off - Math.round(off)) * period * 0.1;
        }
      } else anchor = 0;
      if (!sample) {
        s.slowHigh = f.high;
        s.short = s.long = (f.bass + f.mid + f.high) / 3;
      }
      sample = f;
      at = now;
    };

    const step = (dt: number): WaveFeel => {
      const now = performance.now() / 1000;
      const ease = (v: number, to: number, tau: number) => v + (to - v) * (1 - Math.exp(-dt / tau));
      const k = knobs.current;
      const f = k.react && sample && now - at < 0.3 ? sample : null;
      s.alive = ease(s.alive, f ? (f.gain ?? 1) : 0, f && (f.gain ?? 1) < s.alive ? 0.15 : 0.8);
      let pulse = 0;
      if (f) {
        s.slowHigh = ease(s.slowHigh, f.high, 4);

        s.energy = Math.max(ease(s.energy, 0, k.kickFade), hit, notes[0] * k.bassNotes);
        s.note = Math.max(ease(s.note, 0, 0.3), notes[1]);
        hit = 0;
        power = ease(power, powerNow, 0.3);
        s.heavy = ease(s.heavy, heavyNow, heavyNow > s.heavy ? 0.8 : 2.5);
        s.busy = ease(s.busy, Math.max(s.energy, s.note), 1.5);
        const sparkle = Math.max(clamp01(((f.high - s.slowHigh) / 0.08) * k.highSense), notes[2]);
        notes.fill(0);
        s.shimmer = ease(s.shimmer, sparkle, sparkle > s.shimmer ? 0.06 : 0.4);
        const level = (f.bass + f.mid + f.high) / 3;
        s.short = ease(s.short, level, 1.5);
        s.long = ease(s.long, level, 12);
        const loud = clamp01(((s.short - s.long) / 0.06) * k.chorusSense);
        s.lift = ease(s.lift, loud, loud > s.lift ? 2 : 4);

        s.loud = ease(s.loud, clamp01(0.5 + (level - s.long) / 0.1), 0.25);
        if (anchor && f.bpm > 0) {
          const beat = (now - anchor) * (f.bpm / 60);

          pulse = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * (beat - Math.floor(beat))), 3) * power;
        }
      } else {
        hit = 0;
        notes.fill(0);
        s.note = ease(s.note, 0, 0.3);
        s.heavy = ease(s.heavy, 0, 2.5);
        s.busy = ease(s.busy, 0, 1.5);
        power = ease(power, 0, 0.3);
        s.energy = ease(s.energy, 0, k.kickFade);
        s.shimmer = ease(s.shimmer, 0, 0.4);
        s.lift = ease(s.lift, 0, 4);
      }

      const drop = clamp01(0.7 * s.heavy + 0.6 * s.busy);
      const drive = Math.max(
        0.1,
        1 + k.loudSpeed * (s.loud - 0.5) + k.dropSpeed * drop + k.kickPush * s.energy + k.beatPush * pulse,
      );
      const a = s.alive;
      return {

        activity: !k.react ? 1 : f ? clamp01((Math.max(f.bass, f.mid, f.high) - 0.015) / 0.10) * clamp01(f.gain ?? 1) : 0,
        zoom: (k.beatZoom * pulse + k.kickZoom * s.energy) * a,
        glow: (k.kickGlow * s.energy + k.beatGlow * pulse + k.chorusGlow * s.lift + k.noteGlow * s.note) * a,
        crest: k.highsColor * s.shimmer * a,
        depth: (k.kickDepth * s.energy + k.chorusDepth * s.lift + k.noteDepth * s.note) * a,
        drive: 1 + (drive - 1) * a,
      };
    };

    return { receive, step };
  }, []);

  useEffect(() => window.api.ytmusic.onFeel(feel.receive), [feel]);
  return feel.step;
}


function useThemeVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setVersion(v => v + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent', 'style'] });
    return () => observer.disconnect();
  }, []);
  return version;
}

function AppBackdrop() {
  const artwork = useMusicStore(s => s.state?.artwork ?? '');
  const playing = useMusicStore(s => isPlaying(s.state));
  const bpm = useMusicStore(s => s.state?.bpm ?? 0);
  const backdropOnly = useUiStore(s => s.backdropOnly);
  const run = useUiStore(s => s.backdropRun);
  const theme = useThemeVersion();
  const saved = useProfileStore(s => s.activeConfig?.backdrop);
  const settings = useMemo(() => resolveBackdropSettings(saved), [saved]);
  const feel = useMusicFeel(settings);
  const [palette, setPalette] = useState<Palette>(() => plain(tokenRgb('primary', [0.5, 0.5, 0.5])));
  const background = useMemo(() => tokenRgb('background', [0, 0, 0]), [theme]);

  useEffect(() => {
    const accent = () => plain(tokenRgb('primary', [0.5, 0.5, 0.5]));
    if (settings.colors === 'rainbow') return;
    if (settings.colors === 'accent') return setPalette(tint(accent().wave));
    if (settings.colors === 'custom') {
      const rgb = hexRgb(settings.color);
      return setPalette(rgb ? tint(rgb) : accent());
    }
    let live = true;
    void coverPalette(artwork).then(p => {
      if (live) setPalette(p ?? accent());
    });
    return () => {
      live = false;
    };
  }, [artwork, theme, settings.colors, settings.color]);

  const flashRun = useUiStore(s => s.flashRun);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (!flashRun) return;
    const steps = [0, 1000, 2000, 3000].map((at, i) => setTimeout(() => setFlashing(i % 2 === 0), at));
    return () => {
      steps.forEach(clearTimeout);
      setFlashing(false);
    };
  }, [flashRun]);

  const orange = useMemo(() => {
    const warning = tokenRgb('warning', [0.95, 0.7, 0.2]);
    const destructive = tokenRgb('destructive', [0.9, 0.3, 0.2]);
    return tint(brighten(warning.map((v, i) => v * 0.55 + destructive[i] * 0.45) as Rgb));
  }, [theme]);
  const shown = flashing ? orange : palette;

  const Backdrop = settings.style === 'classic' ? ClassicDither : Dither;
  const context = { ...shown, background, playing, bpm, rainbow: settings.colors === 'rainbow' && !flashing, feel };

  return settings.style === 'none' ? null : (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 grid">
      <div className="min-h-0 [grid-area:1/1]" style={{ opacity: settings.opacity }}>
        {settings.style === 'balatro' ? (
          <Balatro key={run} {...toBalatroProps(settings, context)} />
        ) : (
          <Backdrop key={run} {...toDitherProps(settings, context)} />
        )}
      </div>
      <div
        className={`min-h-0 bg-gradient-to-b ${settings.style === 'classic' ? 'from-background/10 via-background/40 to-background/85' : 'from-background/5 via-background/20 to-background/50'} transition-opacity duration-300 [grid-area:1/1] ${backdropOnly ? 'opacity-0' : ''}`}
      />
    </div>
  );
}


export default memo(AppBackdrop);
