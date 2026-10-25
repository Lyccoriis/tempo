import { useCallback, useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartNoAxesColumn } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePanelVisible } from '@/components/layout/panelVisible';
import { cn } from '@/lib/utils';
import { useMusicStore } from '@/stores/useMusicStore';
import type { MusicStats, MusicStatsRange } from '@/types';

import { ArtistMenu, openArtist, TrackMenu } from './menus';
import { GLASS } from '@/lib/glass';
import { Cover } from './ui';

const RANGES: Array<{ id: MusicStatsRange; label: string }> = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All time' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const config = { minutes: { label: 'Minutes', color: 'var(--chart-1)' } } satisfies ChartConfig;

function hours(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return `${h < 10 ? h.toFixed(1) : Math.round(h)} h`;
}

function ago(ms: number): string {
  const s = (Date.now() - ms) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={cn(GLASS, 'flex flex-col gap-1 rounded-xl px-4 py-3')}>
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
      <span className="text-[20px] leading-tight font-semibold tabular-nums">{value}</span>
      {sub && <span className="text-[11.5px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

export default function StatsView() {
  const visible = usePanelVisible();
  const send = useMusicStore(s => s.send);
  const range = useMusicStore(s => s.statsRange);
  const setRange = useMusicStore(s => s.setStatsRange);
  const [stats, setStats] = useState<MusicStats | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStats(await window.api.ytmusic.stats(range));
    } catch (err) {
      console.error('[music] stats failed', err);
    }
  }, [range]);

  useEffect(() => {
    if (visible) void refresh();
  }, [visible, refresh]);

  useEffect(() => window.api.ytmusic.onPlayed(() => void refresh()), [refresh]);

  const header = (
    <div className="flex items-center gap-4 px-2.5">
      <h1 className="text-[28px] font-bold">Listening stats</h1>
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={range}
        onValueChange={value => value && setRange(value as MusicStatsRange)}
      >
        {RANGES.map(r => (
          <ToggleGroupItem key={r.id} value={r.id}>
            {r.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );

  if (!stats) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div className="grid grid-cols-5 gap-3 px-2.5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="mx-2.5 h-64" />
      </div>
    );
  }

  if (stats.plays === 0) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ChartNoAxesColumn size={15} strokeWidth={1.6} />
            </EmptyMedia>
            <EmptyTitle>Nothing listened to yet</EmptyTitle>
            <EmptyDescription>
              A song counts after 30 seconds of listening, or half of it when it is short. Play something and it shows up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const hourData = stats.hours.map((minutes, h) => ({ label: `${h}h`, minutes }));
  const dayData = stats.weekdays.map((minutes, d) => ({ label: DAYS[d], minutes }));
  const topPlays = Math.max(1, ...stats.topTracks.map(t => t.plays));
  const glassCard = cn(GLASS, 'gap-3 py-4');

  return (
    <div className="flex flex-col gap-4">
      {header}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 px-2.5">
        <Tile label="Listened" value={hours(stats.minutes)} sub={`${stats.minutes.toLocaleString('en-US')} minutes`} />
        <Tile label="Plays" value={stats.plays.toLocaleString('en-US')} />
        <Tile label="Songs" value={stats.tracks.toLocaleString('en-US')} />
        <Tile label="Artists" value={stats.artists.toLocaleString('en-US')} />
        <Tile
          label="Streak"
          value={`${stats.streak} ${stats.streak === 1 ? 'day' : 'days'}`}
          sub={`Longest ${stats.longestStreak}`}
        />
      </div>

      <Card className={cn(glassCard, 'mx-2.5')}>
        <CardHeader>
          <CardTitle>Minutes listened</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={config} className="h-56 w-full">
            <AreaChart accessibilityLayer data={stats.series} margin={{ left: 4, right: 4, top: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
              <YAxis width={36} tickLine={false} axisLine={false} tickMargin={4} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
              <Area dataKey="minutes" type="monotone" stroke="var(--color-minutes)" fill="var(--color-minutes)" fillOpacity={0.3} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4 px-2.5">
        <Card className={glassCard}>
          <CardHeader>
            <CardTitle>Top songs</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {stats.topTracks.map((track, i) => (
              <TrackMenu key={track.videoId} track={track}>
                <button
                  type="button"
                  onClick={() => void send({ kind: 'playVideo', videoId: track.videoId })}
                  className="grid grid-cols-[20px_40px_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-accent/60 focus-visible:bg-accent/60"
                >
                  <span className="text-[12.5px] text-muted-foreground tabular-nums">{i + 1}</span>
                  <Cover src={track.artwork} className="size-10" />
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px]">{track.title}</div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(track.plays / topPlays) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-right text-[12px] text-muted-foreground tabular-nums">
                    {track.plays} {track.plays === 1 ? 'play' : 'plays'}
                    <br />
                    {hours(track.minutes)}
                  </span>
                </button>
              </TrackMenu>
            ))}
          </CardContent>
        </Card>

        <Card className={glassCard}>
          <CardHeader>
            <CardTitle>Top artists</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
            {stats.topArtists.map((artist, i) => (
              <ArtistMenu key={artist.name} name={artist.name}>
                <button
                  type="button"
                  onClick={() => openArtist(artist.name)}
                  className="flex min-w-0 flex-col items-center gap-1.5 rounded-md p-1 text-center transition-colors duration-150 hover:bg-accent/60 focus-visible:bg-accent/60"
                >
                  <Cover
                    src={artist.artwork}
                    round
                    expand={{ kind: 'artist', title: artist.name, artist: '' }}
                    className="aspect-square w-full" />
                  <div className="w-full truncate text-[13px] font-medium">
                    {i + 1}. {artist.name}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">{hours(artist.minutes)}</div>
                </button>
              </ArtistMenu>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 px-2.5">
        <Card className={glassCard}>
          <CardHeader>
            <CardTitle>Time of day</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={config} className="h-40 w-full">
              <BarChart accessibilityLayer data={hourData} margin={{ left: 4, right: 4, top: 4 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} interval={2} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
                <Bar dataKey="minutes" fill="var(--color-minutes)" radius={3} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className={glassCard}>
          <CardHeader>
            <CardTitle>Day of week</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={config} className="h-40 w-full">
              <BarChart accessibilityLayer data={dayData} margin={{ left: 4, right: 4, top: 4 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
                <Bar dataKey="minutes" fill="var(--color-minutes)" radius={3} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card className={cn(glassCard, 'mx-2.5')}>
        <CardHeader>
          <CardTitle>Recently played</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {stats.recent.map(play => (
            <TrackMenu key={`${play.videoId}-${play.at}`} track={{ videoId: play.videoId, title: play.title, artist: play.artist }}>
              <button
                type="button"
                onClick={() => void send({ kind: 'playVideo', videoId: play.videoId })}
                className="flex min-w-0 items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-accent/60 focus-visible:bg-accent/60"
              >
                <Cover src={play.artwork} className="size-9" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{play.title}</div>
                  <div className="truncate text-[11.5px] text-muted-foreground">{play.artist}</div>
                </div>
                <span className="text-[11.5px] text-muted-foreground">{ago(play.at)}</span>
              </button>
            </TrackMenu>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
