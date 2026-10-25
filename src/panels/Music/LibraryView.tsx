import { useEffect } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useMusicStore } from '@/stores/useMusicStore';
import type { MusicLibraryFilter as Filter } from '@/types';

import { CardTile } from './CardRow';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'playlist', label: 'Playlists' },
  { id: 'artist', label: 'Artists' },
  { id: 'album', label: 'Albums' },
];

export default function LibraryView() {
  const library = useMusicStore(s => s.pages.FEmusic_library_landing);
  const loadPage = useMusicStore(s => s.loadPage);
  const filter = useMusicStore(s => s.libraryFilter);
  const setFilter = useMusicStore(s => s.setLibraryFilter);

  useEffect(() => {
    void loadPage('FEmusic_library_landing', true);
  }, [loadPage]);

  const cards = (library?.shelves.flatMap(s => s.cards) ?? []).filter(card =>
    filter === 'all' ? true : filter === 'artist' ? card.kind === 'artist' || card.kind === 'profile' : card.kind === filter,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 px-2.5">
        <h1 className="text-[28px] font-bold">Your library</h1>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={filter}
          onValueChange={value => value && setFilter(value as Filter)}
        >
          {FILTERS.map(f => (
            <ToggleGroupItem key={f.id} value={f.id}>
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(172px,1fr))] gap-1">
        {!library
          ? Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="m-2.5 aspect-square" />)
          : cards.map((card, i) => <CardTile key={`${card.browseId}-${i}`} card={card} />)}
      </div>
    </div>
  );
}
