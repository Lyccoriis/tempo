const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta']);

function normalizeKey(key: string): string {
  if (key === ' ') return 'Space';
  if (key.length === 1) return key.toUpperCase();
  return key;
}

export function bindingFromEvent(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;

  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');
  parts.push(normalizeKey(e.key));
  return parts.join('+');
}

export function isUsableBinding(binding: string): boolean {
  const parts = binding.split('+');
  const key = parts[parts.length - 1];
  if (parts.some(part => part === 'Ctrl' || part === 'Alt' || part === 'Meta')) return true;
  return /^F\d{1,2}$/.test(key);
}

let capturing = false;

export function setCapturing(value: boolean): void {
  capturing = value;
}

export function isCapturing(): boolean {
  return capturing;
}

export function formatBinding(binding: string): string[] {
  return binding ? binding.split('+') : [];
}
