export const ACCENTS = [
  'red',
  'rose',
  'coral',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'mint',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'lavender',
  'fuchsia',
  'pink',
  'mono',
];

export const isHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

export function foregroundFor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? 'oklch(0.2 0 0)' : 'oklch(0.985 0 0)';
}
