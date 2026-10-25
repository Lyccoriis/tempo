import { useEffect, useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { ExternalLink } from 'lucide-react';

import FlipCard from '@/components/reactbits/FlipCard';
import { Button } from '@/components/ui/button';
import { DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useMusicStore } from '@/stores/useMusicStore';
import type { MusicAbout } from '@/types';

import { fmtDate, fmtListened, fmtPercent, useRepo } from './data/parts';
import { Cover } from './ui';

function large(src: string): string {
  return /googleusercontent\.com|ggpht\.com/.test(src) ? src.replace(/=w\d+-h\d+/, '=w1200-h1200') : src;
}

export default function CoverViewer() {
  const viewer = useMusicStore(s => s.viewer);
  const setViewer = useMusicStore(s => s.setViewer);
  const [about, setAbout] = useState<MusicAbout | null | undefined>(undefined);
  const videoId = viewer?.videoId ?? '';
  const { data: track } = useRepo(
    () => (videoId ? window.api.musicRepo.trackByVideo(videoId) : Promise.resolve(null)),
    [videoId],
  );
  const stats = videoId && track?.sources.some(s => s.providerId === videoId) ? track.stats : null;

  useEffect(() => {
    setAbout(undefined);
    if (!viewer?.kind) {
      setAbout(null);
      return;
    }
    let live = true;
    window.api.ytmusic
      .about(viewer.kind, viewer.title, viewer.artist)
      .then(found => live && setAbout(found))
      .catch(err => {
        console.error('[music] about failed', err);
        if (live) setAbout(null);
      });
    return () => {
      live = false;
    };
  }, [viewer]);

  const close = () => setViewer(null);

  return (
    <DialogPrimitive.Root open={Boolean(viewer)} onOpenChange={open => !open && close()}>
      <DialogPortal>
        <DialogOverlay className="bg-black/70 backdrop-blur-sm" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onClick={e => e.target === e.currentTarget && close()}
          onEscapeKeyDown={e => {
            e.preventDefault();
            close();
          }}
          className="fixed inset-0 z-50 grid place-items-center outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DialogTitle className="sr-only">{viewer?.title || 'Cover'}</DialogTitle>
          {viewer && (
            <FlipCard
              ariaLabel="Flip the cover"
              className="aspect-square w-[min(80vh,80vw,720px)]"
              front={<Cover src={large(viewer.src)} className="size-full rounded-none" />}
              back={
                <div className="grid size-full grid-rows-[minmax(0,1fr)]">
                  <Cover src={large(viewer.src)} className="size-full -scale-x-100 rounded-none [grid-area:1/1]" />
                  <div className="relative bg-black/80 [grid-area:1/1]" />
                  <div className="relative flex min-h-0 flex-col gap-3 overflow-y-auto p-8 text-white [grid-area:1/1]">
                    <div>
                      <div className="text-[18px] leading-tight font-semibold">{about?.title || viewer.title}</div>
                      {(about?.description || viewer.artist) && (
                        <div className="text-[13px] text-white/70">{about?.description || viewer.artist}</div>
                      )}
                    </div>
                    {stats && stats.plays > 0 && (
                      <div className="grid grid-cols-3 gap-x-4 gap-y-2 border-y border-white/15 py-3">
                        {(
                          [
                            ['Plays', String(stats.plays)],
                            ['Listened', fmtListened(stats.listenedMs)],
                            ['Skips', String(stats.skips)],
                            ['First heard', fmtDate(stats.firstHeardAt)],
                            ['Last heard', fmtDate(stats.lastHeardAt)],
                            ['Avg heard', fmtPercent(stats.avgCompletion) || 'n/a'],
                          ] as const
                        ).map(([label, value]) => (
                          <div key={label} className="min-w-0">
                            <div className="text-[11px] font-medium tracking-[0.06em] text-white/60 uppercase">{label}</div>
                            <div className="truncate text-[14px] font-semibold tabular-nums">{value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {about === undefined ? (
                      <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-full bg-white/15" />
                        <Skeleton className="h-4 w-11/12 bg-white/15" />
                        <Skeleton className="h-4 w-3/4 bg-white/15" />
                      </div>
                    ) : about ? (
                      <p className="text-[14px] leading-relaxed">{about.text}</p>
                    ) : (
                      <p className="text-[13px] text-white/70">Nothing found about this one on Wikipedia.</p>
                    )}
                    {about?.url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-auto self-start"
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => {
                          e.stopPropagation();
                          window.api.shell.openExternal(about.url);
                        }}
                      >
                        <ExternalLink size={15} strokeWidth={1.6} /> Read on Wikipedia
                      </Button>
                    )}
                  </div>
                </div>
              }
            />
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
