import { useEffect, useState } from 'react';
import { Music, Pause, Play } from 'lucide-react';

import TiltedCard from '@/components/reactbits/TiltedCard';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useMusicStore, type CoverView } from '@/stores/useMusicStore';

interface CoverProps {
  src: string;
  round?: boolean;
  expand?: Omit<CoverView, 'src'>;
  onClick?: () => void;
  playable?: boolean;
  depth?: 'light' | 'full';
  className?: string;
}

export function Cover({ src, round, expand, onClick, playable, depth, className }: CoverProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const art = (
    <div
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden bg-muted text-muted-foreground',
        round ? 'rounded-full' : 'rounded-md',
        className,
        expand && 'size-full',
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <Music size={15} strokeWidth={1.6} />
      )}
      {playable && (
        <span className="absolute inset-0 grid place-items-center bg-black/35 text-white opacity-0 transition-opacity duration-150 group-hover/cover:opacity-100">
          <Play size={24} strokeWidth={1.6} fill="currentColor" className="translate-x-px" />
        </span>
      )}
    </div>
  );
  if (!expand) return art;
  return (
    <TiltedCard
      className={cn(onClick ? 'cursor-pointer' : 'cursor-zoom-in', playable && 'group/cover', className)}
      scaleOnHover={depth === 'light' ? 1.04 : depth === 'full' || playable ? 1.05 : undefined}
      rotateAmplitude={depth === 'light' ? 6 : depth === 'full' ? 10 : playable ? 9 : undefined}
      glare={depth === 'full' ? (round ? 'rounded-full' : 'rounded-md') : undefined}
      onClick={e => {
        e.stopPropagation();
        if (onClick) onClick();
        else useMusicStore.getState().setViewer({ src, ...expand });
      }}
    >
      {art}
    </TiltedCard>
  );
}

export function PlayGlyph({ playing }: { playing: boolean }) {
  return playing ? (
    <Pause size={20} strokeWidth={1.6} fill="currentColor" />
  ) : (
    <Play size={20} strokeWidth={1.6} fill="currentColor" className="translate-x-px" />
  );
}

const unchecked = new Set<string>();

function check(videoId: string) {
  if (!unchecked.size) {
    queueMicrotask(() => {
      void useMusicStore.getState().checkWordTimed([...unchecked]);
      unchecked.clear();
    });
  }
  unchecked.add(videoId);
}

export function EnhancedBadge({ videoId }: { videoId?: string }) {
  const timed = useMusicStore(s => (videoId ? s.wordTimed[videoId] : false));
  useEffect(() => {
    if (videoId && timed === undefined) check(videoId);
  }, [videoId, timed]);

  if (!timed) return null;
  return (
    <Badge variant="outline" title="Enhanced LRC, the lyrics are timed word by word" className="h-4 px-1.5 text-[10px]">
      Enhanced
    </Badge>
  );
}
