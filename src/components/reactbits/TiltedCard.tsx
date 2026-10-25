import type { SpringOptions } from 'motion/react';
import { useRef, type ReactNode } from 'react';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'motion/react';

import { cn } from '@/lib/utils';

interface TiltedCardProps {
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  scaleOnHover?: number;
  rotateAmplitude?: number;
  glare?: string;
}

const springValues: SpringOptions = {
  damping: 30,
  stiffness: 100,
  mass: 2,
};

export default function TiltedCard({
  children,
  className,
  onClick,
  scaleOnHover = 1.1,
  rotateAmplitude = 14,
  glare,
}: TiltedCardProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useSpring(0, springValues);
  const rotateY = useSpring(0, springValues);
  const scale = useSpring(1, springValues);
  const sheen = useSpring(0, springValues);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const background = useMotionTemplate`radial-gradient(circle farthest-side at ${gx}% ${gy}%, color-mix(in oklab, var(--foreground) 16%, transparent), transparent 75%)`;

  function handleMouse(e: React.MouseEvent<HTMLDivElement>) {
    if (!ref.current || reduce) return;
    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;
    rotateX.set((offsetY / (rect.height / 2)) * -rotateAmplitude);
    rotateY.set((offsetX / (rect.width / 2)) * rotateAmplitude);
    gx.set(((e.clientX - rect.left) / rect.width) * 100);
    gy.set(((e.clientY - rect.top) / rect.height) * 100);
  }

  function handleMouseEnter() {
    if (reduce) return;
    scale.set(scaleOnHover);
    sheen.set(1);
  }

  function handleMouseLeave() {
    scale.set(1);
    rotateX.set(0);
    rotateY.set(0);
    sheen.set(0);
  }

  return (
    <div
      ref={ref}
      className={cn('shrink-0 [perspective:800px]', className)}
      onMouseMove={handleMouse}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      <motion.div className="grid size-full [transform-style:preserve-3d]" style={{ rotateX, rotateY, scale }}>
        <div className="size-full [grid-area:1/1]">{children}</div>
        {glare && (
          <motion.span aria-hidden="true" className={cn('pointer-events-none size-full [grid-area:1/1]', glare)} style={{ background, opacity: sheen }} />
        )}
      </motion.div>
    </div>
  );
}
