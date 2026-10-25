export interface MusicEq {
  enabled: boolean;
  preamp: number;
  gains: number[];
  q: number;
  balance: number;
  limiter: boolean;

  preset: string;

  auto: boolean;

  autoFallback: string;
}

export interface EqPreset {
  id: string;
  name: string;
  preamp: number;
  gains: number[];
}

export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_RANGE = 12;
export const EQ_STEP = 0.5;

export const EQ_DEFAULTS: MusicEq = {
  enabled: false,
  preamp: 0,
  gains: EQ_BANDS.map(() => 0),
  q: 1.41,
  balance: 0,
  limiter: true,
  preset: 'flat',
  auto: false,
  autoFallback: 'flat',
};

export const OWN_BANDS = 'own';

export const EQ_PRESETS: EqPreset[] = [
  { id: 'flat', name: 'Flat', preamp: 0, gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'bass-boost', name: 'Bass boost', preamp: -3, gains: [6, 5, 4, 2.5, 1, 0, 0, 0, 0, 0] },
  { id: 'bass-cut', name: 'Bass reducer', preamp: 0, gains: [-6, -5, -4, -2.5, -1, 0, 0, 0, 0, 0] },
  { id: 'treble-boost', name: 'Treble boost', preamp: -3, gains: [0, 0, 0, 0, 0, 1, 2.5, 4, 5, 6] },
  { id: 'treble-cut', name: 'Treble reducer', preamp: 0, gains: [0, 0, 0, 0, 0, -1, -2.5, -4, -5, -6] },
  { id: 'vocal', name: 'Vocal', preamp: -2, gains: [-2, -2, -1, 1, 3, 4, 3.5, 2, 0, -1] },
  { id: 'rock', name: 'Rock', preamp: -2.5, gains: [4.5, 3.5, 2.5, 1, -0.5, -1, 0.5, 2.5, 3.5, 4.5] },
  { id: 'pop', name: 'Pop', preamp: -2, gains: [-1, -0.5, 0.5, 2, 3.5, 3.5, 2, 0.5, -0.5, -1] },
  { id: 'electronic', name: 'Electronic', preamp: -3, gains: [4.5, 4, 1.5, 0, -1.5, 1.5, 0.5, 1.5, 4, 4.5] },
  { id: 'hip-hop', name: 'Hip hop', preamp: -3, gains: [5, 4.5, 1.5, 3, -1, -1, 1.5, -0.5, 2, 3] },
  { id: 'jazz', name: 'Jazz', preamp: -1.5, gains: [3, 2, 1, 2, -1.5, -1.5, 0, 1, 2, 3] },
  { id: 'classical', name: 'Classical', preamp: -2, gains: [4, 3, 2.5, 2, -1, -1, 0, 2, 3, 3.5] },
  { id: 'acoustic', name: 'Acoustic', preamp: -2, gains: [4, 4, 3, 1, 2, 1.5, 3, 3.5, 3, 2] },
  { id: 'piano', name: 'Piano', preamp: -1.5, gains: [1.5, 1, 0, 2, 2.5, 1, 3, 3.5, 2, 2.5] },
  { id: 'loudness', name: 'Loudness', preamp: -3, gains: [5, 4, 0, 0, -2, 0, -1, -3, 4, 1] },
  { id: 'small-speakers', name: 'Small speakers', preamp: -3, gains: [5, 4, 3, 1.5, 0, -1, 0, 1, 2, 2] },
  { id: 'late-night', name: 'Late night', preamp: 0, gains: [-3, -2, -1, 0, 1, 1.5, 1, 0, -1.5, -3] },
];

export interface MusicFade {
  seconds: number;

  keepAlbums: boolean;
}

export const FADE_DEFAULTS: MusicFade = { seconds: 0, keepAlbums: true };

export function readFade(saved: Partial<MusicFade> | undefined): MusicFade {
  return { ...FADE_DEFAULTS, ...saved };
}

export function readEq(saved: Partial<MusicEq> | undefined): MusicEq {
  const eq = { ...EQ_DEFAULTS, ...saved };
  return { ...eq, gains: EQ_BANDS.map((_, i) => eq.gains[i] ?? 0) };
}

export function bandLabel(hz: number): string {
  return hz >= 1000 ? `${hz / 1000}k` : String(hz);
}

const RATE = 48000;

type Coeffs = [b0: number, b1: number, b2: number, a0: number, a1: number, a2: number];

function coeffs(kind: 'low' | 'peak' | 'high', hz: number, gain: number, q: number): Coeffs {
  const A = Math.pow(10, gain / 40);
  const w0 = (2 * Math.PI * hz) / RATE;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  if (kind === 'peak') {
    const alpha = sin / (2 * q);
    return [1 + alpha * A, -2 * cos, 1 - alpha * A, 1 + alpha / A, -2 * cos, 1 - alpha / A];
  }
  const alpha = (sin / 2) * Math.SQRT2;
  const k = 2 * Math.sqrt(A) * alpha;
  if (kind === 'low') {
    return [
      A * (A + 1 - (A - 1) * cos + k),
      2 * A * (A - 1 - (A + 1) * cos),
      A * (A + 1 - (A - 1) * cos - k),
      A + 1 + (A - 1) * cos + k,
      -2 * (A - 1 + (A + 1) * cos),
      A + 1 + (A - 1) * cos - k,
    ];
  }
  return [
    A * (A + 1 + (A - 1) * cos + k),
    -2 * A * (A - 1 + (A + 1) * cos),
    A * (A + 1 + (A - 1) * cos - k),
    A + 1 - (A - 1) * cos + k,
    2 * (A - 1 - (A + 1) * cos),
    A + 1 - (A - 1) * cos - k,
  ];
}

function magnitudeDb([b0, b1, b2, a0, a1, a2]: Coeffs, hz: number): number {
  const w = (2 * Math.PI * hz) / RATE;
  const c1 = Math.cos(w);
  const s1 = Math.sin(w);
  const c2 = Math.cos(2 * w);
  const s2 = Math.sin(2 * w);
  const nr = b0 + b1 * c1 + b2 * c2;
  const ni = -(b1 * s1 + b2 * s2);
  const dr = a0 + a1 * c1 + a2 * c2;
  const di = -(a1 * s1 + a2 * s2);
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
}

export function bandKind(index: number): 'low' | 'peak' | 'high' {
  return index === 0 ? 'low' : index === EQ_BANDS.length - 1 ? 'high' : 'peak';
}

export function eqResponse(eq: Pick<MusicEq, 'gains' | 'q' | 'preamp'>, freqs: number[]): number[] {
  const filters = EQ_BANDS.map((hz, i) => coeffs(bandKind(i), hz, eq.gains[i] ?? 0, eq.q));
  return freqs.map(f => filters.reduce((sum, c) => sum + magnitudeDb(c, f), eq.preamp));
}

const GENRE_PRESETS: [RegExp, string][] = [
  [/hip.?hop|rap|trap|drill|grime|urban|reggaeton|dembow|reggae|dancehall/i, 'hip-hop'],
  [/r&b|rhythm and blues/i, 'hip-hop'],
  [/soul|funk|motown/i, 'jazz'],
  [/electr|dance|house|techno|trance|edm|dubstep|drum|garage(?! rock)|disco/i, 'electronic'],
  [/(indie|alternative|alt|dream|bedroom) pop/i, 'pop'],
  [/(indie|alternative|alt) (folk|country)/i, 'acoustic'],
  [/metal|hard rock|punk|grunge|rock|alternative|indie/i, 'rock'],
  [/jazz|blues|swing|bossa/i, 'jazz'],
  [/classical|cl[aá]sica|opera|orchestr|baroque|soundtrack|banda sonora|score|new age|ambient/i, 'classical'],
  [/piano/i, 'piano'],
  [/acoustic|ac[uú]stic|folk|country|singer|cantautor|americana|bluegrass/i, 'acoustic'],
  [/vocal|a cappella|gospel|christian|cristian|easy listening|lounge/i, 'vocal'],
  [/pop|anime|latin|latino|tropical|salsa|cumbia|bachata|mexican|regional|world/i, 'pop'],
];

export function genrePreset(genre: string | null): string | null {
  if (!genre) return null;
  return GENRE_PRESETS.find(([test]) => test.test(genre))?.[1] ?? null;
}

export type EqSound = Pick<MusicEq, 'enabled' | 'preamp' | 'gains' | 'q' | 'balance' | 'limiter'>;

export type EqManual = Pick<MusicEq, 'preset' | 'preamp' | 'gains'> & { videoId: string };

export function eqSound(eq: MusicEq, saved: EqPreset[], autoPreset: string | null, manual: EqManual | null = null): EqSound {
  const preset = eq.auto && autoPreset && autoPreset !== OWN_BANDS ? [...EQ_PRESETS, ...saved].find(p => p.id === autoPreset) : null;
  const own = eq.auto && manual ? manual : null;
  return {
    enabled: eq.enabled,
    preamp: own ? own.preamp : preset ? preset.preamp : eq.preamp,
    gains: own ? own.gains : preset ? EQ_BANDS.map((_, i) => preset.gains[i] ?? 0) : eq.gains,
    q: eq.q,
    balance: eq.balance,
    limiter: eq.limiter,
  };
}
