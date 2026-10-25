import { useEffect } from 'react';

import AppBackdrop from '@/components/layout/AppBackdrop';
import AppShell from '@/components/layout/AppShell';
import BackdropKaraoke from '@/components/layout/BackdropKaraoke';
import GlobalFinder from '@/components/layout/GlobalFinder';
import TitleBar from '@/components/layout/TitleBar';
import UpdateHost from '@/components/layout/UpdateHost';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAppTitle } from '@/hooks/useAppTitle';
import { useKeybindings } from '@/hooks/useKeybindings';
import { useMusicEq } from '@/hooks/useMusicEq';
import { useApplyTheme } from '@/hooks/useTheme';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useUiStore } from '@/stores/useUiStore';

function revealApp(): void {
  document.body.classList.add('booted');
  const splash = document.getElementById('splash');
  if (!splash || splash.classList.contains('done')) return;
  splash.classList.add('done');
  setTimeout(() => splash.remove(), 300);
}

export default function App() {
  const loadProfiles = useProfileStore(s => s.loadProfiles);
  const profileId = useProfileStore(s => s.activeProfileId);
  const profilesLoading = useProfileStore(s => s.loading);
  const profilesError = useProfileStore(s => s.error);
  const hydrated = useLayoutStore(s => s.hydrated);
  const backdropOnly = useUiStore(s => s.backdropOnly);

  useApplyTheme();
  useAppTitle();
  useKeybindings();
  useMusicEq();

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const booted = Boolean(profilesError) || (!profilesLoading && hydrated);

  useEffect(() => {
    if (booted) revealApp();
  }, [booted]);

  useEffect(() => {
    const giveUp = setTimeout(revealApp, 8000);
    return () => clearTimeout(giveUp);
  }, []);

  useEffect(() => {
    if (!profileId) return;
    window.api.musicRepo.open(profileId).catch(err => console.error('[music data] open failed', err));
  }, [profileId]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative isolate flex h-full w-full min-w-0 flex-col">
        <AppBackdrop />
        <TitleBar />
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
          <div
            className={`flex min-h-0 min-w-0 transition-opacity duration-300 [grid-area:1/1] ${backdropOnly ? 'invisible opacity-0' : ''}`}
          >
            <AppShell />
          </div>
          {backdropOnly && <BackdropKaraoke />}
        </div>
      </div>
      <GlobalFinder />
      <UpdateHost />
      <Toaster
        position="top-center"
        style={
          {
            '--normal-bg': 'color-mix(in oklch, var(--card) 55%, transparent)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
            '--border-radius': 'var(--radius-xl)',
          } as React.CSSProperties
        }
        toastOptions={{ classNames: { toast: 'backdrop-blur-xl' } }}
      />
    </TooltipProvider>
  );
}
