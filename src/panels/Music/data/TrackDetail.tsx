import { Fragment, type ReactNode } from 'react';
import { ChevronRight, FileQuestion } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isPlaying, useMusicStore } from '@/stores/useMusicStore';
import type { RepoExternalId, RepoFeature } from '@/types';

import { PlayGlyph } from '../ui';
import Timeline from './Timeline';
import {
  contextLabel,
  discovery,
  DiscoveryBadge,
  Facts,
  fmtDate,
  fmtDateTime,
  fmtDuration,
  fmtListened,
  fmtPercent,
  Hero,
  HERO_LINK,
  HeroStat,
  Section,
  useRepo,
} from './parts';

const PLAIN_ROW = 'border-border/60 hover:bg-transparent';

const VIA: Record<string, string> = {
  playback: 'Played',
  queue: 'Seen in the queue',
  legacy: 'Old listening history',
};

const FEATURE_LABEL: Record<string, string> = {
  bpm: 'BPM',
  tempo: 'BPM',
  key: 'Key',
  mode: 'Mode',
  energy: 'Energy',
  danceability: 'Danceability',
  valence: 'Mood',
  acousticness: 'Acoustic',
  loudness: 'Loudness',
};

function featureValue(f: RepoFeature): string {
  if (f.valueText) return f.valueText;
  if (f.valueNum == null) return '';
  if (f.feature === 'bpm' || f.feature === 'tempo') return String(Math.round(f.valueNum));
  if (f.valueNum >= 0 && f.valueNum <= 1) return fmtPercent(f.valueNum);
  return String(Math.round(f.valueNum * 10) / 10);
}

function provenance(provider: string, at: number, confidence?: number | null): string {
  return [`From ${provider}`, fmtDate(at), confidence != null ? `${fmtPercent(confidence)} sure` : ''].filter(Boolean).join(' · ');
}

export function Sourced({ note, children }: { note: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default underline decoration-muted-foreground/40 decoration-dotted underline-offset-4">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{note}</TooltipContent>
    </Tooltip>
  );
}

export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Collapsible className="flex flex-col gap-2">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="group mx-1.5 self-start text-muted-foreground">
          <ChevronRight size={15} strokeWidth={1.6} className="transition-transform duration-150 group-data-[state=open]:rotate-90" /> {title}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function ExternalIds({ ids }: { ids: RepoExternalId[] }) {
  if (!ids.length) return <p className="px-2.5 text-[12.5px] text-muted-foreground">No outside ids yet.</p>;
  return (
    <Table className="text-[12.5px]">
      <TableHeader>
        <TableRow className={PLAIN_ROW}>
          <TableHead className="pl-3">Provider</TableHead>
          <TableHead>Id</TableHead>
          <TableHead className="pr-3">Added</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ids.map(id => (
          <TableRow key={`${id.provider}-${id.externalId}`} className={PLAIN_ROW}>
            <TableCell className="pl-3">{id.provider}</TableCell>
            <TableCell className="font-mono text-[11.5px]">{id.externalId}</TableCell>
            <TableCell className="pr-3 text-muted-foreground tabular-nums">{fmtDate(id.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function RawRecord({ value }: { value: unknown }) {
  return (
    <pre className="mx-2.5 max-h-96 overflow-auto rounded-md border border-border bg-background/40 p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function NotFound({ what, error }: { what: string; error: string }) {
  const goBack = useMusicStore(s => s.goBack);
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestion size={15} strokeWidth={1.6} />
        </EmptyMedia>
        <EmptyTitle>{what} not found</EmptyTitle>
        <EmptyDescription>{error || 'It is not in this profile’s database.'}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" variant="outline" onClick={goBack}>
          Go back
        </Button>
      </EmptyContent>
    </Empty>
  );
}

export function HeroSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-2.5">
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

export default function TrackDetail({ id }: { id: number }) {
  const go = useMusicStore(s => s.go);
  const send = useMusicStore(s => s.send);
  const nowId = useMusicStore(s => s.state?.videoId ?? '');
  const playing = useMusicStore(s => isPlaying(s.state));
  const { data: track, loaded, error } = useRepo(() => window.api.musicRepo.track(id), [id]);

  if (!loaded) return <HeroSkeleton />;
  if (!track) return <NotFound what="Song" error={error} />;

  const s = track.stats;
  const videoId = track.sources.find(src => src.preferred)?.providerId ?? track.sources[0]?.providerId;
  const current = !!videoId && track.sources.some(src => src.providerId === nowId);
  const artistText = track.artists.map(a => a.name).join(', ');
  const via = VIA[track.knownVia] ?? track.knownVia;
  const genre = track.genres[0];

  return (
    <div className="flex flex-col gap-6">
      <Hero
        artwork={track.artwork}
        expand={{ kind: 'song', title: track.title, artist: artistText, videoId }}
        kind="Song"
        badge={<DiscoveryBadge state={discovery({ plays: s.plays, firstHeardAt: s.firstHeardAt, knownAt: track.knownAt })} />}
        title={track.title}
        byline={
          <>
            {track.artists.map((a, i) => (
              <Fragment key={a.id}>
                {i > 0 && <span>, </span>}
                <button type="button" className={HERO_LINK} onClick={() => go({ kind: 'dataArtist', id: a.id, title: a.name })}>
                  {a.name}
                </button>
              </Fragment>
            ))}
            {!track.artists.length && <span>Unknown artist</span>}
            {track.album && (
              <>
                <span className="px-1">·</span>
                <button type="button" className={HERO_LINK} onClick={() => go({ kind: 'dataAlbum', id: track.album!.id, title: track.album!.title })}>
                  {track.album.title}
                </button>
              </>
            )}
            {track.durationMs != null && (
              <>
                <span className="px-1">·</span>
                <span className="tabular-nums">{fmtDuration(track.durationMs)}</span>
              </>
            )}
          </>
        }
        action={
          videoId && (
            <Button
              size="icon-lg"
              aria-label={current && playing ? 'Pause' : 'Play'}
              onClick={() => void send(current ? { kind: 'toggle' } : { kind: 'playVideo', videoId })}
              className="size-12 rounded-full [&_svg:not([class*='size-'])]:size-5"
            >
              <PlayGlyph playing={current && playing} />
            </Button>
          )
        }
        stats={
          <>
            <HeroStat label="Plays" value={s.plays} />
            <HeroStat label="Listened" text={s.listenedMs ? fmtListened(s.listenedMs) : ''} />
            <HeroStat label="Completed" value={s.completed} />
            <HeroStat label="Skipped" value={s.skips} />
            <HeroStat label="Avg heard" text={fmtPercent(s.avgCompletion)} />
          </>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
        <Section title="Your history">
          <Facts
            rows={[
              ['First heard', fmtDateTime(s.firstHeardAt) || 'Not heard yet'],
              ['Last heard', fmtDateTime(s.lastHeardAt) || 'Not heard yet'],
              ['Started', s.listens !== s.plays ? `${s.listens} times, ${s.plays} counted` : `${s.listens} times`],
              ['Known since', fmtDateTime(track.knownAt)],
              ['Known from', track.knownVia === 'queue' && track.knownContext ? `${via}, ${contextLabel(track.knownContext).toLowerCase()}` : via],
            ]}
          />
        </Section>
        <Section title="About this song">
          <Facts
            rows={[
              ['Year', track.releaseYear ? String(track.releaseYear) : ''],
              ['Genre', genre ? <Sourced note={provenance(genre.provider, genre.fetchedAt)}>{genre.genre}</Sourced> : ''],
              ...track.features.map(
                f => [FEATURE_LABEL[f.feature] ?? f.feature, <Sourced note={provenance(f.provider, f.fetchedAt, f.confidence)}>{featureValue(f)}</Sourced>] as [string, ReactNode],
              ),
              ['Explicit', track.explicit == null ? '' : track.explicit ? 'Yes' : 'No'],
              ['Instrumental', track.instrumental == null ? '' : track.instrumental ? 'Yes' : 'No'],
            ]}
          />
          {track.genres.length > 1 && (
            <div className="flex flex-wrap gap-1.5 px-2.5">
              {track.genres.slice(1).map(g => (
                <Badge key={`${g.genre}-${g.provider}`} variant="outline" title={provenance(g.provider, g.fetchedAt)}>
                  {g.genre}
                </Badge>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Listening timeline">
        <Timeline trackId={track.id} pageSize={10} />
      </Section>

      <div className="flex flex-col gap-1">
        <Disclosure title="Sources and ids">
          <Table className="text-[12.5px]">
            <TableHeader>
              <TableRow className={PLAIN_ROW}>
                <TableHead className="pl-3">Provider</TableHead>
                <TableHead>Id</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>As seen</TableHead>
                <TableHead>First seen</TableHead>
                <TableHead className="pr-3">Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {track.sources.map(src => (
                <TableRow key={src.id} className={PLAIN_ROW}>
                  <TableCell className="pl-3">
                    {src.provider}
                    {src.preferred && track.sources.length > 1 && (
                      <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[10px]">
                        Preferred
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[11.5px]">{src.providerId}</TableCell>
                  <TableCell className="text-muted-foreground">{src.kind}</TableCell>
                  <TableCell className="max-w-0">
                    <div className="truncate">{src.title}</div>
                    <div className="truncate text-[11.5px] text-muted-foreground">{[src.artistText, src.albumText].filter(Boolean).join(' · ')}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{fmtDate(src.firstSeenAt)}</TableCell>
                  <TableCell className="pr-3 text-muted-foreground tabular-nums">{fmtDate(src.lastSeenAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ExternalIds ids={track.externalIds} />
          {track.knownContext && (
            <Facts rows={[['Found in', <span className="font-mono text-[11.5px]">{track.knownContext}</span>]]} />
          )}
        </Disclosure>
        <Disclosure title="Advanced">
          <RawRecord value={track} />
        </Disclosure>
      </div>
    </div>
  );
}
