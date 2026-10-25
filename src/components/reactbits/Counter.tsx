import { type MotionValue, type SpringOptions, motion, useSpring, useTransform } from 'motion/react';
import type React from 'react';
import { useEffect } from 'react';

export type PlaceValue = number | '.' | ',';

function DigitFace({ mv, number, height }: { mv: MotionValue<number>; number: number; height: number }) {
  const y = useTransform(mv, latest => {
    const placeValue = latest % 10;
    const offset = (10 + number - placeValue) % 10;
    let memo = offset * height;
    if (offset > 5) memo -= 10 * height;
    return memo;
  });
  return (
    <motion.span className="absolute inset-0 flex items-center justify-center" style={{ y }}>
      {number}
    </motion.span>
  );
}

function normalizeNearInteger(num: number): number {
  const nearest = Math.round(num);
  const tolerance = 1e-9 * Math.max(1, Math.abs(num));
  return Math.abs(num - nearest) < tolerance ? nearest : num;
}

function Digit({ place, value, height, spring }: { place: number; value: number; height: number; spring?: SpringOptions }) {
  const rounded = Math.floor(normalizeNearInteger(value / place));
  const animated = useSpring(rounded, spring);
  useEffect(() => {
    animated.set(rounded);
  }, [animated, rounded]);

  return (
    <span className="relative inline-flex overflow-hidden tabular-nums" style={{ height, width: '1ch' }}>
      {Array.from({ length: 10 }, (_, i) => (
        <DigitFace key={i} mv={animated} number={i} height={height} />
      ))}
    </span>
  );
}

export function placesFor(value: number, decimals = 0, group = false): PlaceValue[] {
  const whole = Math.max(1, String(Math.floor(Math.abs(value))).length);
  const places: PlaceValue[] = [];
  for (let i = 0; i < whole; i++) {
    const left = whole - i;
    if (group && i > 0 && left % 3 === 0) places.push(',');
    places.push(10 ** (left - 1));
  }
  if (decimals > 0) {
    places.push('.');
    for (let i = 1; i <= decimals; i++) places.push(10 ** -i);
  }
  return places;
}

interface CounterProps {
  value: number;
  fontSize?: number;
  padding?: number;
  places?: PlaceValue[];
  gap?: number;
  fontWeight?: React.CSSProperties['fontWeight'];
  className?: string;
  spring?: SpringOptions;
}

export default function Counter({ value, fontSize = 20, padding = 0, places, gap = 0, fontWeight = 'inherit', className, spring }: CounterProps) {
  const height = fontSize + padding;
  return (
    <span className={className} style={{ display: 'inline-flex', gap, overflow: 'hidden', fontSize, fontWeight, lineHeight: 1, direction: 'ltr' }}>
      {(places ?? placesFor(value)).map((place, i) =>
        typeof place === 'string' ? (
          <span key={`sep-${i}`} className="relative inline-flex items-center justify-center" style={{ height }}>
            {place}
          </span>
        ) : (
          <Digit key={place} place={place} value={value} height={height} spring={spring} />
        ),
      )}
    </span>
  );
}
