import { memo } from 'react';
import { Play } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useMusicStore } from '@/stores/useMusicStore';
import type { MusicTrack } from '@/types';

import { LINK, openAlbum, openArtist, TrackMenu } from './menus';
import { Cover, EnhancedBadge } from './ui';

interface TrackListProps {
  tracks: MusicTrack[];
  showAlbum?: boolean;
  onPlay: (track: MusicTrack, index: number) => void;
}

function TrackList({ tracks, showAlbum = true, onPlay }: TrackListProps) {
  const current = useMusicStore(s => s.state?.videoId ?? '');

  return (
    <div className="flex flex-col">
      {tracks.map((track, index) => {
        const on = track.videoId === current;
        return (
          <TrackMenu key={`${track.videoId}-${index}`} track={track}>
            <div
              role="button"
              tabIndex={0}
              onDoubleClick={e => {
                if (!(e.target as HTMLElement).closest('button')) onPlay(track, index);
              }}
              onKeyDown={e => e.key === 'Enter' && onPlay(track, index)}
              className={cn(
                'group grid items-center gap-3 rounded-md px-3 py-1.5 outline-none transition-colors duration-150 hover:bg-accent/60 focus-visible:bg-accent/60',
                showAlbum
                  ? 'grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_56px]'
                  : 'grid-cols-[28px_minmax(0,1fr)_56px]',
              )}
            >
              <button
                type="button"
                onClick={() => onPlay(track, index)}
                aria-label={`Play ${track.title}`}
                className="grid h-7 place-items-center text-[12.5px] text-muted-foreground tabular-nums"
              >
                <span className={cn('[grid-area:1/1] group-hover:opacity-0', on && 'text-primary')}>{index + 1}</span>
                <Play
                  size={15}
                  strokeWidth={1.6}
                  fill="currentColor"
                  className="text-foreground opacity-0 transition-opacity duration-150 [grid-area:1/1] group-hover:opacity-100"
                />
              </button>
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" tabIndex={-1} onClick={() => onPlay(track, index)} aria-label={`Play ${track.title}`}>
                  <Cover src={track.thumbnail} className="size-10" />
                </button>
                <div className="flex min-w-0 flex-col items-start">
                  <div className="flex max-w-full min-w-0 items-center gap-1.5">
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => onPlay(track, index)}
                      className={cn(LINK, 'text-[13.5px]', on && 'text-primary')}
                    >
                      {track.title}
                    </button>
                    <EnhancedBadge videoId={track.videoId} />
                  </div>
                  {track.artist && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => openArtist(track.artist, track.artistId)}
                      className={cn(LINK, 'text-[12px] text-muted-foreground')}
                    >
                      {track.artist}
                    </button>
                  )}
                </div>
              </div>
              {showAlbum && (
                <div className="truncate text-[12.5px] text-muted-foreground">
                  {track.albumId ? (
                    <button type="button" className={LINK} onClick={() => openAlbum(track.album, track.albumId)}>
                      {track.album}
                    </button>
                  ) : (
                    track.album
                  )}
                </div>
              )}
              <div className="text-right text-[12.5px] text-muted-foreground tabular-nums">{track.duration}</div>
            </div>
          </TrackMenu>
        );
      })}
    </div>
  );
}

export default memo(TrackList);
