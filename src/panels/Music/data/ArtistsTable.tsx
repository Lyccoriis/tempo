import { useState } from 'react';
import { MicVocal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { GLASS } from '@/lib/glass';
import { cn } from '@/lib/utils';
import { useMusicStore } from '@/stores/useMusicStore';
import type { RepoArtistSort, RepoSortDir } from '@/types';

import { Cover } from '../ui';
import { firstDir, fmtDate, fmtListened, LayoutToggle, PAGE, Pager, ROW, SearchBox, SortHead, useDebounced, useRepo } from './parts';
import { ArtistTile, GALLERY } from './tiles';

const GALLERY_SORTS: Array<{ id: RepoArtistSort; label: string }> = [
  { id: 'plays', label: 'Most played' },
  { id: 'listened', label: 'Most time' },
  { id: 'lastHeard', label: 'Last heard' },
  { id: 'firstHeard', label: 'First heard' },
  { id: 'tracks', label: 'Most songs' },
  { id: 'name', label: 'Name' },
];

export default function ArtistsTable() {
  const go = useMusicStore(s => s.go);
  const layout = useMusicStore(s => s.dataLayout.artists);
  const [text, setText] = useState('');
  const [sort, setSort] = useState<RepoArtistSort>('plays');
  const [dir, setDir] = useState<RepoSortDir>('desc');
  const [offset, setOffset] = useState(0);
  const search = useDebounced(text, () => setOffset(0));

  const { data } = useRepo(() => window.api.musicRepo.artists({ search, sort, dir, offset, limit: PAGE }), [search, sort, dir, offset]);

  const onSort = (id: RepoArtistSort, next: RepoSortDir) => {
    setSort(id);
    setDir(next);
    setOffset(0);
  };
  const head = { sort, dir, onSort };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 px-2.5">
        <SearchBox value={text} onChange={setText} placeholder="Artist name" />
        {layout === 'gallery' && (
          <Select value={sort} onValueChange={value => onSort(value as RepoArtistSort, firstDir(value))}>
            <SelectTrigger size="sm" className="w-[150px] bg-card/50" aria-label="Sort by">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className={cn(GLASS, 'rounded-xl')}>
              {GALLERY_SORTS.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <LayoutToggle tab="artists" />
      </div>

      {!data ? (
        layout === 'gallery' ? (
          <div className={GALLERY}>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 p-2">
                <Skeleton className="aspect-square w-full rounded-full" />
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 px-2.5">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        )
      ) : data.total === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MicVocal size={15} strokeWidth={1.6} />
            </EmptyMedia>
            <EmptyTitle>{search ? 'No artists match' : 'No artists known yet'}</EmptyTitle>
            <EmptyDescription>{search ? 'Try another name.' : 'Artists come in with the songs that play or sit in the queue.'}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {search ? (
              <Button size="sm" variant="outline" onClick={() => setText('')}>
                Clear search
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => go({ kind: 'home' })}>
                Go to Home
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : layout === 'gallery' ? (
        <>
          <div className={GALLERY}>
            {data.rows.map(row => (
              <ArtistTile key={row.id} row={row} />
            ))}
          </div>
          <Pager offset={data.offset} limit={data.limit} total={data.total} onPage={setOffset} />
        </>
      ) : (
        <>
          <Table className="text-[12.5px]">
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <SortHead id="name" {...head} className="pl-3">
                  Artist
                </SortHead>
                <SortHead id="tracks" {...head} right>
                  Known
                </SortHead>
                <SortHead id="heard" {...head} right>
                  Heard
                </SortHead>
                <SortHead id="albums" {...head} right>
                  Albums
                </SortHead>
                <SortHead id="plays" {...head} right>
                  Plays
                </SortHead>
                <SortHead id="listened" {...head} right>
                  Time
                </SortHead>
                <SortHead id="firstHeard" {...head}>
                  First heard
                </SortHead>
                <SortHead id="lastHeard" {...head} className="pr-3">
                  Last heard
                </SortHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map(row => (
                <TableRow
                  key={row.id}
                  tabIndex={0}
                  className={ROW}
                  onClick={() => go({ kind: 'dataArtist', id: row.id, title: row.name })}
                  onKeyDown={e => e.key === 'Enter' && go({ kind: 'dataArtist', id: row.id, title: row.name })}
                >
                  <TableCell className="max-w-0 pl-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Cover src={row.artwork} round className="size-8" />
                      <div className="min-w-0">
                        <div className="truncate text-[13px] text-foreground">{row.name}</div>
                        {row.topTrack && <div className="truncate text-[11.5px] text-muted-foreground">Most played: {row.topTrack}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.tracks}</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{row.heard}</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{row.albums || ''}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.plays || ''}</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{row.listenedMs ? fmtListened(row.listenedMs) : ''}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{fmtDate(row.firstHeardAt)}</TableCell>
                  <TableCell className="pr-3 text-muted-foreground tabular-nums">{fmtDate(row.lastHeardAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager offset={data.offset} limit={data.limit} total={data.total} onPage={setOffset} />
        </>
      )}
    </div>
  );
}
