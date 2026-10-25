import { Fragment, useState } from 'react';
import { ChevronRight, History } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { useMusicStore } from '@/stores/useMusicStore';
import type { RepoEventRow, RepoEventType, RepoPlayOutcome, RepoPlayRow } from '@/types';

import { Cover } from '../ui';
import {
  contextLabel,
  Facts,
  fmtClock,
  fmtDateTime,
  fmtDay,
  fmtDuration,
  fmtListened,
  fmtPercent,
  outcome,
  Pager,
  plural,
  SearchBox,
  useDebounced,
  useRepo,
} from './parts';

const TYPE_LABEL: Record<RepoEventType, string> = {
  start: 'Start',
  pause: 'Pause',
  resume: 'Resume',
  seek: 'Seek',
  complete: 'Complete',
  skip: 'Skip',
  stop: 'Stop',
  interrupted: 'Cut off',
  legacy: 'Imported',
};

const ENDS = new Set<RepoEventType>(['complete', 'skip', 'stop', 'interrupted', 'legacy']);

function dayStart(value: string): number | undefined {
  if (!value) return undefined;
  const t = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(t) ? t : undefined;
}

function seekNote(detail: string): string {
  try {
    const d = JSON.parse(detail) as { fromMs?: number };
    return d.fromMs != null ? `from ${fmtDuration(d.fromMs)}` : '';
  } catch {
    return '';
  }
}

function EventBadge({ type }: { type: RepoEventType }) {
  return (
    <Badge
      variant={ENDS.has(type) ? 'secondary' : 'outline'}
      className={cn('h-5 px-1.5 font-mono text-[10.5px] uppercase', type === 'complete' && 'text-success', type === 'skip' && 'text-warning')}
    >
      {TYPE_LABEL[type]}
    </Badge>
  );
}

function eventNote(e: RepoEventRow): string {
  const at = e.positionMs != null ? `at ${fmtDuration(e.positionMs)}` : '';
  if (e.type === 'seek') return [seekNote(e.detail), at && `to ${fmtDuration(e.positionMs)}`].filter(Boolean).join(' ');
  if (ENDS.has(e.type) && e.listenedMs != null) return [at, `${fmtDuration(e.listenedMs)} listened`, fmtPercent(e.completion)].filter(Boolean).join(' · ');
  return at;
}

function PlayEvents({ play }: { play: RepoPlayRow }) {
  const { data } = useRepo(() => window.api.musicRepo.events({ playId: play.id, limit: 200 }), [play.id, play.events]);
  const events = data ? [...data.rows].reverse() : null;

  return (
    <div className="flex flex-col gap-2 pt-1 pb-3">
      {!events ? (
        <Skeleton className="h-16" />
      ) : (
        <div className="flex flex-col">
          {events.map(e => (
            <div key={e.id} className="grid grid-cols-[64px_84px_minmax(0,1fr)] items-center gap-2 py-0.5 text-[12px]">
              <span className="font-mono text-[11.5px] text-muted-foreground tabular-nums">{fmtClock(e.at, true)}</span>
              <span>
                <EventBadge type={e.type} />
              </span>
              <span className="truncate text-muted-foreground tabular-nums">{eventNote(e)}</span>
            </div>
          ))}
        </div>
      )}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="xs" className="group -ml-1.5 text-muted-foreground">
            <ChevronRight size={15} strokeWidth={1.6} className="transition-transform duration-150 group-data-[state=open]:rotate-90" /> Event details
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="-mx-2.5 pt-1">
            <Facts
              rows={[
                ['Play', <span className="font-mono text-[11.5px]">#{play.id}</span>],
                ['Started', fmtDateTime(play.startedAt)],
                ['Ended', fmtDateTime(play.endedAt) || 'Still open'],
                ['Length', fmtDuration(play.durationMs)],
                ['Counted as heard', play.qualified ? 'Yes' : 'No'],
                ['Context', <span className="font-mono text-[11.5px]">{play.origin || 'none'}</span>],
                ['Events', String(play.events)],
              ]}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function PlayRow({ play, showTrack, first, last }: { play: RepoPlayRow; showTrack: boolean; first: boolean; last: boolean }) {
  const go = useMusicStore(s => s.go);
  const [open, setOpen] = useState(false);
  const o = outcome(play.endReason, play.endedAt);
  const line = (
    <div className="text-[11.5px] text-muted-foreground tabular-nums">
      <span className={o.tone}>{o.label}</span>
      {play.listenedMs > 0 && <> · {fmtDuration(play.listenedMs)} listened</>}
      {play.completion != null && <> · {fmtPercent(play.completion)}</>}
      <> · {contextLabel(play.origin)}</>
    </div>
  );
  const body = showTrack ? (
    <>
      <Cover src={play.artwork} className="size-9" />
      <div className="min-w-0">
        <div className="truncate text-[13px]">{play.title}</div>
        <div className="truncate text-[11.5px] text-muted-foreground">{play.artist}</div>
        {line}
      </div>
    </>
  ) : (
    line
  );
  const main = 'flex min-w-0 items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-accent/60 focus-visible:bg-accent/60';

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="grid grid-cols-[40px_12px_minmax(0,1fr)_auto] gap-x-2.5">
      <span className="self-center text-right font-mono text-[12px] text-muted-foreground tabular-nums">{fmtClock(play.startedAt)}</span>
      <div className="flex flex-col items-center">
        <span className={cn('w-px flex-1', !first && 'bg-border')} />
        <span className={cn('size-2 shrink-0 rounded-full', o.dot)} />
        <span className={cn('w-px flex-1', (!last || open) && 'bg-border')} />
      </div>
      {showTrack ? (
        <button type="button" onClick={() => go({ kind: 'dataTrack', id: play.trackId, title: play.title })} className={main}>
          {body}
        </button>
      ) : (
        <CollapsibleTrigger className={main}>{body}</CollapsibleTrigger>
      )}
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={open ? 'Hide events' : 'Show events'} className="group self-center text-muted-foreground">
          <ChevronRight size={15} strokeWidth={1.6} className="transition-transform duration-150 group-data-[state=open]:rotate-90" />
        </Button>
      </CollapsibleTrigger>
      {open && <span className={cn('col-start-2 mx-auto w-px', !last && 'bg-border')} />}
      <CollapsibleContent className="col-span-2 col-start-3 px-2">
        <PlayEvents play={play} />
      </CollapsibleContent>
    </Collapsible>
  );
}

interface TimelineProps {
  trackId?: number;
  artistId?: number;
  filters?: boolean;
  pageSize?: number;
}

export default function Timeline({ trackId, artistId, filters, pageSize = 50 }: TimelineProps) {
  const go = useMusicStore(s => s.go);
  const [text, setText] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState<RepoPlayOutcome>('all');
  const [all, setAll] = useState(false);
  const [offset, setOffset] = useState(0);
  const search = useDebounced(text, () => setOffset(0));

  const fromMs = dayStart(from);
  const toStart = dayStart(to);
  const toMs = toStart != null ? toStart + 24 * 60 * 60 * 1000 : undefined;

  const { data } = useRepo(
    () => window.api.musicRepo.plays({ search, trackId, artistId, from: fromMs, to: toMs, outcome: result, counted: !all, offset, limit: pageSize }),
    [search, trackId, artistId, fromMs, toMs, result, all, offset, pageSize],
  );

  const filtered = !!(search || from || to || result !== 'all');
  const days: Array<{ key: string; label: string; plays: RepoPlayRow[] }> = [];
  for (const play of data?.rows ?? []) {
    const label = fmtDay(play.startedAt);
    const day = days[days.length - 1];
    if (day?.label === label) day.plays.push(play);
    else days.push({ key: `${label}-${play.id}`, label, plays: [play] });
  }

  return (
    <div className="flex flex-col gap-3">
      {filters && (
        <div className="flex flex-wrap items-end gap-3 px-2.5">
          {artistId == null && trackId == null && <SearchBox value={text} onChange={setText} placeholder="Song or artist" />}
          <Field className="w-36">
            <FieldLabel htmlFor="history-from" className="text-[12px] text-muted-foreground">
              From
            </FieldLabel>
            <Input
              id="history-from"
              type="date"
              value={from}
              onChange={e => {
                setFrom(e.target.value);
                setOffset(0);
              }}
              className="h-8 bg-card/50"
            />
          </Field>
          <Field className="w-36">
            <FieldLabel htmlFor="history-to" className="text-[12px] text-muted-foreground">
              To
            </FieldLabel>
            <Input
              id="history-to"
              type="date"
              value={to}
              onChange={e => {
                setTo(e.target.value);
                setOffset(0);
              }}
              className="h-8 bg-card/50"
            />
          </Field>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={result}
            onValueChange={value => {
              if (!value) return;
              setResult(value as RepoPlayOutcome);
              setOffset(0);
            }}
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="complete">Completed</ToggleGroupItem>
            <ToggleGroupItem value="skip">Skipped</ToggleGroupItem>
            <ToggleGroupItem value="other">Other</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex h-8 items-center gap-2">
            <Switch
              id="history-all"
              checked={all}
              onCheckedChange={checked => {
                setAll(checked);
                setOffset(0);
              }}
            />
            <Label htmlFor="history-all" className="text-[12.5px] font-normal text-muted-foreground">
              Short plays too
            </Label>
          </div>
        </div>
      )}

      {!data ? (
        <div className="flex flex-col gap-2 px-2.5">
          {Array.from({ length: Math.min(pageSize, 6) }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : data.total === 0 ? (
        <Empty className={filters ? undefined : 'py-6'}>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <History size={15} strokeWidth={1.6} />
            </EmptyMedia>
            <EmptyTitle>{filtered ? 'No plays match' : 'No listening recorded yet'}</EmptyTitle>
            <EmptyDescription>
              {filtered
                ? 'Widen the dates or show every result.'
                : all
                  ? 'Every time a song plays it lands here, with how far it got.'
                  : 'A play counts after 30 seconds, or half the song when it is short. Shorter ones show with Short plays too.'}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {filtered ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setText('');
                  setFrom('');
                  setTo('');
                  setResult('all');
                }}
              >
                Clear filters
              </Button>
            ) : !all ? (
              <Button size="sm" variant="outline" onClick={() => setAll(true)}>
                Show short plays
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => go({ kind: 'home' })}>
                Go to Home
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="flex flex-col gap-1 px-1">
            {days.map(day => (
              <Fragment key={day.key}>
                <div className="flex items-baseline gap-2 px-1.5 pt-2 pb-1">
                  <h3 className="text-[13.5px] font-semibold">{day.label}</h3>
                  <span className="text-[11.5px] text-muted-foreground tabular-nums">
                    {plural(day.plays.length, 'play')} · {fmtListened(day.plays.reduce((n, p) => n + p.listenedMs, 0))}
                  </span>
                </div>
                <div className="flex flex-col">
                  {day.plays.map((play, i) => (
                    <PlayRow key={play.id} play={play} showTrack={trackId == null} first={i === 0} last={i === day.plays.length - 1} />
                  ))}
                </div>
              </Fragment>
            ))}
          </div>
          <Pager offset={data.offset} limit={data.limit} total={data.total} onPage={setOffset} />
        </>
      )}
    </div>
  );
}
