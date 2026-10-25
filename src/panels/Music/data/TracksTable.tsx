import { useState } from 'react';
import { ListMusic } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { GLASS } from '@/lib/glass';
import { cn } from '@/lib/utils';
import { useMusicStore } from '@/stores/useMusicStore';
import type { RepoSortDir, RepoTrackQuery, RepoTrackSort } from '@/types';

import { Cover } from '../ui';
import { discovery, DiscoveryBadge, firstDir, fmtDate, fmtDuration, fmtListened, fmtPercent, LayoutToggle, PAGE, Pager, ROW, SearchBox, SortHead, useDebounced, useRepo } from './parts';
import { GALLERY, SongTile } from './tiles';

const GALLERY_SORTS: Array<{ id: RepoTrackSort; label: string }> = [
  { id: 'lastHeard', label: 'Last heard' },
  { id: 'plays', label: 'Most played' },
  { id: 'listened', label: 'Most time' },
  { id: 'known', label: 'Recently found' },
  { id: 'title', label: 'Title' },
  { id: 'artist', label: 'Artist' },
];

interface TracksTableProps {
  artistId?: number;
  albumId?: number;
  bare?: boolean;
  heard?: RepoTrackQuery['heard'];
}

export default function TracksTable({ artistId, albumId, bare, heard: initialHeard }: TracksTableProps) {
  const go = useMusicStore(s => s.go);
  const layout = useMusicStore(s => (bare ? 'table' : s.dataLayout.tracks));
  const [text, setText] = useState('');
  const [heard, setHeard] = useState<NonNullable<RepoTrackQuery['heard']>>(initialHeard ?? 'all');
  const [sort, setSort] = useState<RepoTrackSort>(albumId ? 'known' : 'lastHeard');
  const [dir, setDir] = useState<RepoSortDir>(albumId ? 'asc' : 'desc');
  const [offset, setOffset] = useState(0);
  const search = useDebounced(text, () => setOffset(0));

  const { data } = useRepo(
    () => window.api.musicRepo.tracks({ search, heard, artistId, albumId, sort, dir, offset, limit: PAGE }),
    [search, heard, artistId, albumId, sort, dir, offset],
  );

  const onSort = (id: RepoTrackSort, next: RepoSortDir) => {
    setSort(id);
    setDir(next);
    setOffset(0);
  };
  const head = { sort, dir, onSort };
  const filtered = !!search || heard !== 'all';

  return (
    <div className="flex flex-col gap-3">
      {!bare && (
        <div className="flex flex-wrap items-center gap-2 px-2.5">
          <SearchBox value={text} onChange={setText} placeholder="Title, artist or album" />
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={heard}
            onValueChange={value => {
              if (!value) return;
              setHeard(value as typeof heard);
              setOffset(0);
            }}
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="heard">Heard</ToggleGroupItem>
            <ToggleGroupItem value="unheard">Unheard</ToggleGroupItem>
          </ToggleGroup>
          {layout === 'gallery' && (
            <Select value={GALLERY_SORTS.some(s => s.id === sort) ? sort : undefined} onValueChange={value => onSort(value as RepoTrackSort, firstDir(value))}>
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
          <LayoutToggle tab="tracks" />
        </div>
      )}

      {!data ? (
        layout === 'gallery' ? (
          <div className={GALLERY}>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2 p-2">
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="h-3.5 w-3/4" />
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
              <ListMusic size={15} strokeWidth={1.6} />
            </EmptyMedia>
            <EmptyTitle>{filtered ? 'No songs match' : 'No songs known yet'}</EmptyTitle>
            <EmptyDescription>
              {filtered
                ? heard === 'unheard' && !search
                  ? 'Every song found so far has been heard.'
                  : 'Try another search or show all songs.'
                : 'Songs land here as soon as they play or show up in the queue.'}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {filtered ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setText('');
                  setHeard('all');
                }}
              >
                Show all songs
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
              <SongTile key={row.id} row={row} showUnheard={heard !== 'unheard'} />
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
                  Title
                </SortHead>
                {!albumId && (
                  <SortHead id="album" {...head}>
                    Album
                  </SortHead>
                )}
                <SortHead id="duration" {...head} right>
                  Length
                </SortHead>
                <SortHead id="firstHeard" {...head}>
                  First heard
                </SortHead>
                <SortHead id="lastHeard" {...head}>
                  Last heard
                </SortHead>
                <SortHead id="plays" {...head} right>
                  Plays
                </SortHead>
                <SortHead id="listened" {...head} right>
                  Time
                </SortHead>
                <SortHead id="completion" {...head} right>
                  Avg heard
                </SortHead>
                <SortHead id="skips" {...head} right className="pr-3">
                  Skips
                </SortHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map(row => {
                const state = discovery(row);
                return (
                  <TableRow
                    key={row.id}
                    tabIndex={0}
                    className={ROW}
                    onClick={() => go({ kind: 'dataTrack', id: row.id, title: row.title })}
                    onKeyDown={e => e.key === 'Enter' && go({ kind: 'dataTrack', id: row.id, title: row.title })}
                  >
                    <TableCell className="max-w-0 pl-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Cover src={row.artwork} className="size-8" />
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-[13px] text-foreground">{row.title}</span>
                            {state !== 'unheard' && <DiscoveryBadge state={state} />}
                          </div>
                          <div className="truncate text-[11.5px] text-muted-foreground">{row.artist}</div>
                        </div>
                      </div>
                    </TableCell>
                    {!albumId && <TableCell className="max-w-40 truncate text-muted-foreground">{row.album}</TableCell>}
                    <TableCell className="text-right text-muted-foreground tabular-nums">{fmtDuration(row.durationMs)}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {fmtDate(row.firstHeardAt) || <span className="text-primary/80">Unheard</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{fmtDate(row.lastHeardAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.plays || ''}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">{row.listenedMs ? fmtListened(row.listenedMs) : ''}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">{fmtPercent(row.completion)}</TableCell>
                    <TableCell className="pr-3 text-right text-muted-foreground tabular-nums">{row.skips || ''}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pager offset={data.offset} limit={data.limit} total={data.total} onPage={setOffset} />
        </>
      )}
    </div>
  );
}
