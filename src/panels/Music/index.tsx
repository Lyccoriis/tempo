import { useCallback, useEffect, useRef, useState } from 'react';
import { ChartNoAxesColumn, ChevronLeft, Compass, Database, Globe, House, Library, LogIn, LogOut, Music, Search, X } from 'lucide-react';

import { usePanelVisible } from '@/components/layout/panelVisible';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useMusicStore, type MusicView } from '@/stores/useMusicStore';

import CoverViewer from './CoverViewer';
import DiscoverView from './DiscoverView';
import FocusView from './FocusView';
import HomeView from './HomeView';
import LibraryView from './LibraryView';
import Lyrics from './Lyrics';
import PageView from './PageView';
import PlayerBar from './PlayerBar';
import QueuePane from './QueuePane';
import SearchView from './SearchView';
import SignInDialog from './SignInDialog';
import StatsView from './StatsView';
import AlbumDetail from './data/AlbumDetail';
import ArtistDetail from './data/ArtistDetail';
import DataView from './data/DataView';
import TrackDetail from './data/TrackDetail';
import { GLASS } from '@/lib/glass';

const NAV: Array<{ view: MusicView; label: string; icon: typeof House }> = [
  { view: { kind: 'home' }, label: 'Home', icon: House },
  { view: { kind: 'search' }, label: 'Search', icon: Search },
  { view: { kind: 'discover' }, label: 'Discover', icon: Compass },
  { view: { kind: 'library' }, label: 'Library', icon: Library },
  { view: { kind: 'stats' }, label: 'Stats', icon: ChartNoAxesColumn },
  { view: { kind: 'data', tab: 'overview' }, label: 'Data', icon: Database },
];

const NAV_ITEM =
  'flex h-9 items-center gap-3 rounded-md px-3 text-[13.5px] font-medium transition-colors duration-150 hover:bg-accent/60 hover:text-foreground focus-visible:bg-accent/60';

function CurrentView({ view }: { view: MusicView }) {
  switch (view.kind) {
    case 'home': return <HomeView />;
    case 'search': return <SearchView />;
    case 'library': return <LibraryView />;
    case 'stats': return <StatsView />;
    case 'discover': return <DiscoverView tag={view.tag} />;
    case 'page': return <PageView key={view.browseId} browseId={view.browseId} title={view.title} />;
    case 'data': return <DataView tab={view.tab} heard={view.heard} />;
    case 'dataTrack': return <TrackDetail key={view.id} id={view.id} />;
    case 'dataArtist': return <ArtistDetail key={view.id} id={view.id} />;
    case 'dataAlbum': return <AlbumDetail key={view.id} id={view.id} />;
    case 'lyrics': return null;
  }
}

export default function MusicPanel() {
  const visible = usePanelVisible();
  const view = useMusicStore(s => s.view);
  const back = useMusicStore(s => s.back);
  const go = useMusicStore(s => s.go);
  const goBack = useMusicStore(s => s.goBack);
  const focus = useMusicStore(s => s.focus);
  const setFocus = useMusicStore(s => s.setFocus);
  const queueOpen = useMusicStore(s => s.queueOpen);
  const setQueueOpen = useMusicStore(s => s.setQueueOpen);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [pageShown, setPageShown] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      setSignedIn(await window.api.ytmusic.signedIn());
    } catch (err) {
      console.error('[music] signedIn failed', err);
    }
  }, []);

  useEffect(() => {
    window.api.ytmusic.start().catch(err => console.error('[music] start failed', err));
    void refresh();
  }, [refresh]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [view]);

  useEffect(() => {
    if (!focus || !visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setFocus(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, visible, setFocus]);

  useEffect(() => {
    const host = hostRef.current;
    if (!pageShown || !visible || !host) {
      window.api.ytmusic.hide().catch(() => {});
      return;
    }
    const place = () => {
      const r = host.getBoundingClientRect();
      window.api.ytmusic
        .show({ x: r.left, y: r.top, width: r.width, height: r.height })
        .catch(err => console.error('[music] show failed', err));
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(host);
    window.addEventListener('resize', place);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.api.ytmusic.hide().catch(() => {});
    };
  }, [pageShown, visible]);

  async function signOut() {
    try {
      await window.api.ytmusic.signOut();
      await refresh();
    } catch (err) {
      console.error('[music] signOut failed', err);
    }
  }

  const lyricsOpen = view.kind === 'lyrics';
  const playerBar = (
    <PlayerBar
      queueOpen={queueOpen}
      onToggleQueue={() => setQueueOpen(!queueOpen)}
      lyricsOpen={lyricsOpen}
      onToggleLyrics={() => (lyricsOpen ? goBack() : go({ kind: 'lyrics' }))}
      focus={focus}
      onToggleFocus={() => setFocus(!focus)}
    />
  );

  const body =
    signedIn === false ? (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Music size={15} strokeWidth={1.6} />
          </EmptyMedia>
          <EmptyTitle>YouTube Music</EmptyTitle>
          <EmptyDescription>Sign in once with your Google account, it is remembered after that.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" onClick={() => setSignInOpen(true)}>
            <LogIn size={15} strokeWidth={1.6} /> Sign in
          </Button>
        </EmptyContent>
      </Empty>
    ) : (
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] [grid-template-areas:'stage']">
        {focus ? (
          <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-2 [grid-area:stage]">
            <FocusView />
            {playerBar}
          </div>
        ) : (
          <div
            className={cn(
              'grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-2 [grid-area:stage]',
              queueOpen ? 'grid-cols-[180px_minmax(0,1fr)_300px]' : 'grid-cols-[180px_minmax(0,1fr)]',
            )}
          >
            <nav className={cn(GLASS, 'flex flex-col gap-1 rounded-xl p-2')}>
              {NAV.map(item => {
                const on = item.view.kind === 'data' ? view.kind.startsWith('data') : view.kind === item.view.kind;
                return (
                  <button
                    key={item.view.kind}
                    type="button"
                    onClick={() => go(item.view)}
                    className={cn(NAV_ITEM, on ? 'bg-accent/70 text-foreground' : 'text-muted-foreground')}
                  >
                    <item.icon size={15} strokeWidth={1.6} />
                    {item.label}
                  </button>
                );
              })}
              <div className="mt-auto flex flex-col gap-1">
                <button type="button" onClick={() => setPageShown(true)} className={cn(NAV_ITEM, 'text-muted-foreground')}>
                  <Globe size={15} strokeWidth={1.6} />
                  Show page
                </button>
                {signedIn && (
                  <button type="button" onClick={() => void signOut()} className={cn(NAV_ITEM, 'text-muted-foreground')}>
                    <LogOut size={15} strokeWidth={1.6} />
                    Sign out
                  </button>
                )}
              </div>
            </nav>

            <main className={cn(GLASS, 'flex min-h-0 flex-col overflow-hidden rounded-xl bg-card/35')}>
              <div className="flex h-11 flex-none items-center px-3">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!back.length}
                  onClick={goBack}
                  aria-label="Back"
                  className="rounded-full"
                >
                  <ChevronLeft size={15} strokeWidth={1.6} />
                </Button>
              </div>
              {lyricsOpen ? (
                <div className="min-h-0 flex-1">
                  <Lyrics onLeave={goBack} leaveLabel="Go back" />
                </div>
              ) : (
                <ScrollArea viewportRef={scrollRef} className="min-h-0 flex-1">
                  <div className="px-3 pb-8">
                    <CurrentView view={view} />
                  </div>
                </ScrollArea>
              )}
            </main>

            {queueOpen && <QueuePane />}

            <div className="col-span-full">{playerBar}</div>
          </div>
        )}
      </div>
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {pageShown && (
        <div className="flex flex-none justify-end border-b border-border px-3 py-2">
          <Button variant="outline" size="sm" onClick={() => setPageShown(false)}>
            <X size={15} strokeWidth={1.6} /> Close page
          </Button>
        </div>
      )}
      <div ref={hostRef} className="min-h-0 flex-1">
        {!pageShown && body}
      </div>
      <CoverViewer />
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} onSignedIn={() => void refresh()} />
    </div>
  );
}
