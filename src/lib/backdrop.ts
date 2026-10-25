export type BackdropColors = 'cover' | 'accent' | 'custom' | 'rainbow';
export type BackdropStyle = 'ascii' | 'classic' | 'balatro' | 'none';

type Rgb = [number, number, number];

function hsl(h: number, s: number, l: number): Rgb {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

export function rainbowPalette(turn: number): [Rgb, Rgb, Rgb] {
  const h = ((turn % 1) + 1) % 1;
  return [hsl(h, 0.85, 0.55), hsl((h + 0.33) % 1, 0.85, 0.5), hsl((h + 0.66) % 1, 0.9, 0.7)];
}

export interface BackdropSettings {
  style: BackdropStyle;
  react: boolean;
  mouseInteraction: boolean;
  colors: BackdropColors;
  color: string;
  opacity: number;
  pixelSize: number;
  colorNum: number;
  frequency: number;
  amplitude: number;
  speed: number;
  colorDrift: number;
  beatZoom: number;
  kickZoom: number;
  kickGlow: number;
  beatGlow: number;
  chorusGlow: number;
  highsColor: number;
  kickDepth: number;
  chorusDepth: number;
  bassNotes: number;
  noteGlow: number;
  noteDepth: number;
  noteSense: number;
  loudSpeed: number;
  dropSpeed: number;
  kickPush: number;
  beatPush: number;
  kickSense: number;
  highSense: number;
  chorusSense: number;
  kickFade: number;
}

export const BACKDROP_DEFAULTS: BackdropSettings = {
  style: 'classic',
  react: true,
  mouseInteraction: true,
  colors: 'cover',
  color: '#7c5cff',
  opacity: 0.4,
  pixelSize: 3,
  colorNum: 4,
  frequency: 2.5,
  amplitude: 0.3,
  speed: 1,
  colorDrift: 1.5,
  beatZoom: 0.06,
  kickZoom: 0.07,
  kickGlow: 0.4,
  beatGlow: 0.12,
  chorusGlow: 0.3,
  highsColor: 0.8,
  kickDepth: 0.07,
  chorusDepth: 0.08,
  bassNotes: 0.7,
  noteGlow: 0.3,
  noteDepth: 0.04,
  noteSense: 1,
  loudSpeed: 1.3,
  dropSpeed: 1.5,
  kickPush: 1.1,
  beatPush: 0.45,
  kickSense: 1.2,
  highSense: 1.2,
  chorusSense: 1,
  kickFade: 0.35,
};

export function resolveBackdropSettings(saved?: Partial<BackdropSettings>): BackdropSettings {
  return { ...BACKDROP_DEFAULTS, ...saved, mouseInteraction: saved?.mouseInteraction ?? true };
}

type Knob = keyof Omit<BackdropSettings, 'style' | 'react' | 'mouseInteraction' | 'colors' | 'color'>;

export interface KnobInfo {
  key: Knob;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

export const BACKDROP_KNOBS: { title: string; description: string; music: boolean; knobs: KnobInfo[] }[] = [
  {
    title: 'Look',
    description: 'The waves themselves, with or without music',
    music: false,
    knobs: [
      { key: 'opacity', label: 'Opacity', hint: 'How strongly the backdrop shows through the panels', min: 0.1, max: 1, step: 0.05 },
      { key: 'pixelSize', label: 'Pixel size', hint: 'Size of each glyph or dither dot, bigger is coarser', min: 1, max: 8, step: 1 },
      { key: 'colorNum', label: 'Color steps', hint: 'How many shades the dither uses, fewer looks more retro', min: 2, max: 8, step: 1 },
      { key: 'frequency', label: 'Wave detail', hint: 'How many waves fit on screen, higher is busier', min: 1, max: 5, step: 0.1 },
      { key: 'amplitude', label: 'Wave depth', hint: 'How tall the waves are', min: 0.1, max: 0.6, step: 0.01 },
      { key: 'speed', label: 'Speed', hint: 'Base speed of the waves', min: 0.2, max: 3, step: 0.05, unit: 'x' },
      { key: 'colorDrift', label: 'Color drift', hint: 'How much the two colors swirl into each other', min: 0, max: 5, step: 0.1 },
    ],
  },
  {
    title: 'Music reactions',
    description: 'How far a kick, a beat, a note, a chorus and the highs push the picture',
    music: true,
    knobs: [
      { key: 'beatZoom', label: 'Beat breath', hint: 'Gentle zoom in and out on every beat', min: 0, max: 0.15, step: 0.005 },
      { key: 'kickZoom', label: 'Kick zoom', hint: 'Quick zoom punch on each kick drum', min: 0, max: 0.15, step: 0.005 },
      { key: 'kickGlow', label: 'Kick glow', hint: 'Flash of brightness on each kick drum', min: 0, max: 1, step: 0.01 },
      { key: 'beatGlow', label: 'Beat glow', hint: 'Soft brightness pulse on every beat', min: 0, max: 0.5, step: 0.01 },
      { key: 'chorusGlow', label: 'Chorus glow', hint: 'Brighter for as long as a loud part or chorus lasts', min: 0, max: 1, step: 0.01 },
      { key: 'highsColor', label: 'Highs color', hint: 'Cymbals and hi hats tint the wave tops with the highlight color', min: 0, max: 1, step: 0.01 },
      { key: 'kickDepth', label: 'Kick depth', hint: 'Waves get taller on each kick drum', min: 0, max: 0.2, step: 0.005 },
      { key: 'chorusDepth', label: 'Chorus depth', hint: 'Waves get taller during a loud part or chorus', min: 0, max: 0.2, step: 0.005 },
      { key: 'bassNotes', label: 'Bass notes', hint: 'Bass notes hit like kicks do, not only drums', min: 0, max: 1, step: 0.05 },
      { key: 'noteGlow', label: 'Note glow', hint: 'Brightness on each melody note', min: 0, max: 1, step: 0.01 },
      { key: 'noteDepth', label: 'Note depth', hint: 'Waves get taller on each melody note', min: 0, max: 0.2, step: 0.005 },
    ],
  },
  {
    title: 'Music speed',
    description: 'How the wave speed follows the song, loud parts and drops run faster and quiet ones drift',
    music: true,
    knobs: [
      { key: 'loudSpeed', label: 'Loudness', hint: 'Loud parts speed the waves up, quiet parts slow them down', min: 0, max: 3, step: 0.05 },
      { key: 'dropSpeed', label: 'Drops', hint: 'Extra speed for as long as a drop lasts', min: 0, max: 4, step: 0.05 },
      { key: 'kickPush', label: 'Kick push', hint: 'Each kick shoves the waves forward', min: 0, max: 3, step: 0.05 },
      { key: 'beatPush', label: 'Beat push', hint: 'Each beat nudges the waves forward', min: 0, max: 2, step: 0.05 },
    ],
  },
  {
    title: 'Sensitivity',
    description: 'How small a change in the music still counts',
    music: true,
    knobs: [
      { key: 'kickSense', label: 'Kicks', hint: 'Higher catches softer kicks', min: 0.3, max: 3, step: 0.05, unit: 'x' },
      { key: 'noteSense', label: 'Notes', hint: 'Higher catches softer notes', min: 0.3, max: 3, step: 0.05, unit: 'x' },
      { key: 'highSense', label: 'Highs', hint: 'Higher catches quieter cymbals and hi hats', min: 0.3, max: 3, step: 0.05, unit: 'x' },
      { key: 'chorusSense', label: 'Chorus', hint: 'Higher counts smaller jumps in loudness as a chorus', min: 0.3, max: 3, step: 0.05, unit: 'x' },
      { key: 'kickFade', label: 'Kick fade', hint: 'How long a kick takes to fade out', min: 0.05, max: 1.5, step: 0.05, unit: 's' },
    ],
  },
];
