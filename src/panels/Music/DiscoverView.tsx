import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Compass, RotateCcw, Shuffle } from 'lucide-react';
import { toast } from 'sonner';

import CometDial from '@/components/reactbits/CometDial';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { DISCOVER_DEFAULTS, useMusicStore } from '@/stores/useMusicStore';
import type { DiscoverAxis, DiscoverProgress, DiscoverTaste, DiscoverTrack } from '@/types';

import { LINK, openArtist, TrackMenu } from './menus';
import Shelf from './Shelf';
import { Cover } from './ui';

const AXES: Array<{ axis: DiscoverAxis; left: string; right: string }> = [
  { axis: 'bright', left: 'Dark', right: 'Bright' },
  { axis: 'energy', left: 'Calm', right: 'Fast' },
  { axis: 'electronic', left: 'Acoustic', right: 'Electronic' },
  { axis: 'popular', left: 'Deep cuts', right: 'Hits' },
];

function message(err: unknown): string {
  return err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err);
}

async function playDiscovered(track: DiscoverTrack): Promise<string> {
  let videoId = track.videoId;
  if (!videoId) {
    const found = await window.api.musicDiscover.find(track.title, track.artist);
    if (!found) throw new Error(`${track.title} is not on YouTube Music`);
    videoId = found.videoId;
  }
  await useMusicStore.getState().send({ kind: 'playVideo', videoId });
  return videoId;
}

function FilterDial({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  dim,
  foot,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  dim?: boolean;
  foot: ReactNode;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex w-[112px] flex-col items-center gap-1 text-center">
      <CometDial
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        unit={unit}
        size={92}
        onChangeEnd={next => next !== value && onChange(next)}
        className={cn('transition-opacity duration-150', dim && 'opacity-50')}
      />
      <span className="text-[12px] font-medium leading-tight">{label}</span>
      <div className="flex h-6 items-center">{foot}</div>
    </div>
  );
}

function DiscoverList({ tracks, loading, empty }: { tracks: DiscoverTrack[]; loading: boolean; empty: string }) {
  const current = useMusicStore(s => s.state?.videoId ?? '');
  const [busy, setBusy] = useState('');
  const [found, setFound] = useState<Record<string, string>>({});

  if (loading && !tracks.length) {
    return (
      <div className="flex gap-1 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex w-[172px] flex-none flex-col gap-2 p-2.5">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }
  if (!tracks.length) return <p className="px-3 text-[13px] text-muted-foreground">{empty}</p>;

  const play = async (track: DiscoverTrack) => {
    if (busy) return;
    setBusy(track.key);
    try {
      const videoId = await playDiscovered({ ...track, videoId: track.videoId || found[track.key] || '' });
      setFound(f => ({ ...f, [track.key]: videoId }));
    } catch (err) {
      toast.error(message(err));
    } finally {
      setBusy('');
    }
  };

  return (
    <Shelf className="grid auto-cols-[172px] grid-flow-col gap-1">
      {tracks.map(track => {
        const videoId = track.videoId || found[track.key] || '';
        const on = !!videoId && videoId === current;
        const tile = (
          <div
            role="button"
            tabIndex={0}
            onClick={() => void play(track)}
            onKeyDown={e => e.key === 'Enter' && void play(track)}
            className="group flex min-w-0 flex-col gap-2 rounded-lg p-2.5 outline-none transition-colors duration-150 hover:bg-accent/50 focus-visible:bg-accent/50"
          >
            <div className="grid">
              <Cover
                src={track.artwork}
                expand={{ kind: 'song', title: track.title, artist: track.artist }}
                onClick={() => void play(track)}
                playable={busy !== track.key}
                className="aspect-square w-full [grid-area:1/1]"
              />
              {busy === track.key && (
                <span className="pointer-events-none z-10 grid place-items-center rounded-md bg-black/35 text-white [grid-area:1/1]">
                  <Spinner className="size-6" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className={cn('truncate text-[13.5px] font-medium', on && 'text-primary')}>{track.title}</div>
              <button
                type="button"
                tabIndex={-1}
                onClick={e => {
                  e.stopPropagation();
                  openArtist(track.artist);
                }}
                className={cn(LINK, 'block max-w-full truncate text-[12px] text-muted-foreground')}
              >
                {track.artist}
              </button>
              <div className="truncate text-[12px] text-muted-foreground">{track.reason}</div>
            </div>
          </div>
        );
        return videoId ? (
          <TrackMenu key={track.key} track={{ videoId, title: track.title, artist: track.artist, album: track.album }}>
            {tile}
          </TrackMenu>
        ) : (
          <div key={track.key}>{tile}</div>
        );
      })}
    </Shelf>
  );
}

export default function DiscoverView({ tag }: { tag?: string }) {
  const settings = useMusicStore(s => s.discover);
  const setDiscover = useMusicStore(s => s.setDiscover);
  const go = useMusicStore(s => s.go);
  const [taste, setTaste] = useState<DiscoverTaste | null | undefined>(undefined);
  const [progress, setProgress] = useState<DiscoverProgress | null>(null);
  const [library, setLibrary] = useState<DiscoverTrack[]>([]);
  const [fresh, setFresh] = useState<DiscoverTrack[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [loadingFresh, setLoadingFresh] = useState(true);
  const seq = useRef(0);

  const loadTaste = useCallback(async () => {
    try {
      const next = await window.api.musicDiscover.taste();
      setTaste(next);
      if (next) setProgress(next.progress);
    } catch (err) {
      setTaste(null);
      toast.error(message(err));
    }
  }, []);

  useEffect(() => {
    if (tag) setDiscover({ tags: [tag] });
  }, [tag, setDiscover]);

  useEffect(() => {
    void loadTaste();
    window.api.musicDiscover
      .enrich()
      .then(setProgress)
      .catch(err => console.error('[discover] enrich failed', err));
    return window.api.musicDiscover.onProgress(next => {
      setProgress(next);
      if (!next.running) void loadTaste();
    });
  }, [loadTaste]);

  useEffect(() => {
    const id = ++seq.current;
    setLoadingLibrary(true);
    setLoadingFresh(true);
    const timer = setTimeout(() => {
      window.api.musicDiscover
        .library(settings)
        .then(rows => id === seq.current && setLibrary(rows))
        .catch(err => id === seq.current && toast.error(message(err)))
        .finally(() => id === seq.current && setLoadingLibrary(false));
      window.api.musicDiscover
        .fresh(settings)
        .then(rows => id === seq.current && setFresh(rows))
        .catch(err => id === seq.current && toast.error(message(err)))
        .finally(() => id === seq.current && setLoadingFresh(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [settings]);

  if (taste === undefined) {
    return (
      <div className="flex flex-col gap-4 px-2.5">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!taste || taste.heard === 0) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Compass size={15} strokeWidth={1.6} />
          </EmptyMedia>
          <EmptyTitle>Nothing to go on yet</EmptyTitle>
          <EmptyDescription>Discover picks from the songs you have heard. Play a few and come back.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" onClick={() => go({ kind: 'home' })}>
            Go to Home
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const setAxis = (axis: DiscoverAxis, value: number | undefined) => {
    const axes = { ...settings.axes };
    if (value === undefined) delete axes[axis];
    else axes[axis] = value;
    setDiscover({ axes });
  };
  const running = progress?.running;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4 px-2.5">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold">Discover</h1>
          <p className="text-[13px] text-muted-foreground">
            Built from {taste.heard} songs you have heard, {taste.artistsTagged} of {taste.artists} artists have genres,{' '}
            {taste.tracksMeasured} songs measured while playing.
          </p>
        </div>
        <div className="flex flex-none gap-2">
          <Button variant="outline" size="sm" onClick={() => setDiscover({ ...DISCOVER_DEFAULTS, seed: settings.seed })}>
            <RotateCcw size={15} strokeWidth={1.6} /> Reset
          </Button>
          <Button size="sm" onClick={() => setDiscover({ seed: settings.seed + 1 })}>
            <Shuffle size={15} strokeWidth={1.6} /> New picks
          </Button>
        </div>
      </div>

      {running && progress && (
        <div className="flex items-center gap-3 px-2.5 text-[12px] text-muted-foreground">
          <Spinner className="size-4" />
          <span className="flex-none">
            Looking up {progress.phase === 'artists' ? 'genres' : 'tempo and popularity'}, {progress.done} of {progress.total}
          </span>
          <Progress value={(progress.done / Math.max(1, progress.total)) * 100} className="h-1.5 max-w-60" />
        </div>
      )}

      <section className="flex flex-col gap-2 px-2.5">
        <h2 className="text-[15px] font-semibold">Genres you play</h2>
        {taste.tags.length ? (
          <ToggleGroup
            type="multiple"
            spacing={1}
            value={settings.tags}
            onValueChange={tags => setDiscover({ tags })}
            className="w-full flex-wrap"
          >
            {taste.tags.map(t => (
              <ToggleGroupItem
                key={t.tag}
                value={t.tag}
                variant="outline"
                size="sm"
                className="rounded-full px-3 capitalize hover:bg-accent/60 focus-visible:bg-accent/60 data-[state=on]:border-primary data-[state=on]:bg-accent/70"
              >
                {t.tag}
                <span className="text-[11px] text-muted-foreground tabular-nums">{Math.max(1, Math.round(t.share * 100))}%</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            {running ? 'Genres show up here as your artists are looked up.' : 'No genres found for the artists you play yet.'}
          </p>
        )}
      </section>

      <section className="flex flex-wrap items-start justify-evenly gap-x-2 gap-y-4 px-2.5">
        {AXES.map(a => {
          const value = settings.axes[a.axis];
          return (
            <FilterDial
              key={a.axis}
              label={`${a.left} to ${a.right}`}
              value={Math.round((value ?? taste.center[a.axis] ?? 0) * 100)}
              min={-100}
              max={100}
              step={1}
              dim={value === undefined}
              onChange={v => setAxis(a.axis, v / 100)}
              foot={
                value !== undefined ? (
                  <Button variant="ghost" size="xs" onClick={() => setAxis(a.axis, undefined)}>
                    Any
                  </Button>
                ) : (
                  <span className="text-[12px] text-muted-foreground">Any</span>
                )
              }
            />
          );
        })}
        <FilterDial
          label="New songs in the mix"
          value={Math.round(settings.fresh * 100)}
          min={0}
          max={100}
          step={5}
          unit="%"
          onChange={v => setDiscover({ fresh: v / 100 })}
          foot={null}
        />
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="px-2.5 text-[18px] font-semibold">From songs you have heard</h2>
        <DiscoverList
          tracks={library}
          loading={loadingLibrary}
          empty={settings.fresh >= 1 ? 'Set the mix below 100% new to see songs you know.' : 'Nothing you have heard fits these genres.'}
        />
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="px-2.5 text-[18px] font-semibold">New to you</h2>
        <DiscoverList
          tracks={fresh}
          loading={loadingFresh}
          empty={settings.fresh <= 0 ? 'Move the mix toward new songs to see some here.' : 'No new songs found for this mix.'}
        />
      </section>
    </div>
  );
}
