import { useEffect, useRef, useState } from 'react';
import { Heart, Music, SkipBack, SkipForward } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { GLASS } from '@/lib/glass';
import { cn } from '@/lib/utils';
import { isPlaying, useMusicStore } from '@/stores/useMusicStore';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const DUR = 460;

const QUART = (t: number) => 1 - (1 - t) ** 4;
const FLAT = (t: number) => t;
const SWING = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

function useTween(to: number, ms: number, instant = false, ease = QUART) {
  const [at, setAt] = useState(to);
  const cur = useRef(to);
  const raf = useRef(0);

  useEffect(() => {
    if (instant) {
      cur.current = to;
      setAt(to);
      return;
    }
    const from = cur.current;
    if (from === to) return;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      cur.current = from + (to - from) * ease(t);
      setAt(cur.current);
      raf.current = t < 1 ? requestAnimationFrame(step) : 0;
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [to, ms, instant, ease]);

  return at;
}

const SHUT = 78;

const PAD = 10;
const ART = { s: [40, 64] } as const;

const BOX_R = 'var(--radius-xl)';
const artR = (p: number) => `calc(var(--radius-md) * ${mix(ART.s[0] / ART.s[1], 1, p)})`;

const RAIL_GAP = 22;
const CLOCK_GAP = 8;
const OPS_GAP = 16;
const RAIL_H = 3;
const CLOCK_H = 10;
const LEAD = 46;

const RAIL_Y = PAD + ART.s[1] + RAIL_GAP;
const OPS_Y = RAIL_Y + RAIL_H + CLOCK_GAP + CLOCK_H + OPS_GAP + LEAD / 2;
const OPEN = Math.round(OPS_Y + LEAD / 2 + PAD);

const OPS_SHUT = 88;

const PAUSE_L = [6, 4, 10, 4, 10, 20, 6, 20] as const;
const PLAY_L = [6.5, 4, 13.25, 8, 13.25, 16, 6.5, 20] as const;
const PAUSE_R = [14, 4, 18, 4, 18, 20, 14, 20] as const;
const PLAY_R = [13.25, 8, 20, 12, 20, 12, 13.25, 16] as const;

const quad = (a: readonly number[], b: readonly number[], t: number) => {
  let d = '';
  for (let i = 0; i < 8; i += 2)
    d += `${i ? 'L' : 'M'}${mix(a[i], b[i], t).toFixed(2)} ${mix(a[i + 1], b[i + 1], t).toFixed(2)}`;
  return `${d}Z`;
};

function Mark({ playing, size, still }: { playing: boolean; size: number; still: boolean }) {
  const t = useTween(playing ? 0 : 1, 300, still, SWING);

  const goo = Math.sin(clamp(t, 0, 1) * Math.PI);
  const pull = 1.6 * goo;
  const tip = (playing ? -9 : 9) * goo;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
      style={{
        transformOrigin: '50% 50%',
        transform: `rotate(${tip}deg) scale(${1 - 0.13 * goo}, ${1 + 0.11 * goo})`,
      }}
    >
      <path d={quad(PAUSE_L, PLAY_L, t)} transform={`translate(${pull} 0)`} />
      <path d={quad(PAUSE_R, PLAY_R, t)} transform={`translate(${-pull} 0)`} />
    </svg>
  );
}

const LIKE = 30;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const stillness = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function Pill({ W }: { W: number }) {
  const music = useMusicStore(s => s.state);
  const send = useMusicStore(s => s.send);
  const skin = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const still = stillness();

  const going = isPlaying(music);
  const liked = music?.like === 'LIKE';
  const total = music?.duration ?? 0;
  const at = Math.min(music?.position ?? 0, total);

  const p = useTween(open ? 1 : 0, DUR, still);

  const u = useTween(open ? 1 : 0, DUR, still, FLAT);
  const swell = Math.sin(Math.PI * clamp(u, 0, 1) ** 1.5);
  const zoom = open ? 1 : 1 - 0.035 * swell;

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!e.isTrusted) return;
      const el = skin.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    const id = window.setTimeout(() => document.addEventListener('pointerdown', away), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('pointerdown', away);
    };
  }, [open]);

  const art = { x: PAD, y: PAD, s: mix(ART.s[0], ART.s[1], p) };
  const h = mix(SHUT, OPEN, p);

  const side = mix(24, 34, p);
  const lead = mix(30, LEAD, p);
  const gap = mix(5, 14, p);
  const opsX = mix(W - PAD - OPS_SHUT / 2, W / 2, p);
  const opsY = mix(PAD + ART.s[0] / 2, OPS_Y, p);

  const late = clamp((p - 0.6) / 0.4, 0, 1);

  const wordsLeft = mix(PAD + ART.s[0] + 10, PAD + ART.s[1] + 10, p);
  const shutWords = W - PAD - OPS_SHUT - 8 - (PAD + ART.s[0] + 10);

  return (
    <div className="snd" style={{ width: W, height: h }}>
      <div
        className={cn(GLASS, 'snd-box')}
        ref={skin}
        data-open={open || undefined}
        style={{ width: W, height: h, borderRadius: BOX_R, scale: zoom }}
      >
        <span
          className="snd-art"
          aria-hidden="true"
          style={{
            left: art.x,
            top: art.y,
            width: art.s,
            height: art.s,
            borderRadius: artR(p),
          }}
        >
          {music?.artwork && <img src={music.artwork} alt="" referrerPolicy="no-referrer" />}
        </span>

        <span
          className="snd-say"
          style={{
            left: wordsLeft,
            top: PAD,
            height: art.s,
            width: mix(shutWords, W - PAD - (PAD + ART.s[1] + 10) - (LIKE + 10), p),
          }}
        >
          <span className="snd-title" style={{ fontSize: mix(13, 15.5, p) }}>
            {music?.title || 'Nothing playing'}
          </span>
          <span className="snd-by" style={{ fontSize: mix(11, 12, p) }}>
            {music?.artist || 'YouTube Music'}
          </span>
        </span>

        <span
          className="snd-bar"
          style={{ top: mix(SHUT - PAD - RAIL_H, RAIL_Y, p), left: PAD, width: W - PAD * 2 }}
        >
          <span className="snd-rail">
            <span className="snd-run" style={{ width: `${total ? (at / total) * 100 : 0}%` }} />
          </span>
          <span className="snd-clock" style={{ opacity: late }}>
            <span>{clock(at)}</span>
            <span>−{clock(total - at)}</span>
          </span>
        </span>

        <button
          className="snd-tap"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          aria-label={open ? 'Collapse the player' : 'Open the player'}
          style={{
            left: mix(0, PAD, p),
            top: mix(0, PAD, p),
            width: mix(W, W - PAD * 2, p),
            height: mix(SHUT, ART.s[1], p),
            borderRadius: `calc(${BOX_R} * ${1 - p} + var(--radius-md) * ${p})`,
          }}
        />

        <button
          className="snd-like"
          data-on={liked || undefined}
          onClick={() => void send({ kind: 'like' })}
          aria-label={liked ? 'Remove from liked songs' : 'Add to liked songs'}
          aria-pressed={liked}
          tabIndex={open ? 0 : -1}
          style={{
            left: W - PAD - LIKE,
            top: PAD,
            width: LIKE,
            height: LIKE,
            opacity: late,
            pointerEvents: late > 0.9 ? 'auto' : 'none',
          }}
        >
          <Heart size={16} strokeWidth={2} fill={liked ? 'currentColor' : 'none'} />
        </button>

        <span className="snd-ops" style={{ left: opsX, top: opsY, gap }}>
          <button
            className="snd-op"
            style={{ width: side, height: side }}
            onClick={() => void send({ kind: 'previous' })}
            aria-label="Previous"
          >
            <SkipBack size={mix(13, 16, p)} strokeWidth={2} />
          </button>

          <button
            className="snd-op"
            data-lead
            style={{ width: lead, height: lead }}
            onClick={() => void send({ kind: 'toggle' })}
            aria-label={going ? 'Pause' : 'Play'}
            aria-pressed={going}
          >
            <Mark playing={going} size={mix(14, 18, p)} still={still} />
          </button>

          <button
            className="snd-op"
            style={{ width: side, height: side }}
            onClick={() => void send({ kind: 'next' })}
            aria-label="Next"
          >
            <SkipForward size={mix(13, 16, p)} strokeWidth={2} />
          </button>
        </span>
      </div>
    </div>
  );
}

const WIDTH = 260;

export default function NowPlaying({ collapsed }: { collapsed: boolean }) {
  const music = useMusicStore(s => s.state);

  if (!music?.videoId) return null;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size={collapsed ? 'icon-sm' : 'sm'}
              className={collapsed ? 'self-center' : 'justify-start'}
              aria-label="Now playing"
            >
              <Music size={15} strokeWidth={1.6} />
              {!collapsed && <span className="truncate">{music.title}</span>}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">
          {music.title}
          {music.artist ? `, ${music.artist}` : ''}
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="right" align="end" sideOffset={12} className="w-auto border-0 bg-transparent p-0 shadow-none">
        <Pill W={WIDTH} />
      </PopoverContent>
    </Popover>
  );
}
