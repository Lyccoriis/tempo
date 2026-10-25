import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type AnimationPlaybackControls,
  type MotionStyle,
} from 'motion/react';

import { cn } from '@/lib/utils';

interface FlipCardProps {
  front: ReactNode;
  back: ReactNode;
  ariaLabel?: string;
  className?: string;
  onFlip?: (shown: boolean) => void;
}

interface Grip {
  id: number;
  x: number;
  base: number;
  moved: boolean;
  slop: number;
  hist: { t: number; v: number }[];
}

const SLOP = { fine: 4, coarse: 8 };
const TILT_SPRING = { stiffness: 240, damping: 24, mass: 0.6 };
const LIFT_SPRING = { stiffness: 320, damping: 26 };
const FLIP_SPRING = { stiffness: 170, damping: 20 };
const TILT_MAX = 12;
const HOVER_SCALE = 1.03;
const PERSPECTIVE = 1100;
const FLING = 0.16;
const HISTORY_MS = 90;

const FACE =
  'absolute inset-0 overflow-hidden rounded-[inherit] bg-card text-card-foreground [backface-visibility:hidden] [&_img]:[-webkit-user-drag:none] group-data-[fade]:opacity-0 group-data-[fade]:[backface-visibility:visible] group-data-[fade]:transition-opacity group-data-[fade]:duration-150';
const GLARE =
  'pointer-events-none absolute inset-0 [opacity:var(--fc-sheen,0)] [background:radial-gradient(circle_farthest-side_at_var(--fc-gx,50%)_var(--fc-gy,50%),color-mix(in_oklab,var(--foreground)_22%,transparent)_0%,color-mix(in_oklab,var(--foreground)_11%,transparent)_26%,color-mix(in_oklab,var(--foreground)_4%,transparent)_60%,transparent_100%)]';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const snap = (deg: number) => Math.round(deg / 180) * 180;
const isBack = (deg: number) => Math.abs(Math.round(deg / 180)) % 2 === 1;

export default function FlipCard({ front, back, ariaLabel = 'Flip card', className, onFlip }: FlipCardProps) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(false);
  const [dragging, setDragging] = useState(false);
  const shownRef = useRef(shown);
  const rootRef = useRef<HTMLDivElement>(null);
  const grip = useRef<Grip | null>(null);
  const spin = useRef<AnimationPlaybackControls | null>(null);

  const turn = useMotionValue(0);
  const tiltX = useSpring(0, TILT_SPRING);
  const tiltY = useSpring(0, TILT_SPRING);
  const lift = useSpring(1, LIFT_SPRING);
  const sheen = useSpring(0, LIFT_SPRING);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);

  const sumY = useTransform([turn, tiltY], ([t, y]: number[]) => t + y);
  const transform = useMotionTemplate`perspective(${PERSPECTIVE}px) scale(${lift}) rotateX(${tiltX}deg) rotateY(${sumY}deg)`;
  const facing = useTransform(turn, t => Math.abs(Math.cos((t * Math.PI) / 180)));
  const spread = useTransform(facing, f => 0.08 + 0.92 * f);
  const shade = useTransform(facing, f => 0.1 + 0.9 * f * f);
  const gxPct = useMotionTemplate`${gx}%`;
  const gyPct = useMotionTemplate`${gy}%`;

  const settle = (to: number, velocity: number, instant: boolean) => {
    spin.current?.stop();
    if (instant || reduce) turn.jump(to);
    else spin.current = animate(turn, to, { type: 'spring', ...FLIP_SPRING, velocity, restDelta: 0.05 });
    const next = isBack(to);
    if (next === shownRef.current) return;
    shownRef.current = next;
    setShown(next);
    onFlip?.(next);
  };
  const flip = (instant: boolean) => {
    const base = snap(turn.get());
    settle(isBack(base) ? base - 180 : base + 180, 0, instant);
  };
  const rest = () => {
    tiltX.set(0);
    tiltY.set(0);
    sheen.set(0);
    lift.set(1);
  };

  useEffect(() => () => spin.current?.stop(), []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || grip.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    spin.current?.stop();
    grip.current = {
      id: e.pointerId,
      x: e.clientX,
      base: turn.get(),
      moved: false,
      slop: e.pointerType === 'touch' ? SLOP.coarse : SLOP.fine,
      hist: [],
    };
    if (!reduce) lift.set(HOVER_SCALE);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = grip.current;
    const r = e.currentTarget.getBoundingClientRect();
    if (g && g.id === e.pointerId) {
      const d = e.clientX - g.x;
      if (!g.moved) {
        if (Math.abs(d) < g.slop || reduce) return;
        g.moved = true;
        setDragging(true);
        tiltX.set(0);
        tiltY.set(0);
        sheen.set(0);
      }
      const deg = g.base + (d / r.width) * 180;
      turn.set(deg);
      const now = performance.now();
      g.hist.push({ t: now, v: deg });
      while (g.hist.length > 2 && now - g.hist[0].t > HISTORY_MS) g.hist.shift();
      return;
    }
    if (reduce || e.pointerType === 'touch') return;
    const px = clamp((e.clientX - r.left) / r.width, 0, 1);
    const py = clamp((e.clientY - r.top) / r.height, 0, 1);
    tiltX.set((0.5 - py) * 2 * TILT_MAX);
    tiltY.set((px - 0.5) * 2 * TILT_MAX);
    gx.set(px * 100);
    gy.set(py * 100);
    sheen.set(1);
  };
  const release = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    grip.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setDragging(false);
    if (e.pointerType === 'touch' || !rootRef.current?.matches(':hover')) rest();
    if (!g.moved) {
      if (!cancelled) flip(false);
      else settle(snap(g.base), 0, false);
      return;
    }
    const here = turn.get();
    let velocity = 0;
    const a = g.hist[0];
    const b = g.hist[g.hist.length - 1];
    if (!cancelled && a && b && b.t > a.t && performance.now() - b.t < 60)
      velocity = ((b.v - a.v) / (b.t - a.t)) * 1000;
    const to = cancelled ? snap(g.base) : clamp(snap(here + velocity * FLING), snap(here) - 180, snap(here) + 180);
    settle(to, velocity, false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (!e.repeat) flip(true);
  };
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.detail === 0) flip(true);
  };

  const rotorStyle = { transform, '--fc-gx': gxPct, '--fc-gy': gyPct, '--fc-sheen': sheen } as MotionStyle;

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={0}
      aria-pressed={shown}
      aria-label={ariaLabel}
      className={cn(
        'group relative cursor-grab touch-pan-y rounded-xl outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[dragging]:cursor-grabbing',
        className,
      )}
      data-dragging={dragging ? '' : undefined}
      data-fade={reduce ? (shown ? 'back' : 'front') : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={e => release(e, false)}
      onPointerCancel={e => release(e, true)}
      onLostPointerCapture={e => release(e, true)}
      onPointerEnter={e => {
        if (!reduce && e.pointerType !== 'touch') lift.set(HOVER_SCALE);
      }}
      onPointerLeave={() => {
        if (!grip.current) rest();
      }}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onDragStart={e => e.preventDefault()}
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute [inset:12%_9%_-5%] rounded-[inherit] bg-black/45 blur-[22px]"
        style={{ scaleX: spread, opacity: shade }}
      />
      <motion.div
        className="absolute inset-0 rounded-[inherit] [transform-style:preserve-3d]"
        style={reduce ? undefined : rotorStyle}
      >
        <div className={cn(FACE, 'group-data-[fade=front]:opacity-100!')} aria-hidden={shown} inert={shown}>
          {front}
          <span className={GLARE} aria-hidden="true" />
        </div>
        <div
          className={cn(
            FACE,
            '[transform:rotateY(180deg)] group-data-[fade]:[transform:none]! group-data-[fade=back]:opacity-100!',
          )}
          aria-hidden={!shown}
          inert={!shown}
        >
          {back}
          <span className={GLARE} aria-hidden="true" />
        </div>
      </motion.div>
    </div>
  );
}
