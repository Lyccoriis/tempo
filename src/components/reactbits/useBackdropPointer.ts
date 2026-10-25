import { useEffect, useRef, type RefObject } from 'react';

export function useBackdropPointer(enabled: boolean, host: RefObject<HTMLDivElement | null>) {
  const pointer = useRef({ x: 0.5, y: 0.5, inside: false });
  useEffect(() => {
    pointer.current = { x: 0.5, y: 0.5, inside: false };
    if (!enabled) return;
    const move = (event: PointerEvent) => {
      const rect = host.current?.getBoundingClientRect();
      if (!rect || !rect.width || !rect.height) return;
      const x = (event.clientX - rect.left) / rect.width;
      const y = 1 - (event.clientY - rect.top) / rect.height;
      pointer.current = { x, y, inside: x >= 0 && x <= 1 && y >= 0 && y <= 1 };
    };
    const leave = () => { pointer.current.inside = false; };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('blur', leave);
    document.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('blur', leave);
      document.removeEventListener('pointerleave', leave);
    };
  }, [enabled, host]);
  return pointer;
}
