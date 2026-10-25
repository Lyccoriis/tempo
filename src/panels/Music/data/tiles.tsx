import { Play } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useMusicStore } from '@/stores/useMusicStore';
import type { RepoAlbumRow, RepoArtistRow, RepoTrackRow } from '@/types';

import { TrackMenu } from '../menus';
import { Cover } from '../ui';
import { discovery, DiscoveryBadge, fmtListened, HeardBar, plural } from './parts';

const TILE = 'group flex min-w-0 flex-col gap-2 rounded-lg p-2 text-left outline-none transition-colors duration-150 hover:bg-accent/50 focus-visible:bg-accent/50';

export const GALLERY = 'grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-1 px-1';
export const SHELF = 'grid auto-cols-[156px] grid-flow-col gap-1 px-1';

export function PlayOver({ videoId, title }: { videoId: string; title: string }) {
  const send = useMusicStore(s => s.send);
  return (
    <button
      type="button"
      aria-label={`Play ${title}`}
      onClick={e => {
        e.stopPropagation();
        void send({ kind: 'playVideo', videoId });
      }}
      className="m-2 grid size-9 place-items-center self-end justify-self-end rounded-full bg-primary text-primary-foreground opacity-0 transition-opacity duration-150 [grid-area:1/1] group-hover:opacity-100 focus-visible:opacity-100"
    >
      <Play size={15} strokeWidth={1.6} fill="currentColor" className="translate-x-px" />
    </button>
  );
}

export function SongTile({ row, showUnheard = true }: { row: RepoTrackRow; showUnheard?: boolean }) {
  const go = useMusicStore(s => s.go);
  const open = () => go({ kind: 'dataTrack', id: row.id, title: row.title });
  const state = discovery(row);
  const badge = state === 'unheard' && !showUnheard ? null : state;

  return (
    <TrackMenu track={{ videoId: row.videoId, title: row.title, artist: row.artist, album: row.album }}>
      <div role="button" tabIndex={0} onClick={open} onKeyDown={e => e.key === 'Enter' && open()} className={TILE}>
        <div className="grid">
          <Cover src={row.artwork} expand={{ kind: 'song', title: row.title, artist: row.artist, videoId: row.videoId }} onClick={open} depth="light" className="aspect-square w-full [grid-area:1/1]" />
          {row.videoId && <PlayOver videoId={row.videoId} title={row.title} />}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="truncate text-[13.5px] font-medium" title={row.title}>
            {row.title}
          </div>
          <div className="truncate text-[12px] text-muted-foreground">{row.artist || 'Unknown artist'}</div>
          <div className="flex min-w-0 items-center gap-1.5 pt-0.5 text-[11.5px] text-muted-foreground tabular-nums">
            {badge && <DiscoveryBadge state={badge} />}
            {row.plays > 0 ? (
              <span className="truncate">
                {plural(row.plays, 'play')} · {fmtListened(row.listenedMs)}
              </span>
            ) : (
              !badge && <span className="truncate">Not heard yet</span>
            )}
          </div>
          {row.completion != null && row.plays > 0 && <HeardBar value={row.completion} className="mt-1 h-0.5" />}
        </div>
      </div>
    </TrackMenu>
  );
}

export function RankedSongs({ rows, showArtist = true }: { rows: RepoTrackRow[]; showArtist?: boolean }) {
  const go = useMusicStore(s => s.go);
  const top = Math.max(1, ...rows.map(r => r.plays));
  return (
    <div className="flex flex-col">
      {rows.map((row, i) => (
        <TrackMenu key={row.id} track={{ videoId: row.videoId, title: row.title, artist: row.artist, album: row.album }}>
          <button
            type="button"
            onClick={() => go({ kind: 'dataTrack', id: row.id, title: row.title })}
            className="grid grid-cols-[20px_40px_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-accent/60 focus-visible:bg-accent/60"
          >
            <span className="text-right text-[12.5px] text-muted-foreground tabular-nums">{i + 1}</span>
            <Cover src={row.artwork} className="size-10" />
            <div className="min-w-0">
              <div className="truncate text-[13.5px]">{row.title}</div>
              {showArtist && <div className="truncate text-[11.5px] text-muted-foreground">{row.artist}</div>}
              <HeardBar value={row.plays / top} className="mt-1" />
            </div>
            <span className="text-right text-[12px] text-muted-foreground tabular-nums">
              {plural(row.plays, 'play')}
              <br />
              {fmtListened(row.listenedMs)}
            </span>
          </button>
        </TrackMenu>
      ))}
    </div>
  );
}

export function AlbumTile({ row }: { row: RepoAlbumRow }) {
  const go = useMusicStore(s => s.go);
  const open = () => go({ kind: 'dataAlbum', id: row.id, title: row.title });
  return (
    <div role="button" tabIndex={0} onClick={open} onKeyDown={e => e.key === 'Enter' && open()} className={TILE}>
      <Cover src={row.artwork} expand={{ kind: 'album', title: row.title, artist: row.artist }} onClick={open} depth="full" className="aspect-square w-full" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="truncate text-[13.5px] font-medium" title={row.title}>
          {row.title}
        </div>
        <div className="truncate text-[12px] text-muted-foreground">
          {[row.artist || 'Unknown artist', row.year].filter(Boolean).join(' · ')}
        </div>
        <div className="truncate pt-0.5 text-[11.5px] text-muted-foreground tabular-nums">
          {row.plays > 0 ? `${plural(row.plays, 'play')} · ${fmtListened(row.listenedMs)}` : 'Not heard yet'}
        </div>
        {row.tracks > 0 && <HeardBar value={row.heard / row.tracks} className="mt-1 h-0.5" />}
      </div>
    </div>
  );
}

export function ArtistTile({ row }: { row: RepoArtistRow }) {
  const go = useMusicStore(s => s.go);
  const open = () => go({ kind: 'dataArtist', id: row.id, title: row.name });
  return (
    <div role="button" tabIndex={0} onClick={open} onKeyDown={e => e.key === 'Enter' && open()} className={cn(TILE, 'items-center text-center')}>
      <Cover src={row.artwork} round expand={{ kind: 'artist', title: row.name, artist: '' }} onClick={open} depth="light" className="aspect-square w-full" />
      <div className="flex w-full min-w-0 flex-col gap-0.5">
        <div className="truncate text-[13.5px] font-medium" title={row.name}>
          {row.name}
        </div>
        <div className="truncate text-[11.5px] text-muted-foreground tabular-nums">
          {row.plays > 0 ? `${plural(row.plays, 'play')} · ${fmtListened(row.listenedMs)}` : 'Not heard yet'}
        </div>
        <div className="truncate text-[11.5px] text-muted-foreground tabular-nums">
          {row.heard} of {plural(row.tracks, 'song')} heard
        </div>
      </div>
    </div>
  );
}
