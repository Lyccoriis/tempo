import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, LayoutGrid, List, Search } from 'lucide-react';

import Counter, { placesFor } from '@/components/reactbits/Counter';
import { usePanelVisible } from '@/components/layout/panelVisible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { TableHead } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { GLASS } from '@/lib/glass';
import { cn } from '@/lib/utils';
import { useMusicStore, type CoverView, type MusicDataLayout } from '@/stores/useMusicStore';
import type { RepoEndReason, RepoSortDir } from '@/types';

import { Cover } from '../ui';

export const PAGE = 50;

export const ROW = 'cursor-pointer border-border/60 transition-colors duration-150 hover:bg-accent/60 focus-visible:bg-accent/60';

const DAY = 24 * 60 * 60 * 1000;

export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '';
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function fmtListened(ms: number | null | undefined): string {
  if (!ms) return '0m';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return `${Math.round(ms / 1000)}s`;
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  return `${h}h ${minutes % 60}m`;
}

export function fmtDate(ms: number | null | undefined): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtDateTime(ms: number | null | undefined): string {
  if (!ms) return '';
  return new Date(ms).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function fmtClock(ms: number, seconds = false): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: seconds ? '2-digit' : undefined, hour12: false });
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function fmtDay(ms: number): string {
  const today = startOfDay(Date.now());
  const day = startOfDay(ms);
  if (day === today) return 'Today';
  if (day === today - DAY) return 'Yesterday';
  const sameYear = new Date(ms).getFullYear() === new Date().getFullYear();
  return new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
}

export function fmtAgo(ms: number | null | undefined): string {
  if (!ms) return '';
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)}d ago`;
  return fmtDate(ms);
}

export function fmtPercent(x: number | null | undefined): string {
  return x == null ? '' : `${Math.round(x * 100)}%`;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

export function contextLabel(origin: string): string {
  if (!origin) return 'Queue';
  if (origin === 'plays.jsonl') return 'Imported history';
  if (origin === 'LM') return 'Liked songs';
  if (origin.startsWith('OLAK5uy_') || origin.startsWith('MPRE')) return 'Album';
  if (origin.startsWith('RDCLAK')) return 'Playlist';
  if (origin.startsWith('RD')) return 'Radio';
  if (origin.startsWith('PL') || origin.startsWith('VL')) return 'Playlist';
  return 'Unknown';
}

export function outcome(reason: RepoEndReason | null, endedAt: number | null): { label: string; tone: string; dot: string } {
  switch (reason) {
    case 'complete':
      return { label: 'Completed', tone: 'text-success', dot: 'bg-success' };
    case 'skip':
      return { label: 'Skipped', tone: 'text-warning', dot: 'bg-warning' };
    case 'stop':
      return { label: 'Stopped', tone: 'text-muted-foreground', dot: 'bg-muted-foreground' };
    case 'interrupted':
      return { label: 'Cut off', tone: 'text-muted-foreground', dot: 'bg-muted-foreground' };
    case 'legacy':
      return { label: 'Imported', tone: 'text-muted-foreground', dot: 'bg-muted-foreground' };
    default:
      return endedAt == null
        ? { label: 'Playing', tone: 'text-primary', dot: 'bg-primary' }
        : { label: 'Unfinished', tone: 'text-muted-foreground', dot: 'bg-muted-foreground' };
  }
}

export type Discovery = 'new' | 'unheard' | 'today';

export function discovery(row: { plays: number; firstHeardAt: number | null; knownAt: number }): Discovery | null {
  if (row.plays > 0) return row.firstHeardAt != null && row.firstHeardAt >= startOfDay(Date.now()) ? 'today' : null;
  return Date.now() - row.knownAt < 3 * DAY ? 'new' : 'unheard';
}

const DISCOVERY: Record<Discovery, { label: string; className: string }> = {
  new: { label: 'New', className: 'border-transparent bg-primary text-primary-foreground' },
  unheard: { label: 'Unheard', className: 'border-primary/40 bg-transparent text-primary' },
  today: { label: 'First heard today', className: 'border-transparent bg-secondary text-secondary-foreground' },
};

export function DiscoveryBadge({ state, className }: { state: Discovery | null; className?: string }) {
  if (!state) return null;
  return (
    <Badge variant="outline" className={cn('h-[18px] shrink-0 px-1.5 text-[10.5px] font-semibold tracking-[0.04em] uppercase', DISCOVERY[state].className, className)}>
      {DISCOVERY[state].label}
    </Badge>
  );
}

export function useRepo<T>(load: () => Promise<T>, deps: unknown[]): { data: T | null; loaded: boolean; error: string; reload: () => void } {
  const visible = usePanelVisible();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;
  const seq = useRef(0);

  const reload = useCallback(() => {
    const mine = ++seq.current;
    loadRef
      .current()
      .then(value => {
        if (mine !== seq.current) return;
        setData(value);
        setError('');
        setLoaded(true);
      })
      .catch(err => {
        if (mine !== seq.current) return;
        console.error('[music data] load failed', err);
        setError(err instanceof Error ? err.message : String(err));
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (visible) reload();
  }, [visible, reload, ...deps]);

  useEffect(() => {
    if (!visible) return;
    return window.api.musicRepo.onChanged(reload);
  }, [visible, reload]);

  return { data, loaded, error, reload };
}

export function useDebounced(text: string, onChange?: () => void): string {
  const [value, setValue] = useState('');
  const change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    const t = setTimeout(() => {
      setValue(text.trim());
      change.current?.();
    }, 250);
    return () => clearTimeout(t);
  }, [text]);
  return value;
}

interface TileProps {
  label: string;
  value?: number;
  decimals?: number;
  suffix?: string;
  text?: string;
  sub?: ReactNode;
  className?: string;
}

export function Tile({ label, value, decimals = 0, suffix, text, sub, className }: TileProps) {
  return (
    <div className={cn(GLASS, 'flex min-w-0 flex-col gap-1 rounded-xl px-4 py-3', className)}>
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1 text-[20px] leading-tight font-semibold tabular-nums">
        {value !== undefined ? (
          <>
            <Counter value={value} fontSize={20} places={placesFor(value, decimals)} />
            {suffix && <span className="text-[13px] font-medium text-muted-foreground">{suffix}</span>}
          </>
        ) : (
          <span className="truncate">{text || 'None yet'}</span>
        )}
      </span>
      {sub && <span className="truncate text-[11.5px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

interface HeroStatProps {
  label: string;
  value?: number;
  decimals?: number;
  suffix?: string;
  text?: string;
}

export function HeroStat({ label, value, decimals = 0, suffix, text }: HeroStatProps) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] font-medium tracking-[0.06em] text-white/60 uppercase">{label}</div>
      <div className="flex items-baseline gap-1 text-[16px] leading-tight font-semibold tabular-nums">
        {value !== undefined ? (
          <>
            <Counter value={value} fontSize={16} places={placesFor(value, decimals)} />
            {suffix && <span className="text-[12px] font-medium text-white/60">{suffix}</span>}
          </>
        ) : (
          <span className={cn('truncate', !text && 'text-white/50')}>{text || 'Not yet'}</span>
        )}
      </div>
    </div>
  );
}

interface HeroProps {
  artwork: string;
  round?: boolean;
  expand?: Omit<CoverView, 'src'>;
  kind: string;
  badge?: ReactNode;
  title: string;
  byline?: ReactNode;
  action?: ReactNode;
  stats?: ReactNode;
  art?: ReactNode;
  children?: ReactNode;
}

export const HERO_LINK = 'max-w-full truncate text-left text-white/85 transition-colors duration-150 hover:text-white hover:underline focus-visible:underline';

export function Hero({ artwork, round, expand, kind, badge, title, byline, action, stats, art, children }: HeroProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [artwork]);

  return (
    <section className="mx-2.5 grid overflow-hidden rounded-xl border border-border bg-muted">
      {artwork && !failed && (
        <img
          src={artwork}
          alt=""
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailed(true)}
          className="size-full scale-110 object-cover blur-xl [grid-area:1/1]"
        />
      )}
      <div className="relative bg-gradient-to-t from-black/90 via-black/70 to-black/45 [grid-area:1/1]" />
      <div className="relative flex min-w-0 flex-col gap-5 p-6 text-white [grid-area:1/1]">
        <div className="flex min-w-0 flex-wrap items-end gap-5">
          {art ?? <Cover src={artwork} round={round} expand={expand} depth="full" className={cn('size-36', round ? '' : 'rounded-lg')} />}
          <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium tracking-[0.06em] text-white/70 uppercase">{kind}</span>
              {badge}
            </div>
            <h1 className="line-clamp-2 text-[30px] leading-tight font-bold break-words">{title}</h1>
            {byline && <div className="flex min-w-0 flex-wrap items-center gap-x-1 text-[13px] text-white/75">{byline}</div>}
          </div>
          {action}
        </div>
        {stats && <div className="grid grid-cols-[repeat(auto-fit,minmax(104px,1fr))] gap-x-4 gap-y-3 border-t border-white/15 pt-4">{stats}</div>}
        {children}
      </div>
    </section>
  );
}

interface SortHeadProps<S extends string> {
  id: S;
  sort: S;
  dir: RepoSortDir;
  onSort: (id: S, dir: RepoSortDir) => void;
  right?: boolean;
  className?: string;
  children: ReactNode;
}

export function firstDir(id: string): RepoSortDir {
  return id === 'title' || id === 'name' || id === 'artist' || id === 'album' ? 'asc' : 'desc';
}

export function SortHead<S extends string>({ id, sort, dir, onSort, right, className, children }: SortHeadProps<S>) {
  const on = sort === id;
  return (
    <TableHead className={cn(right && 'text-right', className)}>
      <button
        type="button"
        onClick={() => onSort(id, on ? (dir === 'asc' ? 'desc' : 'asc') : firstDir(id))}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm text-[11.5px] font-medium transition-colors duration-150 hover:text-foreground focus-visible:text-foreground',
          on ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {children}
        {on && (dir === 'asc' ? <ArrowUp size={12} strokeWidth={1.6} /> : <ArrowDown size={12} strokeWidth={1.6} />)}
      </button>
    </TableHead>
  );
}

export function Pager({ offset, limit, total, onPage }: { offset: number; limit: number; total: number; onPage: (offset: number) => void }) {
  if (total <= limit && offset === 0) return null;
  const end = Math.min(total, offset + limit);
  return (
    <div className="flex items-center justify-end gap-2 px-2 pt-2 text-[12px] text-muted-foreground tabular-nums">
      <span>
        {total ? offset + 1 : 0} to {end} of {total.toLocaleString('en-US')}
      </span>
      <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={offset === 0} onClick={() => onPage(Math.max(0, offset - limit))}>
        <ChevronLeft size={15} strokeWidth={1.6} />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={end >= total} onClick={() => onPage(offset + limit)}>
        <ChevronRight size={15} strokeWidth={1.6} />
      </Button>
    </div>
  );
}

export function Section({ title, sub, action, children, className }: { title: string; sub?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-2', className)}>
      <div className="flex min-h-8 items-end gap-2 px-2.5">
        <div className="min-w-0">
          <h2 className="text-[18px] leading-tight font-semibold">{title}</h2>
          {sub && <p className="text-[12px] text-muted-foreground">{sub}</p>}
        </div>
        {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function SeeAll({ onClick, children = 'See all' }: { onClick: () => void; children?: ReactNode }) {
  return (
    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onClick}>
      {children} <ChevronRight size={15} strokeWidth={1.6} />
    </Button>
  );
}

export function Facts({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <div className="flex flex-col px-2.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline py-1 text-[13px]">
          <span className="shrink-0 text-muted-foreground">{label}</span>
          <span className="mx-2.5 min-w-4 flex-1 -translate-y-1 border-b border-dashed border-border" />
          <span className="min-w-0 truncate text-right tabular-nums">{value || <span className="text-muted-foreground">Unknown</span>}</span>
        </div>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <InputGroup className="max-w-72 min-w-44 flex-1 bg-card/50">
      <InputGroupAddon>
        <Search size={15} strokeWidth={1.6} />
      </InputGroupAddon>
      <InputGroupInput value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </InputGroup>
  );
}

export function LayoutToggle({ tab }: { tab: 'tracks' | 'artists' | 'albums' }) {
  const layout = useMusicStore(s => s.dataLayout[tab]);
  const setLayout = useMusicStore(s => s.setDataLayout);
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={layout}
      onValueChange={value => value && setLayout(tab, value as MusicDataLayout)}
      className="ml-auto"
    >
      <ToggleGroupItem value="gallery" aria-label="Gallery">
        <LayoutGrid size={15} strokeWidth={1.6} />
      </ToggleGroupItem>
      <ToggleGroupItem value="table" aria-label="Table">
        <List size={15} strokeWidth={1.6} />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export function HeardBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-1 overflow-hidden rounded-full bg-muted', className)}>
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}
