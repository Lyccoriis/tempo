import { useEffect, useState } from 'react';
import { ExternalLink, Music } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GLASS } from '@/lib/glass';
import { cn } from '@/lib/utils';
import { useMusicStore } from '@/stores/useMusicStore';
import type { MusicAbout } from '@/types';

import Shelf from '../Shelf';
import AlbumsTable from './AlbumsTable';
import Timeline from './Timeline';
import { Disclosure, ExternalIds, HeroSkeleton, NotFound, RawRecord } from './TrackDetail';
import TracksTable from './TracksTable';
import { fmtAgo, fmtDate, fmtListened, fmtPercent, Hero, HeroStat, plural, Section, useRepo } from './parts';
import { RankedSongs, SHELF, SongTile } from './tiles';

function About({ name }: { name: string }) {
  const [about, setAbout] = useState<MusicAbout | null | undefined>(undefined);
  const [more, setMore] = useState(false);

  useEffect(() => {
    let live = true;
    setAbout(undefined);
    window.api.ytmusic
      .about('artist', name, '')
      .then(found => live && setAbout(found))
      .catch(err => {
        console.error('[music data] about failed', err);
        if (live) setAbout(null);
      });
    return () => {
      live = false;
    };
  }, [name]);

  if (about === undefined) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-full bg-white/15" />
        <Skeleton className="h-3.5 w-4/5 bg-white/15" />
      </div>
    );
  }
  if (!about) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-white/15 pt-4">
      {about.description && <div className="text-[11px] font-medium tracking-[0.06em] text-white/60 uppercase">{about.description}</div>}
      <p className={cn('max-w-[70ch] text-[13.5px] leading-relaxed text-white/85', !more && 'line-clamp-3')}>{about.text}</p>
      <div className="flex flex-wrap items-center gap-2">
        {about.text.length > 240 && (
          <Button variant="ghost" size="xs" className="-ml-2 text-white/70 hover:bg-white/10 hover:text-white" onClick={() => setMore(m => !m)}>
            {more ? 'Show less' : 'Read more'}
          </Button>
        )}
        {about.url && (
          <Button variant="outline" size="xs" className="ml-auto" onClick={() => window.api.shell.openExternal(about.url)}>
            <ExternalLink size={15} strokeWidth={1.6} /> Wikipedia
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ArtistDetail({ id }: { id: number }) {
  const go = useMusicStore(s => s.go);
  const { data: artist, loaded, error } = useRepo(() => window.api.musicRepo.artist(id), [id]);
  const { data: top } = useRepo(() => window.api.musicRepo.tracks({ artistId: id, heard: 'heard', sort: 'plays', dir: 'desc', limit: 5 }), [id]);
  const { data: unheard } = useRepo(() => window.api.musicRepo.tracks({ artistId: id, heard: 'unheard', sort: 'known', dir: 'desc', limit: 12 }), [id]);

  if (!loaded) return <HeroSkeleton />;
  if (!artist) return <NotFound what="Artist" error={error} />;

  const channel = artist.externalIds.find(x => x.provider === 'youtube_music' && x.externalId.startsWith('UC'))?.externalId;

  return (
    <div className="flex flex-col gap-7">
      <Hero
        artwork={artist.artwork}
        round
        expand={{ kind: 'artist', title: artist.name, artist: '' }}
        kind="Artist"
        title={artist.name}
        byline={
          <span>
            {plural(artist.tracks, 'song')} known, {artist.heard} heard{artist.albums > 0 && `, ${plural(artist.albums, 'album')}`}
          </span>
        }
        action={
          channel && (
            <Button variant="outline" size="sm" onClick={() => go({ kind: 'page', browseId: channel, title: artist.name })}>
              <Music size={15} strokeWidth={1.6} /> Artist page
            </Button>
          )
        }
        stats={
          <>
            <HeroStat label="Plays" value={artist.plays} />
            <HeroStat label="Listened" text={artist.listenedMs ? fmtListened(artist.listenedMs) : ''} />
            <HeroStat label="Skips" value={artist.skips} />
            <HeroStat label="Avg heard" text={fmtPercent(artist.avgCompletion)} />
            <HeroStat label="First heard" text={fmtDate(artist.firstHeardAt)} />
            <HeroStat label="Last heard" text={fmtAgo(artist.lastHeardAt)} />
          </>
        }
      >
        <About name={artist.name} />
      </Hero>

      {!!top?.rows.length && (
        <Section title="Most played">
          <div className={cn(GLASS, 'mx-2.5 rounded-xl p-2')}>
            <RankedSongs rows={top.rows} showArtist={false} />
          </div>
        </Section>
      )}

      {artist.albums > 0 && (
        <Section title="Albums">
          <AlbumsTable artistId={artist.id} />
        </Section>
      )}

      {!!unheard?.total && (
        <Section title="Waiting to be heard" sub={`${plural(unheard.total, 'song')} by ${artist.name} known but not heard yet`}>
          <Shelf className={SHELF}>
            {unheard.rows.map(row => (
              <SongTile key={row.id} row={row} showUnheard={false} />
            ))}
          </Shelf>
        </Section>
      )}

      <Section title="Recent listening">
        <Timeline artistId={artist.id} pageSize={8} />
      </Section>

      <div className="flex flex-col gap-1">
        <Disclosure title={`All songs (${artist.tracks})`}>
          <TracksTable artistId={artist.id} bare />
        </Disclosure>
        <Disclosure title="Sources and ids">
          <ExternalIds ids={artist.externalIds} />
        </Disclosure>
        <Disclosure title="Advanced">
          <RawRecord value={artist} />
        </Disclosure>
      </div>
    </div>
  );
}
