import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import NavSidebar from './NavSidebar';
import NowPlayingCard from './NowPlayingCard';
import PanelHost from './PanelHost';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useProfileStore } from '@/stores/useProfileStore';

export default function AppShell() {
  const loading = useProfileStore(s => s.loading);
  const error = useProfileStore(s => s.error);

  const navMode = useLayoutStore(s => s.navSidebar.mode);
  const navWidth = useLayoutStore(s => s.navSidebar.width);
  const setNavSidebar = useLayoutStore(s => s.setNavSidebar);
  const hydrated = useLayoutStore(s => s.hydrated);

  const [hovering, setHovering] = useState(false);

  const navExpanded = navMode === 'expanded' || (navMode === 'retracted' && hovering);

  useEffect(() => {
    const block = (e: MouseEvent) => {
      if (e.button === 3 || e.button === 4) e.preventDefault();
    };
    const go = (e: MouseEvent) => {
      if (e.button !== 3 && e.button !== 4) return;
      e.preventDefault();
      const { goBack, goForward } = useLayoutStore.getState();
      if (e.button === 3) goBack();
      else goForward();
    };
    window.addEventListener('mousedown', block);
    window.addEventListener('auxclick', block);
    window.addEventListener('mouseup', go);
    return () => {
      window.removeEventListener('mousedown', block);
      window.removeEventListener('auxclick', block);
      window.removeEventListener('mouseup', go);
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle size={15} strokeWidth={1.6} />
          <AlertTitle>Profiles could not be loaded</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading || !hydrated) {
    return (
      <div className="flex h-full w-full gap-4 p-6">
        <Skeleton className="h-full w-12" />
        <Skeleton className="h-full flex-1" />
      </div>
    );
  }

  return (
    <SidebarProvider
      open={navExpanded}
      onOpenChange={open => setNavSidebar({ mode: open ? 'expanded' : 'retracted' })}
      className="h-full min-h-0 w-full"
      style={{ '--sidebar-width': `${navWidth}px` } as React.CSSProperties}
    >
      <NavSidebar expanded={navExpanded} onHoverChange={setHovering} />

      <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent py-2 pr-2">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl">
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
            <div className="flex min-h-0 min-w-0 flex-col [grid-area:1/1]">
              <PanelHost />
            </div>
            <div className="pointer-events-none z-10 m-3 self-end justify-self-end [grid-area:1/1]">
              <NowPlayingCard />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
