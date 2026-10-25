import type { ReactNode } from 'react';
import { Compass, Disc3, History, MicVocal, Sparkles } from 'lucide-react';

import Counter, { placesFor } from '@/components/reactbits/Counter';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { GLASS } from '@/lib/glass';
import { cn } from '@/lib/utils';
import { useMusicStore } from '@/stores/useMusicStore';
import type { RepoInfo, RepoPlayRow } from '@/types';

import Shelf from '../Shelf';
import { Cover } from '../ui';
import { contextLabel, fmtAgo, fmtDate, fmtDuration, fmtPercent, HeardBar, outcome, plural, Section, SeeAll, Tile, useRepo } from './parts';
import { AlbumTile, ArtistTile, SHELF, SongTile } from './tiles';

function Nothing({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <Empty className="mx-2.5 border border-dashed border-border py-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

function RecentPlay({ play }: { play: RepoPlayRow }) {
  const go = useMusicStore(s => s.go);
  const o = outcome(play.endReason, play.endedAt);
  return (
    <button
      type="button"
      onClick={() => go({ kind: 'dataTrack', id: play.trackId, title: play.title })}
      className="flex min-w-0 items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-accent/60 focus-visible:bg-accent/60"
    >
      <Cover src={play.artwork} className="size-10" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px]">{play.title}</div>
        <div className="truncate text-[11.5px] text-muted-foreground">
          {play.artist}
          <span className="px-1">·</span>
          <span className={o.tone}>{o.label}</span>
          {play.listenedMs > 0 && ` · ${fmtDuration(play.listenedMs)}`}
          {play.completion != null && ` · ${fmtPercent(play.completion)}`}
        </div>
      </div>
      <div className="shrink-0 text-right text-[11.5px] text-muted-foreground tabular-nums">
        <div>{fmtAgo(play.startedAt)}</div>
        <div>{contextLabel(play.origin)}</div>
      </div>
    </button>
  );
}

export default function OverviewTab({ info }: { info: RepoInfo }) {
  const go = useMusicStore(s => s.go);
  const deps = [info.profileId, info.status];
  const { data: summary } = useRepo(() => window.api.musicRepo.summary(), deps);
  const { data: recent } = useRepo(() => window.api.musicRepo.plays({ counted: true, limit: 6 }), deps);
  const { data: found } = useRepo(() => window.api.musicRepo.tracks({ sort: 'known', dir: 'desc', limit: 12 }), deps);
  const { data: artists } = useRepo(() => window.api.musicRepo.artists({ sort: 'plays', dir: 'desc', limit: 12 }), deps);
  const { data: albums } = useRepo(() => window.api.musicRepo.albums({ sort: 'listened', dir: 'desc', limit: 12 }), deps);
  const { data: unheard } = useRepo(() => window.api.musicRepo.tracks({ heard: 'unheard', sort: 'known', dir: 'desc', limit: 12 }), deps);

  if (!summary) {
    return (
      <div className="flex flex-col gap-3 px-2.5">
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const hours = summary.listenedMs / 3600000;
  const heardShare = summary.knownTracks ? summary.heardTracks / summary.knownTracks : 0;
  const topArtists = (artists?.rows ?? []).filter(a => a.plays > 0).slice(0, 8);
  const topAlbums = (albums?.rows ?? []).filter(a => a.plays > 0).slice(0, 8);

  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3 px-2.5">
        <div className={cn(GLASS, 'flex min-w-0 flex-col justify-between gap-4 rounded-xl p-5')}>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">Time listened</span>
            <span className="flex items-baseline gap-1.5 font-bold tabular-nums">
              <Counter value={hours} fontSize={44} places={placesFor(hours, 1)} />
              <span className="text-[15px] font-medium text-muted-foreground">hours</span>
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-border pt-3">
            <div className="min-w-0">
              <div className="text-[11.5px] text-muted-foreground">Plays</div>
              <div className="text-[16px] font-semibold tabular-nums">
                <Counter value={summary.plays} fontSize={16} />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[11.5px] text-muted-foreground">First listen</div>
              <div className="truncate text-[13.5px] font-medium">{fmtDate(summary.firstListenAt) || 'Not yet'}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[11.5px] text-muted-foreground">Latest</div>
              <div className="truncate text-[13.5px] font-medium">{fmtAgo(summary.lastListenAt) || 'Not yet'}</div>
            </div>
          </div>
        </div>

        <div className={cn(GLASS, 'flex min-w-0 flex-col justify-between gap-4 rounded-xl p-5')}>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">Songs known</span>
            <span className="font-bold tabular-nums">
              <Counter value={summary.knownTracks} fontSize={44} />
            </span>
          </div>
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <HeardBar value={heardShare} className="h-1.5" />
            <div className="flex flex-wrap justify-between gap-x-3 text-[12px] tabular-nums">
              <span>
                <span className="font-semibold">{summary.heardTracks.toLocaleString('en-US')}</span> <span className="text-muted-foreground">heard</span>
              </span>
              <button
                type="button"
                onClick={() => go({ kind: 'data', tab: 'tracks', heard: 'unheard' })}
                className="text-primary transition-colors duration-150 hover:underline focus-visible:underline"
              >
                {summary.unheardTracks.toLocaleString('en-US')} waiting to be heard
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="-mt-4 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3 px-2.5">
        <Tile label="Artists" value={summary.artists} />
        <Tile label="Albums" value={summary.albums} />
        <Tile label="Heard" value={summary.heardTracks} sub={`${Math.round(heardShare * 100)}% of known`} />
        <Tile label="Known, not heard" value={summary.unheardTracks} />
      </div>

      <Section title="Recent listening" action={recent?.total ? <SeeAll onClick={() => go({ kind: 'data', tab: 'history' })}>History</SeeAll> : null}>
        {!recent ? (
          <Skeleton className="mx-2.5 h-40 rounded-xl" />
        ) : recent.rows.length ? (
          <div className={cn(GLASS, 'mx-2.5 flex flex-col rounded-xl p-2')}>
            {recent.rows.map(play => (
              <RecentPlay key={play.id} play={play} />
            ))}
          </div>
        ) : (
          <Nothing
            icon={<History size={15} strokeWidth={1.6} />}
            title="Nothing heard yet"
            text="A song counts after 30 seconds, or half of it when it is short."
            action={
              <Button size="sm" variant="outline" onClick={() => go({ kind: 'home' })}>
                Go to Home
              </Button>
            }
          />
        )}
      </Section>

      <Section title="Recently discovered" sub="The newest songs to reach this profile" action={found?.total ? <SeeAll onClick={() => go({ kind: 'data', tab: 'tracks' })} /> : null}>
        {!found ? (
          <Skeleton className="mx-2.5 h-52 rounded-xl" />
        ) : found.rows.length ? (
          <Shelf className={SHELF}>
            {found.rows.map(row => (
              <SongTile key={row.id} row={row} />
            ))}
          </Shelf>
        ) : (
          <Nothing icon={<Sparkles size={15} strokeWidth={1.6} />} title="Nothing found yet" text="Songs land here as soon as they play or show up in a queue." />
        )}
      </Section>

      <Section title="Top artists" action={topArtists.length ? <SeeAll onClick={() => go({ kind: 'data', tab: 'artists' })} /> : null}>
        {!artists ? (
          <Skeleton className="mx-2.5 h-48 rounded-xl" />
        ) : topArtists.length ? (
          <Shelf className={SHELF}>
            {topArtists.map(row => (
              <ArtistTile key={row.id} row={row} />
            ))}
          </Shelf>
        ) : (
          <Nothing icon={<MicVocal size={15} strokeWidth={1.6} />} title="No favorites yet" text="The artists you play most show up here." />
        )}
      </Section>

      <Section title="Top albums" action={topAlbums.length ? <SeeAll onClick={() => go({ kind: 'data', tab: 'albums' })} /> : null}>
        {!albums ? (
          <Skeleton className="mx-2.5 h-52 rounded-xl" />
        ) : topAlbums.length ? (
          <Shelf className={SHELF}>
            {topAlbums.map(row => (
              <AlbumTile key={row.id} row={row} />
            ))}
          </Shelf>
        ) : (
          <Nothing icon={<Disc3 size={15} strokeWidth={1.6} />} title="No albums played yet" text="Albums rank here by the time spent on their songs." />
        )}
      </Section>

      <Section
        title="Waiting to be heard"
        sub={unheard?.total ? `${plural(unheard.total, 'song')} known but not heard yet` : undefined}
        action={unheard?.total ? <SeeAll onClick={() => go({ kind: 'data', tab: 'tracks', heard: 'unheard' })} /> : null}
      >
        {!unheard ? (
          <Skeleton className="mx-2.5 h-52 rounded-xl" />
        ) : unheard.rows.length ? (
          <Shelf className={SHELF}>
            {unheard.rows.map(row => (
              <SongTile key={row.id} row={row} showUnheard={false} />
            ))}
          </Shelf>
        ) : (
          <Nothing icon={<Compass size={15} strokeWidth={1.6} />} title="All caught up" text="Every song this profile knows has been heard at least once." />
        )}
      </Section>
    </div>
  );
}
