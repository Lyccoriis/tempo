import { useState, type ReactNode } from 'react';
import { Disc3, ExternalLink, Link, MicVocal, Play, Radio, SquareArrowOutUpRight } from 'lucide-react';
import { toast } from 'sonner';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { useMusicStore } from '@/stores/useMusicStore';
import type { MusicCard, MusicTrack } from '@/types';

import { openCard, playCard } from './CardRow';
import { GLASS } from '@/lib/glass';

export const LINK = 'max-w-full truncate text-left hover:text-foreground hover:underline';

const SITE = 'https://music.youtube.com';

export type TrackRef = Pick<MusicTrack, 'videoId' | 'title' | 'artist'> & Partial<MusicTrack>;

export function openArtist(name: string, id?: string): void {
  const { go, runSearch, setFocus } = useMusicStore.getState();
  setFocus(false);
  if (id) go({ kind: 'page', browseId: id, title: name });
  else if (name) {
    void runSearch(name);
    go({ kind: 'search' });
  }
}

export function openAlbum(name: string, id?: string): void {
  if (!id) return;
  const { go, setFocus } = useMusicStore.getState();
  setFocus(false);
  go({ kind: 'page', browseId: id, title: name });
}

export function Byline({ track }: { track: TrackRef }) {
  return (
    <>
      {track.artist && (
        <button type="button" onClick={() => openArtist(track.artist, track.artistId)} className={LINK}>
          {track.artist}
        </button>
      )}
      {track.artist && track.album && ' • '}
      {track.album &&
        (track.albumId ? (
          <button type="button" onClick={() => openAlbum(track.album ?? '', track.albumId)} className={LINK}>
            {track.album}
          </button>
        ) : (
          track.album
        ))}
    </>
  );
}

export function playTrack(track: TrackRef): void {
  void useMusicStore.getState().send({ kind: 'playVideo', videoId: track.videoId, playlistId: track.playlistId || undefined });
}

export function startRadio(videoId: string): void {
  void useMusicStore.getState().send({ kind: 'playVideo', videoId, playlistId: `RDAMVM${videoId}` });
}

function trackUrl(track: TrackRef): string {
  return `${SITE}/watch?v=${track.videoId}`;
}

function cardUrl(card: MusicCard): string {
  if (card.videoId) return `${SITE}/watch?v=${card.videoId}`;
  if (card.browseId.startsWith('VL')) return `${SITE}/playlist?list=${card.browseId.slice(2)}`;
  if (card.browseId) return `${SITE}/browse/${card.browseId}`;
  return `${SITE}/playlist?list=${card.playlistId}`;
}

async function copy(url: string) {
  await navigator.clipboard.writeText(url);
  toast.success('Link copied');
}

export function useNowPlaying(): TrackRef | null {
  const state = useMusicStore(s => s.state);
  const item = useMusicStore(s => (s.queue ? s.queue.items[s.queue.current] : undefined));
  if (!state?.videoId) return null;
  const match = item?.videoId === state.videoId ? item : undefined;
  return {
    videoId: state.videoId,
    title: state.title,
    artist: state.artist,
    album: state.album,
    artistId: match?.artistId ?? '',
    albumId: match?.albumId ?? '',
    playlistId: match?.playlistId ?? '',
  };
}

function Menu({ body, children }: { body: () => ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <ContextMenu onOpenChange={setOpen}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      {open && <ContextMenuContent className={cn(GLASS, 'w-56 rounded-xl')}>{body()}</ContextMenuContent>}
    </ContextMenu>
  );
}

export function TrackMenu({ track, children }: { track: TrackRef; children: ReactNode }) {
  return (
    <Menu
      body={() => (
        <>
          <ContextMenuItem onSelect={() => playTrack(track)}>
            <Play size={15} strokeWidth={1.6} />
            Play
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => startRadio(track.videoId)}>
            <Radio size={15} strokeWidth={1.6} />
            Start radio
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem disabled={!track.artist} onSelect={() => openArtist(track.artist, track.artistId)}>
            <MicVocal size={15} strokeWidth={1.6} />
            Go to artist
          </ContextMenuItem>
          <ContextMenuItem disabled={!track.albumId} onSelect={() => openAlbum(track.album ?? '', track.albumId)}>
            <Disc3 size={15} strokeWidth={1.6} />
            Go to album
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => void copy(trackUrl(track))}>
            <Link size={15} strokeWidth={1.6} />
            Copy link
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => window.api.shell.openExternal(trackUrl(track))}>
            <ExternalLink size={15} strokeWidth={1.6} />
            Open in browser
          </ContextMenuItem>
        </>
      )}
    >
      {children}
    </Menu>
  );
}

export function CardMenu({ card, children }: { card: MusicCard; children: ReactNode }) {
  return (
    <Menu
      body={() => (
        <>
          {card.browseId && (
            <ContextMenuItem onSelect={() => openCard(card)}>
              <SquareArrowOutUpRight size={15} strokeWidth={1.6} />
              Open
            </ContextMenuItem>
          )}
          {(card.videoId || card.playlistId) && (
            <ContextMenuItem onSelect={() => playCard(card)}>
              <Play size={15} strokeWidth={1.6} />
              Play
            </ContextMenuItem>
          )}
          {card.videoId && (
            <ContextMenuItem onSelect={() => startRadio(card.videoId)}>
              <Radio size={15} strokeWidth={1.6} />
              Start radio
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => void copy(cardUrl(card))}>
            <Link size={15} strokeWidth={1.6} />
            Copy link
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => window.api.shell.openExternal(cardUrl(card))}>
            <ExternalLink size={15} strokeWidth={1.6} />
            Open in browser
          </ContextMenuItem>
        </>
      )}
    >
      {children}
    </Menu>
  );
}

export function ArtistMenu({ name, id, children }: { name: string; id?: string; children: ReactNode }) {
  return (
    <Menu
      body={() => (
        <ContextMenuItem onSelect={() => openArtist(name, id)}>
          <MicVocal size={15} strokeWidth={1.6} />
          Go to artist
        </ContextMenuItem>
      )}
    >
      {children}
    </Menu>
  );
}
