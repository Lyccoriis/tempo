import { useEffect } from 'react';

import { isCapturing } from '@/lib/keys';

const GAP_MS = 400;

export function useDoubleShift(onTrigger: () => void): void {
  useEffect(() => {
    let lastTap = 0;
    let modified = false;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Shift') {
        if (!e.repeat) modified = false;
        return;
      }
      modified = true;
      lastTap = 0;
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key !== 'Shift' || modified || isCapturing()) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      if (now - lastTap < GAP_MS) {
        lastTap = 0;
        onTrigger();
      } else {
        lastTap = now;
      }
    }

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [onTrigger]);
}
