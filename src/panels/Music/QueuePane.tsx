import { ListMusic } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useMusicStore } from '@/stores/useMusicStore';

import { Byline, TrackMenu, useNowPlaying } from './menus';
import { GLASS } from '@/lib/glass';
import { Cover, EnhancedBadge } from './ui';

export default function QueuePane() {
  const state = useMusicStore(s => s.state);
  const queue = useMusicStore(s => s.queue);
  const send = useMusicStore(s => s.send);
  const now = useNowPlaying();
  const items = queue?.items ?? [];
  const current = queue?.current ?? -1;
  const next = items.map((track, index) => ({ track, index })).filter(({ index }) => index > current);

  return (
    <aside className={cn(GLASS, 'flex min-h-0 flex-col overflow-hidden rounded-xl')}>
      <div className="flex-none p-4">
        <div className="mb-3 text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">Now playing</div>
        {now ? (
          <TrackMenu track={now}>
            <div>
              <Cover
                src={state?.artwork ?? ''}
                expand={{ kind: 'song', title: now.title, artist: now.artist, videoId: now.videoId }}
                className="aspect-square w-full rounded-lg"
              />
              <div className="mt-3 flex min-w-0 items-center gap-1.5">
                <div className="truncate text-[15px] font-semibold">{now.title}</div>
                <EnhancedBadge videoId={now.videoId} />
              </div>
              <div className="truncate text-[12.5px] text-muted-foreground">
                <Byline track={now} />
              </div>
            </div>
          </TrackMenu>
        ) : (
          <>
            <Cover src="" className="aspect-square w-full rounded-lg" />
            <div className="mt-3 truncate text-[15px] font-semibold">Nothing playing</div>
          </>
        )}
      </div>
      <div className="flex-none px-4 pb-1 text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
        Next up
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {next.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            <ListMusic size={15} strokeWidth={1.6} />
            The queue is empty after this song.
          </div>
        ) : (
          <div className="flex flex-col px-2 pb-2">
            {next.map(({ track, index }) => (
              <TrackMenu key={`${track.videoId}-${index}`} track={track}>
                <button
                  type="button"
                  onClick={() => void send({ kind: 'playQueueIndex', index })}
                  className="flex min-w-0 items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-accent/60 focus-visible:bg-accent/60"
                >
                  <Cover src={track.thumbnail} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <div className="truncate text-[13px]">{track.title}</div>
                      <EnhancedBadge videoId={track.videoId} />
                    </div>
                    <div className="truncate text-[11.5px] text-muted-foreground">{track.artist}</div>
                  </div>
                  <span className="text-[11.5px] text-muted-foreground tabular-nums">{track.duration}</span>
                </button>
              </TrackMenu>
            ))}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
