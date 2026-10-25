import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { EQ_BANDS, EQ_RANGE, EQ_STEP, bandLabel, eqResponse, type MusicEq } from '@/lib/equalizer';

const HEIGHT = 260;
const PAD = { left: 38, right: 14, top: 14, bottom: 26 };
const VIEW_DB = 15;
const FREQ_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const DB_TICKS = [-12, -6, 0, 6, 12];
const CURVE_POINTS = 240;
const SPECTRUM_MS = 33;
const FALL = 0.12;

const CURVE_FREQS = Array.from({ length: CURVE_POINTS }, (_, i) => 20 * Math.pow(1000, i / (CURVE_POINTS - 1)));

interface EqGraphProps {
  eq: MusicEq;
  disabled: boolean;
  live: boolean;
  onBand: (index: number, gain: number, done: boolean) => void;
}

export default function EqGraph({ eq, disabled, live, onBand }: EqGraphProps) {
  const box = useRef<HTMLDivElement>(null);
  const spectrum = useRef<SVGPathElement>(null);
  const [width, setWidth] = useState(800);
  const [drag, setDrag] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [heard, setHeard] = useState(false);

  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (hz: number) => PAD.left + (Math.log10(hz / 20) / 3) * plotW;
  const y = (db: number) => PAD.top + (1 - (Math.max(-VIEW_DB, Math.min(VIEW_DB, db)) + VIEW_DB) / (2 * VIEW_DB)) * plotH;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const curve = useMemo(() => {
    const db = eqResponse(eq, CURVE_FREQS);
    return CURVE_FREQS.map((f, i) => `${i ? 'L' : 'M'}${x(f).toFixed(1)},${y(db[i]).toFixed(1)}`).join(' ');
  }, [eq.gains, eq.q, eq.preamp, width]);

  const zeroY = y(0);
  const fill = `${curve} L${x(20000).toFixed(1)},${zeroY.toFixed(1)} L${x(20).toFixed(1)},${zeroY.toFixed(1)} Z`;

  useEffect(() => {
    const path = spectrum.current;
    if (!live || !path) return;
    let alive = true;
    let timer = 0;
    let shown: number[] = [];
    const bottom = PAD.top + plotH;
    const step = async () => {
      try {
        const read = await window.api.ytmusic.spectrum();
        if (!alive) return;
        if (read) {
          shown = read.levels.map((v, i) => Math.max(v, (shown[i] ?? 0) - FALL * (shown[i] ?? 0)));
          const n = shown.length;
          const pts = shown.map((v, i) => `L${(PAD.left + ((i + 0.5) / n) * plotW).toFixed(1)},${(bottom - v * plotH).toFixed(1)}`);
          path.setAttribute('d', `M${PAD.left},${bottom} ${pts.join(' ')} L${PAD.left + plotW},${bottom} Z`);
          setHeard(true);
        } else {
          shown = [];
          path.setAttribute('d', '');
          setHeard(false);
        }
      } catch {
        path.setAttribute('d', '');
      }
      if (alive) timer = window.setTimeout(step, SPECTRUM_MS);
    };
    void step();
    return () => {
      alive = false;
      window.clearTimeout(timer);
      path.setAttribute('d', '');
    };
  }, [live, plotW, plotH]);

  function gainAt(clientY: number): number {
    const rect = box.current!.getBoundingClientRect();
    const frac = (clientY - rect.top - PAD.top) / plotH;
    const db = (1 - frac) * 2 * VIEW_DB - VIEW_DB - eq.preamp;
    return Math.max(-EQ_RANGE, Math.min(EQ_RANGE, Math.round(db / EQ_STEP) * EQ_STEP));
  }

  function down(index: number, e: React.PointerEvent) {
    if (disabled || e.button > 0) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDrag(index);
  }

  function move(index: number, e: React.PointerEvent) {
    if (drag !== index) return;
    const g = gainAt(e.clientY);
    if (g !== eq.gains[index]) onBand(index, g, false);
  }

  function up(index: number, e: React.PointerEvent) {
    if (drag !== index) return;
    setDrag(null);
    onBand(index, gainAt(e.clientY), true);
  }

  const focus = drag ?? hover;

  return (
    <div ref={box} className={cn('w-full select-none', disabled && 'opacity-55')} style={{ height: HEIGHT }}>
      <svg width={width} height={HEIGHT} className="block" role="img" aria-label="Equalizer frequency response">
        <rect
          x={PAD.left}
          y={PAD.top}
          width={plotW}
          height={plotH}
          rx={6}
          className="fill-background/40 stroke-border"
        />
        {FREQ_TICKS.map(hz => (
          <g key={hz}>
            <line x1={x(hz)} x2={x(hz)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-border" />
            <text
              x={x(hz)}
              y={HEIGHT - 8}
              textAnchor={hz === 20 ? 'start' : hz === 20000 ? 'end' : 'middle'}
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {bandLabel(hz)}
            </text>
          </g>
        ))}
        {DB_TICKS.map(db => (
          <g key={db}>
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={y(db)}
              y2={y(db)}
              className={db === 0 ? 'stroke-foreground/30' : 'stroke-border'}
              strokeDasharray={db === 0 ? undefined : '3 4'}
            />
            <text x={PAD.left - 6} y={y(db) + 3.5} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
              {db > 0 ? `+${db}` : db}
            </text>
          </g>
        ))}

        <path ref={spectrum} className="fill-foreground/10" />

        <path d={fill} className="fill-primary/15" />
        <path d={curve} className="fill-none stroke-primary" strokeWidth={2} strokeLinejoin="round" />

        {EQ_BANDS.map((hz, i) => {
          const cx = x(hz);
          const cy = y((eq.gains[i] ?? 0) + eq.preamp);
          const on = focus === i;
          return (
            <g
              key={hz}
              className={cn(!disabled && (drag === i ? 'cursor-grabbing' : 'cursor-grab'))}
              onPointerDown={e => down(i, e)}
              onPointerMove={e => move(i, e)}
              onPointerUp={e => up(i, e)}
              onPointerCancel={e => up(i, e)}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onDoubleClick={() => !disabled && onBand(i, 0, true)}
            >
              <line x1={cx} x2={cx} y1={PAD.top} y2={PAD.top + plotH} className={cn('stroke-primary/0', on && 'stroke-primary/30')} />
              <circle cx={cx} cy={cy} r={14} className="fill-transparent" />
              <circle
                cx={cx}
                cy={cy}
                r={on ? 6.5 : 5}
                strokeWidth={2}
                className={cn('stroke-primary transition-[r] duration-150', on ? 'fill-primary' : 'fill-background')}
              />
              {on && (
                <text
                  x={cx}
                  y={cy - 12}
                  textAnchor="middle"
                  className="pointer-events-none fill-foreground font-mono text-[11px]"
                >
                  {`${bandLabel(hz)}Hz ${(eq.gains[i] ?? 0) > 0 ? '+' : ''}${eq.gains[i] ?? 0}dB`}
                </text>
              )}
            </g>
          );
        })}
        {live && !heard && (
          <text
            x={PAD.left + plotW - 10}
            y={PAD.top + 18}
            textAnchor="end"
            className="pointer-events-none fill-muted-foreground text-[11px]"
          >
            The live spectrum shows while a song plays
          </text>
        )}
      </svg>
    </div>
  );
}
