import { useEffect, useRef } from 'react';
import { MicVocal } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isBreak, KaraokeText, useLivePosition } from '@/panels/Music/Lyrics';
import { useMusicStore } from '@/stores/useMusicStore';
import { useProfileStore } from '@/stores/useProfileStore';

const EASE = { duration: 0.5, ease: 'easeInOut' } as const;

const SEEK_BACK = 1;

function KaraokeLine() {
  const videoId = useMusicStore(s => s.state?.videoId ?? '');
  const ready = useMusicStore(s => !!s.state && (s.state.duration > 0 || s.state.position > 3));
  const lyrics = useMusicStore(s => s.lyrics[videoId]);
  const loaded = useMusicStore(s => videoId in s.lyrics);
  const loadLyrics = useMusicStore(s => s.loadLyrics);
  const position = useLivePosition();
  const shown = useRef({ videoId: '', index: -1 });

  useEffect(() => {
    if (videoId && ready) void loadLyrics(videoId);
  }, [videoId, ready, loadLyrics]);

  if (!videoId || !loaded) return null;
  const lines = lyrics?.lines ?? [];
  if (!lines.length) {
    return (
      <p className="text-[12px] text-muted-foreground">
        {lyrics ? 'These lyrics are not synced to the song' : 'No lyrics for this song'}
      </p>
    );
  }

  let current = -1;
  for (let i = 0; i < lines.length && lines[i].start <= position; i++) current = i;
  const last = shown.current;
  if (last.videoId === videoId && current < last.index && lines[last.index] && lines[last.index].start - position < SEEK_BACK) {
    current = last.index;
  }
  shown.current = { videoId, index: current };
  const line = lines[current];
  const nextAt = lines.findIndex((l, i) => i > current && !isBreak(l.text));

  return (
    <div className="grid w-[min(60rem,80vw)] text-center">
      <AnimatePresence initial={false}>
        <motion.p
          key={`${videoId}:${current}`}
          className="w-full self-end text-[32px] leading-tight font-bold tracking-tight text-foreground/32 [grid-area:1/1]"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={EASE}
        >
          {!line || isBreak(line.text) ? <span className="text-foreground">♪</span> : <KaraokeText line={line} position={position} />}
        </motion.p>
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {nextAt >= 0 && (
          <motion.p
            key={`${videoId}:${nextAt}`}
            className="mt-1 w-full truncate text-[16px] font-semibold text-foreground/45 [grid-area:2/1]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={EASE}
          >
            {lines[nextAt].text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function BackdropKaraoke() {
  const on = useProfileStore(s => !!s.activeConfig?.backdropKaraoke);
  const updateConfig = useProfileStore(s => s.updateConfig);
  const label = on ? 'Hide the karaoke line' : 'Show the karaoke line';

  return (
    <div className="pointer-events-none grid min-h-0 grid-cols-[1fr_auto_1fr] items-end gap-3 px-5 pb-6 [grid-area:1/1]">
      <div className="col-start-2 flex justify-center">
        <AnimatePresence>
          {on && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={EASE}>
              <KaraokeLine />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => void updateConfig({ backdropKaraoke: !on })}
            aria-pressed={on}
            aria-label={label}
            className={cn(
              'pointer-events-auto flex size-7 items-center justify-center justify-self-end rounded-md transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none',
              on ? 'opacity-80' : 'opacity-50',
            )}
          >
            <MicVocal size={15} strokeWidth={1.6} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </div>
  );
}
