import { Fragment } from 'react';

import { Music } from 'lucide-react';

import FlipCard from '@/components/reactbits/FlipCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GLASS } from '@/lib/glass';
import { cn } from '@/lib/utils';
import { useMusicStore } from '@/stores/useMusicStore';
import type { RepoAlbumDetail, RepoTrackRow } from '@/types';

import { TrackMenu } from '../menus';
import { Cover } from '../ui';
import { Disclosure, ExternalIds, HeroSkeleton, NotFound, RawRecord } from './TrackDetail';
import { discovery, DiscoveryBadge, fmtAgo, fmtDate, fmtDuration, fmtListened, fmtPercent, Hero, HERO_LINK, HeroStat, plural, Section, useRepo } from './parts';

function Back({ album, tracks }: { album: RepoAlbumDetail; tracks: RepoTrackRow[] | null }) {
  return (
    <div className="grid size-full grid-rows-[minmax(0,1fr)]">
      <Cover src={album.artwork} className="size-full -scale-x-100 rounded-none [grid-area:1/1]" />
      <div className="relative bg-black/85 [grid-area:1/1]" />
      <div className="relative flex min-h-0 flex-col gap-3 overflow-y-auto p-4 text-white [grid-area:1/1]">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold">{album.title}</div>
          <div className="truncate text-[11.5px] text-white/60">{[album.artist, album.year].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-y border-white/15 py-2">
          {(
            [
              ['Plays', String(album.plays)],
              ['Listened', fmtListened(album.listenedMs)],
              ['Heard', `${album.heard}/${album.tracks}`],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="min-w-0">
              <div className="text-[10px] font-medium tracking-[0.06em] text-white/55 uppercase">{label}</div>
              <div className="truncate text-[12.5px] font-semibold tabular-nums">{value}</div>
            </div>
          ))}
        </div>
        <ol className="flex flex-col gap-0.5 text-[12px]">
          {(tracks ?? []).map((t, i) => (
            <li key={t.id} className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-baseline gap-2">
              <span className="text-right text-white/45 tabular-nums">{i + 1}</span>
              <span className={cn('truncate', t.plays ? 'text-white/90' : 'text-white/50')}>{t.title}</span>
              <span className="text-white/45 tabular-nums">{t.plays ? `${t.plays}×` : fmtDuration(t.durationMs)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function TrackRow({ row, index }: { row: RepoTrackRow; index: number }) {
  const go = useMusicStore(s => s.go);
  const state = discovery(row);
  return (
    <TrackMenu track={{ videoId: row.videoId, title: row.title, artist: row.artist, album: row.album }}>
      <button
        type="button"
        onClick={() => go({ kind: 'dataTrack', id: row.id, title: row.title })}
        className="grid grid-cols-[24px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-accent/60 focus-visible:bg-accent/60"
      >
        <span className="text-right text-[12.5px] text-muted-foreground tabular-nums">{index + 1}</span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={cn('truncate text-[13.5px]', !row.plays && 'text-muted-foreground')}>{row.title}</span>
            <DiscoveryBadge state={state} />
          </div>
          <div className="truncate text-[11.5px] text-muted-foreground">{row.artist}</div>
        </div>
        <span className="text-right text-[11.5px] text-muted-foreground tabular-nums">
          {row.plays > 0 && (
            <>
              {plural(row.plays, 'play')} · {fmtPercent(row.completion)}
            </>
          )}
        </span>
        <span className="w-10 text-right text-[12px] text-muted-foreground tabular-nums">{fmtDuration(row.durationMs)}</span>
      </button>
    </TrackMenu>
  );
}

export default function AlbumDetail({ id }: { id: number }) {
  const go = useMusicStore(s => s.go);
  const { data: album, loaded, error } = useRepo(() => window.api.musicRepo.album(id), [id]);
  const { data: tracks } = useRepo(() => window.api.musicRepo.tracks({ albumId: id, sort: 'known', dir: 'asc', limit: 200 }), [id]);

  if (!loaded) return <HeroSkeleton />;
  if (!album) return <NotFound what="Album" error={error} />;

  const page = album.externalIds.find(x => x.provider === 'youtube_music' && x.externalId.startsWith('MPRE'))?.externalId;

  return (
    <div className="flex flex-col gap-7">
      <Hero
        artwork={album.artwork}
        kind="Album"
        title={album.title}
        art={
          <div className="flex flex-col items-center gap-2">
            <FlipCard
              ariaLabel="Turn the cover over"
              className="aspect-square w-56 shrink-0 rounded-lg"
              front={<Cover src={album.artwork} className="size-full rounded-none" />}
              back={<Back album={album} tracks={tracks?.rows ?? null} />}
            />
            <span className="text-[11px] text-white/50">Click the cover to turn it over</span>
          </div>
        }
        byline={
          <>
            {album.artists.map((a, i) => (
              <Fragment key={a.id}>
                {i > 0 && <span>, </span>}
                <button type="button" className={HERO_LINK} onClick={() => go({ kind: 'dataArtist', id: a.id, title: a.name })}>
                  {a.name}
                </button>
              </Fragment>
            ))}
            {!album.artists.length && <span>{album.artist || 'Unknown artist'}</span>}
            {(album.releaseDate || album.year) && (
              <>
                <span className="px-1">·</span>
                <span className="tabular-nums">{album.releaseDate || album.year}</span>
              </>
            )}
          </>
        }
        action={
          page && (
            <Button variant="outline" size="sm" onClick={() => go({ kind: 'page', browseId: page, title: album.title })}>
              <Music size={15} strokeWidth={1.6} /> Album page
            </Button>
          )
        }
        stats={
          <>
            <HeroStat label="Plays" value={album.plays} />
            <HeroStat label="Listened" text={album.listenedMs ? fmtListened(album.listenedMs) : ''} />
            <HeroStat label="Songs heard" text={`${album.heard} of ${album.tracks}`} />
            <HeroStat label="Avg heard" text={fmtPercent(album.avgCompletion)} />
            <HeroStat label="First heard" text={fmtDate(album.firstHeardAt)} />
            <HeroStat label="Last heard" text={fmtAgo(album.lastHeardAt)} />
          </>
        }
      />

      <Section title="Songs" sub={album.tracks > album.heard ? `${album.tracks - album.heard} still to hear` : album.tracks ? 'Every known song heard' : undefined}>
        <div className={cn(GLASS, 'mx-2.5 rounded-xl p-2')}>
          {!tracks ? (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : tracks.rows.length ? (
            tracks.rows.map((row, i) => <TrackRow key={row.id} row={row} index={i} />)
          ) : (
            <p className="px-2 py-3 text-[12.5px] text-muted-foreground">No songs from this album are known yet.</p>
          )}
        </div>
        <p className="px-2.5 text-[11.5px] text-muted-foreground">Only the songs this profile has come across, in the order they were found.</p>
      </Section>

      <div className="flex flex-col gap-1">
        <Disclosure title="Sources and ids">
          <ExternalIds ids={album.externalIds} />
        </Disclosure>
        <Disclosure title="Advanced">
          <RawRecord value={album} />
        </Disclosure>
      </div>
    </div>
  );
}
