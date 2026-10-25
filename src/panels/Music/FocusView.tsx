import { cn } from '@/lib/utils';
import { useMusicStore } from '@/stores/useMusicStore';

import Lyrics from './Lyrics';
import { Byline, TrackMenu, useNowPlaying } from './menus';
import { GLASS } from '@/lib/glass';
import { Cover } from './ui';

export default function FocusView() {
  const state = useMusicStore(s => s.state);
  const setFocus = useMusicStore(s => s.setFocus);
  const now = useNowPlaying();

  return (
    <div className="grid min-h-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 px-6 py-4">
      <div className="flex min-h-0 flex-col items-center justify-center gap-5">
        {now ? (
          <TrackMenu track={now}>
            <div className="aspect-square w-full max-w-[440px]">
              <Cover
                src={state?.artwork ?? ''}
                expand={{ kind: 'song', title: now.title, artist: now.artist, videoId: now.videoId }}
                className="size-full rounded-xl"
              />
            </div>
          </TrackMenu>
        ) : (
          <Cover src="" className="aspect-square w-full max-w-[440px] rounded-xl" />
        )}
        <div className="w-full max-w-[440px] min-w-0">
          <div className="truncate text-[28px] leading-tight font-bold tracking-tight">
            {now ? now.title : 'Nothing playing'}
          </div>
          <div className="truncate text-[15px] text-muted-foreground">
            {now ? <Byline track={now} /> : 'Pick a song to start'}
          </div>
        </div>
      </div>
      <div className={cn(GLASS, 'min-h-0 overflow-hidden rounded-xl bg-card/30')}>
        <Lyrics focus onLeave={() => setFocus(false)} leaveLabel="Leave focus mode" />
      </div>
    </div>
  );
}
