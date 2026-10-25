import { useEffect, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { useMusicStore } from '@/stores/useMusicStore';
import type { DiscoverRow, DiscoverTrack, MusicCard, MusicTrack } from '@/types';

import CardRow, { openCard } from './CardRow';
import TrackList from './TrackList';
import { CardMenu } from './menus';
import { Cover } from './ui';

function card(track: DiscoverTrack): MusicCard {
  return {
    kind: 'song',
    title: track.title,
    subtitle: `${track.artist} • ${track.reason}`,
    thumbnail: track.artwork,
    browseId: '',
    playlistId: '',
    videoId: track.videoId,
    wide: false,
  };
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening';
}

export default function HomeView() {
  const home = useMusicStore(s => s.pages.FEmusic_home);
  const library = useMusicStore(s => s.pages.FEmusic_library_landing);
  const loadPage = useMusicStore(s => s.loadPage);
  const send = useMusicStore(s => s.send);
  const [loading, setLoading] = useState(!home);
  const [rows, setRows] = useState<DiscoverRow[]>([]);

  useEffect(() => {
    window.api.musicDiscover
      .home()
      .then(setRows)
      .catch(err => console.error('[music] home rows failed', err));
  }, []);

  useEffect(() => {
    void Promise.all([loadPage('FEmusic_home'), loadPage('FEmusic_library_landing')]).finally(() => setLoading(false));
  }, [loadPage]);

  const quick = (library?.shelves.flatMap(s => s.cards) ?? []).slice(0, 8);
  const play = (track: MusicTrack) =>
    void send({ kind: 'playVideo', videoId: track.videoId, playlistId: track.playlistId || undefined });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="px-2.5 text-[28px] font-bold">{greeting()}</h1>

      {loading && !home ? (
        <div className="grid grid-cols-4 gap-2 px-2.5">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : (
        quick.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2 px-2.5">
            {quick.map((card, i) => (
              <CardMenu key={`${card.browseId}-${i}`} card={card}>
                <button
                  type="button"
                  onClick={() => openCard(card)}
                  className="flex min-w-0 items-center gap-3 overflow-hidden rounded-md bg-card/50 pr-3 text-left transition-colors duration-150 hover:bg-accent/70 focus-visible:bg-accent/70"
                >
                  <Cover
                    src={card.thumbnail}
                    round={card.kind === 'artist' || card.kind === 'profile'}
                    className="size-14 rounded-none"
                  />
                  <span className="truncate text-[13.5px] font-medium">{card.title}</span>
                </button>
              </CardMenu>
            ))}
          </div>
        )
      )}

      {rows.map(row => (
        <CardRow key={row.id} title={row.title} cards={row.tracks.map(card)} />
      ))}

      {home?.shelves.map((shelf, i) =>
        shelf.tracks.length ? (
          <section key={i} className="flex flex-col gap-1">
            <h2 className="px-2.5 text-[18px] font-semibold">{shelf.title}</h2>
            <TrackList tracks={shelf.tracks.slice(0, 8)} showAlbum={false} onPlay={play} />
          </section>
        ) : (
          <CardRow key={i} title={shelf.title} cards={shelf.cards} />
        ),
      )}
    </div>
  );
}
