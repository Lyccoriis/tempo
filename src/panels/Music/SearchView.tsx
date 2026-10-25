import { useEffect, useRef, useState } from 'react';
import { Search, SearchX } from 'lucide-react';

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { usePanelVisible } from '@/components/layout/panelVisible';
import { useMusicStore } from '@/stores/useMusicStore';
import type { MusicTrack } from '@/types';

import CardRow, { cardView, openCard, playCard } from './CardRow';
import TrackList from './TrackList';
import { CardMenu } from './menus';
import { GLASS } from '@/lib/glass';
import { Cover } from './ui';

const KIND_LABEL: Record<string, string> = {
  artist: 'Artist',
  album: 'Album',
  playlist: 'Playlist',
  song: 'Song',
  video: 'Video',
  profile: 'Profile',
  other: '',
};

export default function SearchView() {
  const query = useMusicStore(s => s.query);
  const search = useMusicStore(s => s.search);
  const searching = useMusicStore(s => s.searching);
  const runSearch = useMusicStore(s => s.runSearch);
  const send = useMusicStore(s => s.send);
  const visible = usePanelVisible();
  const [text, setText] = useState(query);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) input.current?.focus();
  }, [visible]);

  useEffect(() => {
    const s = useMusicStore.getState();
    if (s.query.trim() && !s.search && !s.searching) void runSearch(s.query);
  }, [runSearch]);

  useEffect(() => {
    if (text === query) return;
    const id = window.setTimeout(() => void runSearch(text), 350);
    return () => window.clearTimeout(id);
  }, [text, query, runSearch]);

  useEffect(() => {
    const q = query.trim();
    if (!q || !search || searching) return;
    const id = window.setTimeout(() => {
      window.api.musicRepo.recordSearch(q).catch(err => console.error('[music] search history failed', err));
    }, 2000);
    return () => window.clearTimeout(id);
  }, [query, search, searching]);

  const play = (track: MusicTrack) => void send({ kind: 'playVideo', videoId: track.videoId });
  const top = search?.top;
  const canPlayTop = Boolean(top?.videoId || top?.playlistId);

  return (
    <div className="flex flex-col gap-6 pt-1">
      <InputGroup className="mx-2.5 h-11 max-w-[520px] rounded-full bg-card/60 backdrop-blur-xl">
        <InputGroupAddon>
          {searching ? <Spinner className="size-4" /> : <Search size={15} strokeWidth={1.6} />}
        </InputGroupAddon>
        <InputGroupInput
          ref={input}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="What do you want to play?"
          className="text-[14px]"
        />
      </InputGroup>

      {!query.trim() ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search size={15} strokeWidth={1.6} />
            </EmptyMedia>
            <EmptyTitle>Search YouTube Music</EmptyTitle>
            <EmptyDescription>Songs, artists, albums and playlists, straight from your account.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : searching && !search ? (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-6 px-2.5">
          <Skeleton className="h-56" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </div>
      ) : search && !top && !search.songs.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX size={15} strokeWidth={1.6} />
            </EmptyMedia>
            <EmptyTitle>No results</EmptyTitle>
            <EmptyDescription>Nothing matched "{query}". Try another spelling or fewer words.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        search && (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-6 px-2.5">
              {top && (
                <section className="flex flex-col gap-2">
                  <h2 className="text-[18px] font-semibold">Top result</h2>
                  <CardMenu card={top}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openCard(top)}
                      onKeyDown={e => e.key === 'Enter' && openCard(top)}
                      className={`${GLASS} group flex flex-col gap-4 rounded-xl p-5 transition-colors duration-150 hover:bg-accent/50`}
                    >
                      <Cover
                        src={top.thumbnail}
                        round={top.kind === 'artist' || top.kind === 'profile'}
                        expand={cardView(top)}
                        onClick={canPlayTop ? () => playCard(top) : undefined}
                        playable={canPlayTop}
                        className="size-24"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-[28px] font-bold">{top.title}</div>
                        <div className="truncate text-[12.5px] text-muted-foreground">
                          {[KIND_LABEL[top.kind], top.subtitle].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                    </div>
                  </CardMenu>
                </section>
              )}
              {search.songs.length > 0 && (
                <section className="flex min-w-0 flex-col gap-2">
                  <h2 className="text-[18px] font-semibold">Songs</h2>
                  <TrackList tracks={search.songs.slice(0, 5)} showAlbum={false} onPlay={play} />
                </section>
              )}
            </div>
            <CardRow title="Artists" cards={search.artists} />
            <CardRow title="Albums" cards={search.albums} />
            <CardRow title="Playlists" cards={search.playlists} />
            {search.songs.length > 5 && (
              <section className="flex flex-col gap-1">
                <h2 className="px-2.5 text-[18px] font-semibold">More songs</h2>
                <TrackList tracks={search.songs.slice(5)} onPlay={play} />
              </section>
            )}
          </>
        )
      )}
    </div>
  );
}
