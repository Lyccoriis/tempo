import { useEffect, useState } from 'react';
import { Copy, Minus, Square, SquareTerminal, X } from 'lucide-react';

import { APP_NAME } from '@/lib/appName';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useUiStore } from '@/stores/useUiStore';

const DRAG = { WebkitAppRegion: 'drag' } as React.CSSProperties;
const NO_DRAG = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

const RAIL = 66;

const BUTTON = 'flex h-9 w-11 items-center justify-center text-muted-foreground hover:bg-accent/60 hover:text-foreground focus-visible:bg-accent/60 focus-visible:outline-none';

export default function TitleBar() {
  const profile = useProfileStore(s => s.profiles.find(p => p.id === s.activeProfileId)?.name ?? null);
  const navMode = useLayoutStore(s => s.navSidebar.mode);
  const navWidth = useLayoutStore(s => s.navSidebar.width);
  const backdropOnly = useUiStore(s => s.backdropOnly);
  const toggleBackdropOnly = useUiStore(s => s.toggleBackdropOnly);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    void window.api.shell.isMaximized().then(setMaximized).catch(() => {});
    return window.api.shell.onMaximized(setMaximized);
  }, []);

  const iconColumn = navMode === 'expanded' ? navWidth : RAIL;

  return (
    <div style={DRAG} className="relative z-30 flex h-9 shrink-0 select-none items-center text-muted-foreground">
      <span className="flex shrink-0 items-center justify-center" style={{ width: iconColumn }}>
        <button
          style={NO_DRAG}
          className="flex size-7 items-center justify-center rounded-md opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
          onClick={toggleBackdropOnly}
          aria-label={backdropOnly ? 'Show the app' : 'Show only the backdrop'}
        >
          <SquareTerminal size={15} strokeWidth={1.6} />
        </button>
      </span>
      <span className={`min-w-0 flex-1 truncate text-xs transition-opacity ${backdropOnly ? 'opacity-0' : ''}`}>
        {APP_NAME}
        {profile && <span className="text-foreground"> | {profile}</span>}
      </span>
      <div style={NO_DRAG} className="flex shrink-0 items-center">
        <button className={BUTTON} onClick={() => window.api.shell.minimize()} aria-label="Minimize">
          <Minus size={15} strokeWidth={1.6} />
        </button>
        <button
          className={BUTTON}
          onClick={() => window.api.shell.toggleMaximize()}
          aria-label={maximized ? 'Restore' : 'Maximize'}
        >
          {maximized ? <Copy size={12} strokeWidth={1.6} /> : <Square size={12} strokeWidth={1.6} />}
        </button>
        <button
          className={`${BUTTON} hover:bg-destructive hover:text-destructive-foreground`}
          onClick={() => window.api.shell.close()}
          aria-label="Close"
        >
          <X size={15} strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}
