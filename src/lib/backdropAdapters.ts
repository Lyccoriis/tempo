import type { DitherProps, WaveFeel } from '@/components/reactbits/Dither';
import type { BalatroProps } from '@/components/reactbits/Balatro';
import type { BackdropSettings } from './backdrop';

type Rgb = [number, number, number];
export interface BackdropContext {
  wave: Rgb;
  accent: Rgb;
  glow: Rgb;
  background: Rgb;
  playing: boolean;
  bpm: number;
  rainbow: boolean;
  feel: (dt: number) => WaveFeel;
}
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const hex = (rgb: Rgb) => '#' + rgb.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');

export function toDitherProps(s: BackdropSettings, c: BackdropContext): DitherProps {
  return {
    waveColor: c.wave, accentColor: c.accent, glowColor: c.glow,
    backgroundColor: c.background, rainbow: c.rainbow, feel: c.feel,
    colorNum: s.colorNum, pixelSize: s.pixelSize, colorDrift: s.colorDrift,
    waveAmplitude: s.amplitude, waveFrequency: s.frequency,
    waveSpeed: s.speed * (c.playing ? 0.08 * (c.bpm ? c.bpm / 120 : 1) : 0.015),
    enableMouseInteraction: s.mouseInteraction,
  };
}

export function toBalatroProps(s: BackdropSettings, c: BackdropContext): BalatroProps {

  const speed = 0.32 * Math.pow(clamp(s.speed, 0.2, 3), 0.85);
  const intensity = (clamp(s.amplitude, 0.1, 0.6) - 0.1) / 0.5;
  return {
    spinSpeed: speed * (c.playing ? clamp((c.bpm || 120) / 120, 0.7, 1.5) : 1),
    spinRotation: -0.32, isRotate: true, spinEase: 1,
    spinAmount: 0.12 + intensity * 0.38,
    contrast: 2.5 + intensity * 1.5, lighting: 0.18,
    distortionScale: 16 + (clamp(s.frequency, 1, 5) - 1) * 4,

    pixelFilter: 1600 / clamp(s.pixelSize, 1, 8),
    color1: hex(c.wave.map(v => v * 0.72) as Rgb),
    color2: hex(c.wave.map((v, i) => v * 0.72 + c.glow[i] * 0.20 + 0.04) as Rgb),
    color3: hex(c.background.map((v, i) => v * 0.8 + c.wave[i] * 0.035) as Rgb),
    colorDrift: s.colorDrift * 0.12,
    mouseInteraction: s.mouseInteraction, mouseRadius: 0.18,
    rainbow: c.rainbow, feel: c.feel,
  };
}
