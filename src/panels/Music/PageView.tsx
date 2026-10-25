import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { isPlaying, useMusicStore } from '@/stores/useMusicStore';
import type { MusicAboutKind, MusicTrack } from '@/types';

import CardRow from './CardRow';
import TrackList from './TrackList';
import { LINK, openArtist } from './menus';
import { Cover, PlayGlyph } from './ui';

function kindLabel(browseId: string): string {
  if (browseId.startsWith('VL')) return 'Playlist';
  if (browseId.startsWith('MPRE')) return 'Album';
  if (browseId.startsWith('UC')) return 'Artist';
  return '';
}

function aboutKind(browseId: string): MusicAboutKind | null {
  if (browseId.startsWith('MPRE')) return 'album';
  if (browseId.startsWith('UC')) return 'artist';
  return null;
}

export default function PageView({ browseId, title }: { browseId: string; title: string }) {
  const page = useMusicStore(s => s.pages[browseId]);
  const loadPage = useMusicStore(s => s.loadPage);
  const loadMore = useMusicStore(s => s.loadMore);
  const send = useMusicStore(s => s.send);
  const state = useMusicStore(s => s.state);
  const queue = useMusicStore(s => s.queue);
  const [more, setMore] = useState(false);

  useEffect(() => {
    void loadPage(browseId);
  }, [browseId, loadPage]);

  const artist = browseId.startsWith('UC');
  const playlistId = page?.playlistId ?? '';
  const fromHere = Boolean(playlistId && queue?.items[queue.current]?.playlistId === playlistId);
  const playing = fromHere && isPlaying(state);

  const play = (track: MusicTrack) =>
    void send({ kind: 'playVideo', videoId: track.videoId, playlistId: track.playlistId || playlistId || undefined });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end gap-6 px-2.5 pt-4">
        {page ? (
          <Cover
            src={page.thumbnail}
            round={artist}
            expand={{ kind: aboutKind(browseId), title: page.title || title, artist: page.subtitle }}
            className="size-[200px] rounded-lg"
          />
        ) : (
          <Skeleton className="size-[200px]" />
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="text-[12px] font-medium">{kindLabel(browseId)}</div>
          <h1 className="line-clamp-2 text-[40px] leading-tight font-bold">{page?.title || title}</h1>
          <div className="truncate text-[13px] text-muted-foreground">
            {!page ? (
              <Skeleton className="h-4 w-60" />
            ) : (
              <>
                {page.ownerId ? (
                  <button
                    type="button"
                    onClick={() => openArtist(page.subtitle, page.ownerId)}
                    className={cn(LINK, 'font-medium text-foreground')}
                  >
                    {page.subtitle}
                  </button>
                ) : (
                  page.subtitle
                )}
                {page.subtitle && page.detail && ' • '}
                {page.detail}
              </>
            )}
          </div>
          {playlistId && (
            <Button
              size="icon-lg"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={() =>
                void send(fromHere ? { kind: 'toggle' } : { kind: 'playPlaylist', playlistId })
              }
              className="mt-2 size-12 rounded-full [&_svg:not([class*='size-'])]:size-5"
            >
              <PlayGlyph playing={playing} />
            </Button>
          )}
        </div>
      </header>

      {!page ? (
        <div className="flex flex-col gap-2 px-2.5">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : (
        page.shelves.map((shelf, i) =>
          shelf.tracks.length ? (
            <section key={i} className="flex flex-col gap-1">
              {shelf.title && <h2 className="px-2.5 text-[18px] font-semibold">{shelf.title}</h2>}
              <TrackList tracks={shelf.tracks} showAlbum={!browseId.startsWith('MPRE')} onPlay={play} />
              {shelf.continuation && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={more}
                  className="mx-2.5 self-start"
                  onClick={() => {
                    setMore(true);
                    void loadMore(browseId, i).finally(() => setMore(false));
                  }}
                >
                  {more ? 'Loading' : 'Load more'}
                </Button>
              )}
            </section>
          ) : (
            <CardRow key={i} title={shelf.title} cards={shelf.cards} />
          ),
        )
      )}
    </div>
  );
}
