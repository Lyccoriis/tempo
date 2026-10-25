import { useState } from 'react';
import { Disc3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { GLASS } from '@/lib/glass';
import { cn } from '@/lib/utils';
import { useMusicStore } from '@/stores/useMusicStore';
import type { RepoAlbumSort, RepoSortDir } from '@/types';

import { Cover } from '../ui';
import { firstDir, fmtListened, LayoutToggle, PAGE, Pager, ROW, SearchBox, SortHead, useDebounced, useRepo } from './parts';
import { AlbumTile, GALLERY } from './tiles';

const GALLERY_SORTS: Array<{ id: RepoAlbumSort; label: string }> = [
  { id: 'plays', label: 'Most played' },
  { id: 'listened', label: 'Most time' },
  { id: 'heard', label: 'Most songs heard' },
  { id: 'year', label: 'Year' },
  { id: 'title', label: 'Title' },
  { id: 'artist', label: 'Artist' },
];

export default function AlbumsTable({ artistId }: { artistId?: number }) {
  const go = useMusicStore(s => s.go);
  const layout = useMusicStore(s => (artistId ? 'gallery' : s.dataLayout.albums));
  const [text, setText] = useState('');
  const [sort, setSort] = useState<RepoAlbumSort>('plays');
  const [dir, setDir] = useState<RepoSortDir>('desc');
  const [offset, setOffset] = useState(0);
  const search = useDebounced(text, () => setOffset(0));

  const { data } = useRepo(
    () => window.api.musicRepo.albums({ search, sort, dir, offset, limit: PAGE, artistId }),
    [search, sort, dir, offset, artistId],
  );

  const onSort = (id: RepoAlbumSort, next: RepoSortDir) => {
    setSort(id);
    setDir(next);
    setOffset(0);
  };
  const head = { sort, dir, onSort };

  return (
    <div className="flex flex-col gap-3">
      {!artistId && (
        <div className="flex flex-wrap items-center gap-2 px-2.5">
          <SearchBox value={text} onChange={setText} placeholder="Album or artist" />
          {layout === 'gallery' && (
            <Select value={sort} onValueChange={value => onSort(value as RepoAlbumSort, firstDir(value))}>
              <SelectTrigger size="sm" className="w-[160px] bg-card/50" aria-label="Sort by">
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
          <LayoutToggle tab="albums" />
        </div>
      )}

      {!data ? (
        layout === 'gallery' ? (
          <div className={GALLERY}>
            {Array.from({ length: artistId ? 4 : 12 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2 p-2">
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 px-2.5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        )
      ) : data.total === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Disc3 size={15} strokeWidth={1.6} />
            </EmptyMedia>
            <EmptyTitle>{search ? 'No albums match' : 'No albums known yet'}</EmptyTitle>
            <EmptyDescription>
              {search ? 'Try another search.' : 'An album is known once one of its songs plays or sits in the queue with the album named.'}
            </EmptyDescription>
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
              <AlbumTile key={row.id} row={row} />
            ))}
          </div>
          <Pager offset={data.offset} limit={data.limit} total={data.total} onPage={setOffset} />
        </>
      ) : (
        <>
          <Table className="text-[12.5px]">
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <SortHead id="title" {...head} className="pl-3">
                  Album
                </SortHead>
                <SortHead id="year" {...head} right>
                  Year
                </SortHead>
                <SortHead id="tracks" {...head} right>
                  Known
                </SortHead>
                <SortHead id="heard" {...head} right>
                  Heard
                </SortHead>
                <SortHead id="plays" {...head} right>
                  Plays
                </SortHead>
                <SortHead id="listened" {...head} right className="pr-3">
                  Time
                </SortHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map(row => (
                <TableRow
                  key={row.id}
                  tabIndex={0}
                  className={ROW}
                  onClick={() => go({ kind: 'dataAlbum', id: row.id, title: row.title })}
                  onKeyDown={e => e.key === 'Enter' && go({ kind: 'dataAlbum', id: row.id, title: row.title })}
                >
                  <TableCell className="max-w-0 pl-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Cover src={row.artwork} className="size-10" />
                      <div className="min-w-0">
                        <div className="truncate text-[13px] text-foreground">{row.title}</div>
                        <div className="truncate text-[11.5px] text-muted-foreground">{row.artist}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{row.year ?? ''}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.tracks}</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{row.heard}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.plays || ''}</TableCell>
                  <TableCell className="pr-3 text-right text-muted-foreground tabular-nums">{row.listenedMs ? fmtListened(row.listenedMs) : ''}</TableCell>
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
