import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Languages, MicVocal, Music } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useMusicStore } from '@/stores/useMusicStore';
import type { LyricsTranslation, MusicLyricLine, MusicLyricWord } from '@/types';

import { GLASS } from '@/lib/glass';

const HOLD_MS = 3500;

export function useLivePosition(): number {
  const state = useMusicStore(s => s.state);
  const stateAt = useMusicStore(s => s.stateAt);
  const [now, setNow] = useState(() => performance.now());
  const playing = state?.state === 1;

  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const tick = () => {
      setNow(performance.now());
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);

  if (!state) return 0;
  const ahead = playing ? Math.max(0, (now - stateAt) / 1000) : 0;
  return state.position + Math.min(ahead, 1.5);
}

export function isBreak(text: string): boolean {
  return !text.trim() || /^[♪\s]+$/.test(text);
}

function syllables(word: string): number {
  const vowels = word.match(/[aeiouyàáâãäåèéêëìíîïòóôõöùúûüý]+/gi)?.length ?? 0;
  const kana = word.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0;
  return Math.max(1, vowels + kana);
}

function guessWords(line: MusicLyricLine): MusicLyricWord[] {
  const parts = line.text.match(/\S+\s*/g) ?? [];
  const weights = parts.map((p, i) => syllables(p) * (i > 0 && i === parts.length - 1 ? 2 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let at = line.start;
  return parts.map((text, i) => {
    const start = at;
    at += ((line.end - line.start) * weights[i]) / total;
    return { start, end: at, text };
  });
}

export function KaraokeText({ line, position }: { line: MusicLyricLine; position: number }) {
  const words = line.words ?? guessWords(line);
  return (
    <>
      {words.map((w, i) => {
        const word = w.text.trimEnd();
        const gap = w.text.slice(word.length);
        const p = Math.min(1, Math.max(0, (position - w.start) / Math.max(0.05, w.end - w.start)));
        if (p >= 1) return <span key={i}><span className="text-foreground">{word}</span>{gap}</span>;
        if (p <= 0) return <span key={i}>{w.text}</span>;
        const edge = `${(p * 100).toFixed(1)}%`;
        return (
          <span key={i}>
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(90deg, var(--foreground) ${edge}, color-mix(in oklab, var(--foreground) 32%, transparent) ${edge})`,
              }}
            >
              {word}
            </span>
            {gap}
          </span>
        );
      })}
    </>
  );
}

interface Extras {
  romanized: string[];
  translated: string[];
}

function ExtraLines({ romanized, translated, now }: { romanized?: string; translated?: string; now: boolean }) {
  return (
    <>
      {romanized && (
        <span className={cn('mt-0.5 block text-[0.62em] leading-snug font-semibold', now && 'text-foreground/85')}>
          {romanized}
        </span>
      )}
      {translated && (
        <span className={cn('mt-0.5 block text-[0.52em] leading-snug font-medium', now && 'text-foreground/70')}>
          {translated}
        </span>
      )}
    </>
  );
}

interface LineProps {
  line: MusicLyricLine;
  place: 'past' | 'now' | 'next';
  position: number;
  focus: boolean;
  romanized?: string;
  translated?: string;
  onSeek: (seconds: number) => void;
  ref?: React.Ref<HTMLButtonElement>;
}

const LyricLine = memo(function LyricLine({ line, place, position, focus, romanized, translated, onSeek, ref }: LineProps) {
  const brk = isBreak(line.text);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSeek(line.start)}
      className={cn(
        'block w-full rounded-md px-3 text-left font-bold tracking-tight transition-colors duration-150 hover:text-foreground/85 focus-visible:bg-accent/40 focus-visible:outline-none',
        focus ? 'py-2 text-[34px] leading-[1.2]' : 'py-1.5 text-[24px] leading-[1.25]',
        place === 'past' && 'text-foreground/45',
        place === 'next' && 'text-foreground/30',
        place === 'now' && 'text-foreground/32',
      )}
    >
      {brk ? (
        <span className={cn(place === 'now' && 'text-foreground')}>♪</span>
      ) : place === 'now' ? (
        <KaraokeText line={line} position={position} />
      ) : (
        line.text
      )}
      {!brk && <ExtraLines romanized={romanized} translated={translated} now={place === 'now'} />}
    </button>
  );
});

function SyncedLyrics({ lines, focus, extras }: { lines: MusicLyricLine[]; focus: boolean; extras: Extras | null }) {
  const send = useMusicStore(s => s.send);
  const videoId = useMusicStore(s => s.state?.videoId ?? '');
  const position = useLivePosition();
  const viewportRef = useRef<HTMLDivElement>(null);
  const heldAt = useRef(0);
  const placedFor = useRef('');
  const nowRef = useRef<HTMLButtonElement>(null);

  let current = -1;
  for (let i = 0; i < lines.length && lines[i].start <= position; i++) current = i;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const hold = () => {
      heldAt.current = performance.now();
    };
    viewport.addEventListener('wheel', hold, { passive: true });
    viewport.addEventListener('pointerdown', hold);
    return () => {
      viewport.removeEventListener('wheel', hold);
      viewport.removeEventListener('pointerdown', hold);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const el = nowRef.current;
    if (!viewport) return;
    const fresh = placedFor.current !== videoId;
    if (!fresh && performance.now() - heldAt.current < HOLD_MS) return;
    placedFor.current = videoId;
    if (!el) {
      if (fresh) viewport.scrollTo({ top: 0 });
      return;
    }
    const box = viewport.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const top = r.top - box.top + viewport.scrollTop - box.height / 2 + r.height / 2;
    viewport.scrollTo({ top, behavior: fresh ? 'auto' : 'smooth' });
  }, [current, videoId]);

  const seek = useCallback(
    (seconds: number) => {
      heldAt.current = 0;
      void send({ kind: 'seek', seconds });
    },
    [send],
  );

  return (
    <ScrollArea viewportRef={viewportRef} className="h-full min-h-0">
      <div className={cn('flex flex-col py-[30vh]', focus ? 'gap-1 px-6' : 'gap-0.5 px-4')}>
        {lines.map((l, i) => (
          <LyricLine
            key={i}
            line={l}
            place={i < current ? 'past' : i === current ? 'now' : 'next'}
            ref={i === current ? nowRef : undefined}
            position={i === current ? position : 0}
            focus={focus}
            romanized={extras?.romanized[i]}
            translated={extras?.translated[i]}
            onSeek={seek}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

interface LyricsProps {
  focus?: boolean;
  onLeave: () => void;
  leaveLabel: string;
}

function romanizedLabel(lang: string | undefined): string {
  if (lang === 'ja') return 'Romaji';
  if (lang?.startsWith('zh')) return 'Pinyin';
  return 'Romanized';
}

function translationSource(t: LyricsTranslation): string {
  if (t.source !== 'musixmatch') return 'Machine translated';
  if (!t.machineLines) return 'Musixmatch translation';
  return `Musixmatch translation, ${t.machineLines} ${t.machineLines === 1 ? 'line' : 'lines'} machine translated`;
}

export default function Lyrics({ focus = false, onLeave, leaveLabel }: LyricsProps) {
  const videoId = useMusicStore(s => s.state?.videoId ?? '');
  const ready = useMusicStore(s => !!s.state && (s.state.duration > 0 || s.state.position > 3));
  const lyrics = useMusicStore(s => s.lyrics[videoId]);
  const loaded = useMusicStore(s => videoId in s.lyrics);
  const loadLyrics = useMusicStore(s => s.loadLyrics);
  const shown = useMusicStore(s => s.lyricsExtras);
  const setShown = useMusicStore(s => s.setLyricsExtras);
  const translation = useMusicStore(s => s.translations[videoId]);
  const loadTranslation = useMusicStore(s => s.loadTranslation);

  useEffect(() => {
    if (videoId && ready) void loadLyrics(videoId);
  }, [videoId, ready, loadLyrics]);

  useEffect(() => {
    if (shown.length && lyrics) void loadTranslation(videoId);
  }, [shown.length, lyrics, videoId, loadTranslation]);

  if (!videoId || (loaded && !lyrics)) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {videoId ? <MicVocal size={15} strokeWidth={1.6} /> : <Music size={15} strokeWidth={1.6} />}
          </EmptyMedia>
          <EmptyTitle>{videoId ? 'No lyrics for this song' : 'Nothing playing'}</EmptyTitle>
          <EmptyDescription>
            {videoId
              ? 'Neither YouTube Music nor LRCLIB has them. For a video, the search goes by its title and channel, so a title that names the song finds more.'
              : 'Play a song and its lyrics show up here, following along as it plays.'}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" variant="outline" onClick={onLeave}>
            {leaveLabel}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (!lyrics) {
    return (
      <div className={cn('flex flex-col gap-4 py-16', focus ? 'px-9' : 'px-7')}>
        {[70, 55, 80, 45, 65].map((w, i) => (
          <Skeleton key={i} className={focus ? 'h-8' : 'h-6'} style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }

  const extras: Extras | null = translation
    ? {
        romanized: shown.includes('romanized') ? translation.romanized : [],
        translated: shown.includes('translated') ? translation.translated : [],
      }
    : null;
  const scriptLang = /[぀-ヿ]/.test(lyrics.text)
    ? 'ja'
    : /[가-힯]/.test(lyrics.text)
      ? 'ko'
      : /\p{Script=Han}/u.test(lyrics.text)
        ? 'zh'
        : '';
  const canRomanize =
    /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(lyrics.text) &&
    (!translation || translation.romanized.some(Boolean));
  const canTranslate = !translation || translation.translated.some(Boolean);
  const toggle = (extra: string) =>
    setShown(shown.includes(extra) ? shown.filter(e => e !== extra) : [...shown, extra]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        {lyrics.lines.length ? (
          <SyncedLyrics lines={lyrics.lines} focus={focus} extras={extras} />
        ) : (
          <ScrollArea className="h-full min-h-0">
            <div className={cn('py-10 font-bold whitespace-pre-line text-foreground/85', focus ? 'px-9 text-[28px] leading-[1.35]' : 'px-7 text-[20px] leading-[1.4]')}>
              {extras
                ? lyrics.text.split('\n').map((text, i) => (
                    <div key={i}>
                      {text || ' '}
                      <ExtraLines romanized={extras.romanized[i]} translated={extras.translated[i]} now={false} />
                    </div>
                  ))
                : lyrics.text}
            </div>
          </ScrollArea>
        )}
      </div>
      <div className="flex flex-none items-center gap-3 px-7 py-2 text-[11px] text-muted-foreground">
        <span className="min-w-0 flex-1 truncate">
          {!shown.length ? '' : translation === undefined ? 'Translating. ' : translation === null ? 'Translation failed, change the menu to try again. ' : ''}
          {translation && shown.includes('translated') && translation.translated.some(Boolean) ? `${translationSource(translation)}. ` : ''}
          {lyrics.lines.length ? '' : 'Not synced to the song. '}
          {lyrics.source ? `Lyrics from ${lyrics.source}` : ''}
        </span>
        {(canRomanize || canTranslate) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={shown.length ? 'secondary' : 'outline'} size="sm">
                <Languages size={15} strokeWidth={1.6} />
                Translate
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className={cn(GLASS, 'w-48 rounded-xl')}>
              {canRomanize && (
                <DropdownMenuCheckboxItem
                  checked={shown.includes('romanized')}
                  onSelect={e => e.preventDefault()}
                  onCheckedChange={() => toggle('romanized')}
                >
                  {romanizedLabel(translation?.lang ?? scriptLang)}
                </DropdownMenuCheckboxItem>
              )}
              {canTranslate && (
                <DropdownMenuCheckboxItem
                  checked={shown.includes('translated')}
                  onSelect={e => e.preventDefault()}
                  onCheckedChange={() => toggle('translated')}
                >
                  English
                </DropdownMenuCheckboxItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
