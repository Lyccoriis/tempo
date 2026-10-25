import { useEffect, useRef, useState } from 'react';
import {
  Heart,
  ListMusic,
  Maximize2,
  MicVocal,
  Minimize2,
  Repeat,
  Repeat1,
  Shuffle,
  SlidersHorizontal,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';

import WakeSlider from '@/components/reactbits/WakeSlider';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { openSettings } from '@/panels/Settings/sections';
import { useProfileStore } from '@/stores/useProfileStore';
import { clock, isPlaying, useMusicStore } from '@/stores/useMusicStore';

import { LINK, openAlbum, openArtist, TrackMenu, useNowPlaying } from './menus';
import { GLASS } from '@/lib/glass';
import { Cover, EnhancedBadge, PlayGlyph } from './ui';

export function usePosition(): number {
  const state = useMusicStore(s => s.state);
  const stateAt = useMusicStore(s => s.stateAt);
  const [now, setNow] = useState(() => performance.now());
  const playing = state?.state === 1;

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(id);
  }, [playing]);

  if (!state) return 0;
  const ahead = playing ? Math.max(0, (now - stateAt) / 1000) : 0;
  return Math.min(state.duration || 0, state.position + Math.min(ahead, 1.5));
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

interface PlayerBarProps {
  queueOpen: boolean;
  onToggleQueue: () => void;
  lyricsOpen: boolean;
  onToggleLyrics: () => void;
  focus: boolean;
  onToggleFocus: () => void;
}

export default function PlayerBar({
  queueOpen,
  onToggleQueue,
  lyricsOpen,
  onToggleLyrics,
  focus,
  onToggleFocus,
}: PlayerBarProps) {
  const state = useMusicStore(s => s.state);
  const send = useMusicStore(s => s.send);
  const eqOn = useProfileStore(s => s.activeConfig?.musicEq?.enabled === true);
  const position = usePosition();
  const now = useNowPlaying();
  const [seeking, setSeeking] = useState<number | null>(null);
  const [volume, setVolume] = useState<number | null>(null);
  const wheelTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const loaded = Boolean(state?.videoId);
  const playing = isPlaying(state);
  const duration = state?.duration ?? 0;
  const shown = seeking ?? position;
  const level = volume ?? (state?.muted ? 0 : (state?.volume ?? 0));
  const VolumeIcon = level === 0 ? VolumeX : level < 50 ? Volume1 : Volume2;
  const RepeatIcon = state?.repeat === 'ONE' ? Repeat1 : Repeat;

  useEffect(() => () => clearTimeout(wheelTimer.current), []);

  function wheelVolume(e: React.WheelEvent) {
    if (!loaded || e.deltaY === 0) return;
    const delta = e.deltaY < 0 ? 5 : -5;
    setVolume(Math.min(100, Math.max(0, level + delta)));
    void send({ kind: 'volumeStep', delta });
    clearTimeout(wheelTimer.current);
    wheelTimer.current = setTimeout(() => setVolume(null), 1500);
  }

  return (
    <div className={cn(GLASS, 'grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-4 rounded-xl px-3 py-2.5')}>
      <div className="flex min-w-0 items-center gap-3">
        {now ? (
          <TrackMenu track={now}>
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" disabled={!now.albumId} onClick={() => openAlbum(now.album ?? '', now.albumId)}>
                <Cover src={state?.artwork ?? ''} className="size-14" />
              </button>
              <div className="flex min-w-0 flex-col items-start">
                <div className="flex max-w-full min-w-0 items-center gap-1.5">
                  {now.albumId ? (
                    <button
                      type="button"
                      onClick={() => openAlbum(now.album ?? '', now.albumId)}
                      className={cn(LINK, 'text-[13.5px] font-medium')}
                    >
                      {now.title}
                    </button>
                  ) : (
                    <div className="max-w-full truncate text-[13.5px] font-medium">{now.title}</div>
                  )}
                  <EnhancedBadge videoId={now.videoId} />
                </div>
                <button
                  type="button"
                  onClick={() => openArtist(now.artist, now.artistId)}
                  className={cn(LINK, 'text-[12px] text-muted-foreground')}
                >
                  {now.artist}
                </button>
              </div>
            </div>
          </TrackMenu>
        ) : (
          <>
            <Cover src="" className="size-14" />
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-medium">Nothing playing</div>
              <div className="truncate text-[12px] text-muted-foreground">Pick a song to start</div>
            </div>
          </>
        )}
        {loaded && (
          <Tip label={state?.like === 'LIKE' ? 'Remove from liked songs' : 'Like'}>
            <Button variant="ghost" size="icon-sm" onClick={() => void send({ kind: 'like' })}>
              <Heart
                size={15}
                strokeWidth={1.6}
                className={cn(state?.like === 'LIKE' && 'fill-primary text-primary')}
              />
            </Button>
          </Tip>
        )}
      </div>

      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <Tip label={state?.shuffle ? 'Shuffle off' : 'Shuffle'}>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!loaded}
              onClick={() => void send({ kind: 'shuffle' })}
              className={cn(state?.shuffle && 'text-primary')}
            >
              <Shuffle size={15} strokeWidth={1.6} />
            </Button>
          </Tip>
          <Tip label="Previous">
            <Button variant="ghost" size="icon-sm" disabled={!loaded} onClick={() => void send({ kind: 'previous' })}>
              <SkipBack size={15} strokeWidth={1.6} fill="currentColor" />
            </Button>
          </Tip>
          <Button
            size="icon-lg"
            aria-label={playing ? 'Pause' : 'Play'}
            disabled={!loaded}
            onClick={() => void send({ kind: 'toggle' })}
            className="rounded-full bg-foreground text-background hover:bg-foreground/85 [&_svg:not([class*='size-'])]:size-5"
          >
            <PlayGlyph playing={playing} />
          </Button>
          <Tip label="Next">
            <Button variant="ghost" size="icon-sm" disabled={!loaded} onClick={() => void send({ kind: 'next' })}>
              <SkipForward size={15} strokeWidth={1.6} fill="currentColor" />
            </Button>
          </Tip>
          <Tip label={state?.repeat === 'NONE' ? 'Repeat all' : state?.repeat === 'ALL' ? 'Repeat one' : 'Repeat off'}>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!loaded}
              onClick={() => void send({ kind: 'repeat' })}
              className={cn(state?.repeat !== 'NONE' && state?.repeat && 'text-primary')}
            >
              <RepeatIcon size={15} strokeWidth={1.6} />
            </Button>
          </Tip>
        </div>
        <div className="flex w-full items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
          <span className="w-10 text-right">{clock(shown)}</span>
          <Slider
            value={[shown]}
            max={Math.max(duration, 1)}
            step={1}
            disabled={!loaded}
            onValueChange={([v]) => setSeeking(v)}
            onValueCommit={([v]) => {
              setSeeking(null);
              void send({ kind: 'seek', seconds: v });
            }}
            className="flex-1"
          />
          <span className="w-10">{clock(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1">
        {!focus && (
          <>
            <Tip label={lyricsOpen ? 'Hide lyrics' : 'Lyrics'}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggleLyrics}
                className={cn(lyricsOpen && 'text-primary')}
              >
                <MicVocal size={15} strokeWidth={1.6} />
              </Button>
            </Tip>
            <Tip label={queueOpen ? 'Hide queue' : 'Queue'}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggleQueue}
                className={cn(queueOpen && 'text-primary')}
              >
                <ListMusic size={15} strokeWidth={1.6} />
              </Button>
            </Tip>
          </>
        )}
        <Tip label={eqOn ? 'Equalizer, on' : 'Equalizer'}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => openSettings('equalizer')}
            className={cn(eqOn && 'text-primary')}
          >
            <SlidersHorizontal size={15} strokeWidth={1.6} />
          </Button>
        </Tip>
        <Tip label={state?.muted ? 'Unmute' : 'Mute'}>
          <Button variant="ghost" size="icon-sm" disabled={!loaded} onClick={() => void send({ kind: 'mute' })}>
            <VolumeIcon size={15} strokeWidth={1.6} />
          </Button>
        </Tip>
        <WakeSlider
          value={level}
          bars={18}
          height={22}
          restHeight={6}
          gap={2}
          reach={4}
          disabled={!loaded}
          ariaLabel="Volume"
          onChange={v => {
            setVolume(v);
            void send({ kind: 'volume', level: v });
          }}
          onCommit={() => setVolume(null)}
          onWheel={wheelVolume}
          className="w-28"
        />
        <Tip label={focus ? 'Leave focus mode' : 'Focus mode'}>
          <Button variant="ghost" size="icon-sm" onClick={onToggleFocus} className={cn(focus && 'text-primary')}>
            {focus ? <Minimize2 size={15} strokeWidth={1.6} /> : <Maximize2 size={15} strokeWidth={1.6} />}
          </Button>
        </Tip>
      </div>
    </div>
  );
}
