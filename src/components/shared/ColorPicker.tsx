import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Pipette } from 'lucide-react';

import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { isHexColor } from '@/lib/accents';
import { clearColorCache, toHex } from '@/lib/cssColor';
import { GLASS } from '@/lib/glass';
import { cn } from '@/lib/utils';

interface Hsv {
  h: number;
  s: number;
  v: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function hexToHsv(hex: string): Hsv {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = !d ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

function dragHandlers(onMove: (x: number, y: number) => void, onEnd: () => void) {
  const at = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    onMove(clamp01((e.clientX - box.left) / box.width), clamp01((e.clientY - box.top) / box.height));
  };
  return {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if (e.button > 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      at(e);
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) at(e);
    },
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      onEnd();
    },
  };
}

export default function ColorPicker({
  value,
  onChange,
  label,
  active,
}: {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  active?: boolean;
}) {
  const [hsv, setHsv] = useState<Hsv>({ h: 0, s: 0, v: 0 });
  const [text, setText] = useState('');
  const hex = hsvToHex(hsv);

  function open(next: boolean) {
    if (!next) return;
    clearColorCache();
    const start = isHexColor(value) ? value : toHex('var(--primary)');
    setHsv(hexToHsv(start));
    setText(start.slice(1));
  }

  function show(next: Hsv) {
    setHsv(next);
    setText(hsvToHex(next).slice(1));
  }

  function commit(out = hex) {
    if (out !== value) onChange(out);
  }

  function nudge(e: KeyboardEvent<HTMLDivElement>, keys: Partial<Record<string, Partial<Hsv>>>) {
    const step = keys[e.key];
    if (!step) return;
    e.preventDefault();
    const size = e.shiftKey ? 10 : 1;
    const next = {
      h: (hsv.h + (step.h ?? 0) * size + 360) % 360,
      s: clamp01(hsv.s + (step.s ?? 0) * size),
      v: clamp01(hsv.v + (step.v ?? 0) * size),
    };
    show(next);
    commit(hsvToHex(next));
  }

  return (
    <Popover onOpenChange={open}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={active}
          style={active ? { background: value } : undefined}
          className={cn(
            'grid size-6 place-items-center rounded-full border-2 text-muted-foreground transition-transform duration-150 hover:scale-110 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
            active ? 'border-foreground' : 'border-dashed border-muted-foreground/60',
          )}
        >
          {!active && <Pipette size={13} strokeWidth={1.6} />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className={cn(GLASS, 'flex w-60 flex-col gap-3 rounded-xl p-3')}>

        <div
          role="slider"
          tabIndex={0}
          aria-label="Saturation and brightness"
          aria-valuetext={`saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
          className="relative h-36 cursor-crosshair touch-none rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          style={{
            backgroundColor: `hsl(${hsv.h} 100% 50%)`,
            backgroundImage: 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
          }}
          onKeyDown={e =>
            nudge(e, {
              ArrowLeft: { s: -0.01 },
              ArrowRight: { s: 0.01 },
              ArrowUp: { v: 0.01 },
              ArrowDown: { v: -0.01 },
            })
          }
          {...dragHandlers(
            (x, y) => show({ ...hsv, s: x, v: 1 - y }),
            () => commit(),
          )}
        >
          <span
            className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
            style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }}
          />
        </div>

        <div
          role="slider"
          tabIndex={0}
          aria-label="Hue"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(hsv.h)}
          className="relative h-3 cursor-pointer touch-none rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          style={{
            background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
          }}
          onKeyDown={e => nudge(e, { ArrowLeft: { h: -1 }, ArrowDown: { h: -1 }, ArrowRight: { h: 1 }, ArrowUp: { h: 1 } })}
          {...dragHandlers(
            x => show({ ...hsv, h: x * 359.9 }),
            () => commit(),
          )}
        >
          <span
            className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
            style={{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h} 100% 50%)` }}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="size-8 shrink-0 rounded-md border" style={{ background: hex }} />
          <InputGroup className="h-8">
            <InputGroupAddon>#</InputGroupAddon>
            <InputGroupInput
              aria-label="Hex color"
              spellCheck={false}
              maxLength={7}
              value={text}
              className="font-mono text-[13px] uppercase"
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6);
                setText(raw);
                if (raw.length === 6) {
                  setHsv(hexToHsv(`#${raw}`));
                  commit(`#${raw.toLowerCase()}`);
                }
              }}
              onBlur={() => setText(hex.slice(1))}
            />
          </InputGroup>
        </div>
      </PopoverContent>
    </Popover>
  );
}
