import { cn } from '@/lib/utils';
import { useMusicStore, type CoverView } from '@/stores/useMusicStore';
import type { MusicAboutKind, MusicCard } from '@/types';

import { CardMenu } from './menus';
import Shelf from './Shelf';
import { Cover } from './ui';

export function openCard(card: MusicCard): void {
  const { go, send } = useMusicStore.getState();
  if (card.videoId) void send({ kind: 'playVideo', videoId: card.videoId, playlistId: card.playlistId || undefined });
  else if (card.browseId) go({ kind: 'page', browseId: card.browseId, title: card.title });
}

export function playCard(card: MusicCard): void {
  const { send } = useMusicStore.getState();
  if (card.videoId) void send({ kind: 'playVideo', videoId: card.videoId, playlistId: card.playlistId || undefined });
  else if (card.playlistId) void send({ kind: 'playPlaylist', playlistId: card.playlistId });
  else openCard(card);
}

export function cardView(card: MusicCard): Omit<CoverView, 'src'> {
  const kinds: Partial<Record<MusicCard['kind'], MusicAboutKind>> = {
    song: 'song',
    video: 'song',
    album: 'album',
    artist: 'artist',
  };
  return { kind: kinds[card.kind] ?? null, title: card.title, artist: card.subtitle };
}

export function CardTile({ card, className }: { card: MusicCard; className?: string }) {
  const round = card.kind === 'artist' || card.kind === 'profile';
  const canPlay = Boolean(card.videoId || card.playlistId);

  return (
    <CardMenu card={card}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => openCard(card)}
        onKeyDown={e => e.key === 'Enter' && openCard(card)}
        className={cn(
          'group flex min-w-0 flex-col gap-2 rounded-lg p-2.5 outline-none transition-colors duration-150 hover:bg-accent/50 focus-visible:bg-accent/50',
          className,
        )}
      >
        <div className="grid">
          <Cover
            src={card.thumbnail}
            round={round}
            expand={cardView(card)}
            onClick={canPlay || card.kind === 'album' ? () => playCard(card) : undefined}
            playable={canPlay}
            className={cn('w-full [grid-area:1/1]', card.wide ? 'aspect-video' : 'aspect-square')}
          />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium">{card.title}</div>
          <div className="line-clamp-2 text-[12px] text-muted-foreground">{card.subtitle}</div>
        </div>
      </div>
    </CardMenu>
  );
}

export default function CardRow({ title, cards }: { title: string; cards: MusicCard[] }) {
  if (!cards.length) return null;
  return (
    <section className="flex flex-col gap-1">
      {title && <h2 className="px-2.5 text-[18px] font-semibold">{title}</h2>}
      <Shelf className="grid auto-cols-[172px] grid-flow-col gap-1">
        {cards.map((card, i) => (
          <CardTile key={`${card.browseId || card.videoId}-${i}`} card={card} />
        ))}
      </Shelf>
    </section>
  );
}
