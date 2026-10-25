import { useEffect, useState } from 'react';
import { SkipBack, SkipForward } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { GLASS } from '@/lib/glass';
import { cn } from '@/lib/utils';
import { LINK, openArtist, useNowPlaying } from '@/panels/Music/menus';
import { usePosition } from '@/panels/Music/PlayerBar';
import { Cover, PlayGlyph } from '@/panels/Music/ui';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { isPlaying, useMusicStore } from '@/stores/useMusicStore';

export default function NowPlayingCard() {
  const activePanel = useLayoutStore(s => s.activePanel);
  const setActivePanel = useLayoutStore(s => s.setActivePanel);
  const state = useMusicStore(s => s.state);
  const send = useMusicStore(s => s.send);
  const miniOpen = useMusicStore(s => s.miniOpen);
  const setMiniOpen = useMusicStore(s => s.setMiniOpen);
  const now = useNowPlaying();
  const position = usePosition();
  const [hovered, setHovered] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const shown = miniOpen && activePanel !== 'music' && Boolean(state?.videoId) && Boolean(now);
  const videoId = state?.videoId;

  useEffect(() => {
    if (!shown) setHovered(false);
  }, [shown]);

  useEffect(() => {
    setLeaving(false);
    if (!shown || hovered) return;
    let out: ReturnType<typeof setTimeout> | undefined;
    const wait = setTimeout(() => {
      setLeaving(true);
      out = setTimeout(() => setMiniOpen(false), 120);
    }, 5000);
    return () => {
      clearTimeout(wait);
      clearTimeout(out);
    };
  }, [shown, hovered, videoId, setMiniOpen]);

  if (!shown || !state || !now) return null;

  const playing = isPlaying(state);
  const percent = state.duration ? (position / state.duration) * 100 : 0;

  return (
    <div
      key={state.videoId}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        GLASS,
        'pointer-events-auto flex w-80 flex-col gap-2 rounded-xl p-2.5 pb-3',
        leaving ? 'animate-[pop-out_.12s_forwards]' : 'animate-[pop_.15s]',
      )}
    >
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Open Music" onClick={() => setActivePanel('music')}>
          <Cover src={state.artwork ?? ''} className="size-11" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col items-start">
          <button
            type="button"
            onClick={() => setActivePanel('music')}
            className={cn(LINK, 'text-[13px] font-medium')}
          >
            {now.title}
          </button>
          <button
            type="button"
            onClick={() => {
              setActivePanel('music');
              openArtist(now.artist, now.artistId);
            }}
            className={cn(LINK, 'text-[12px] text-muted-foreground')}
          >
            {now.artist}
          </button>
        </div>
        <div className="flex flex-none items-center">
          <Button variant="ghost" size="icon-sm" aria-label="Previous" onClick={() => void send({ kind: 'previous' })}>
            <SkipBack size={15} strokeWidth={1.6} fill="currentColor" />
          </Button>
          <Button
            size="icon-sm"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={() => void send({ kind: 'toggle' })}
            className="rounded-full bg-foreground text-background hover:bg-foreground/85 focus-visible:bg-foreground/85 [&_svg:not([class*='size-'])]:size-4"
          >
            <PlayGlyph playing={playing} />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Next" onClick={() => void send({ kind: 'next' })}>
            <SkipForward size={15} strokeWidth={1.6} fill="currentColor" />
          </Button>
        </div>
      </div>
      <Progress value={percent} className="h-1 bg-foreground/15" />
    </div>
  );
}
