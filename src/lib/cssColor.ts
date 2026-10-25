const cache = new Map<string, string>();
let ctx: CanvasRenderingContext2D | null = null;

function context(): CanvasRenderingContext2D | null {
  if (ctx) return ctx;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  return ctx;
}

function resolveVar(value: string): string {
  const root = getComputedStyle(document.documentElement);
  return value.trim().replace(/var\((--[^),]+)\)/g, (_, name: string) =>
    root.getPropertyValue(name).trim(),
  );
}

export function toHex(value: string, fallback = '#888888'): string {
  const cached = cache.get(value);
  if (cached) return cached;

  const resolved = resolveVar(value);
  const target = context();
  if (!resolved || !target) return fallback;

  target.clearRect(0, 0, 1, 1);
  target.fillStyle = '#000000';
  target.fillStyle = resolved;
  target.fillRect(0, 0, 1, 1);

  const [r, g, b] = target.getImageData(0, 0, 1, 1).data;
  const hex = `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`;
  cache.set(value, hex);
  return hex;
}

export function clearColorCache(): void {
  cache.clear();
}
