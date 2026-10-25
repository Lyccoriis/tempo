import { useState } from 'react';
import { toast } from 'sonner';
import { Database, TriangleAlert } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMusicStore, type MusicDataTab } from '@/stores/useMusicStore';
import { useProfileStore } from '@/stores/useProfileStore';

import AlbumsTable from './AlbumsTable';
import ArtistsTable from './ArtistsTable';
import DatabaseTab from './DatabaseTab';
import Timeline from './Timeline';
import OverviewTab from './OverviewTab';
import TracksTable from './TracksTable';
import { useRepo } from './parts';

const TABS: Array<{ id: MusicDataTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'tracks', label: 'Songs' },
  { id: 'artists', label: 'Artists' },
  { id: 'albums', label: 'Albums' },
  { id: 'history', label: 'History' },
  { id: 'database', label: 'Database' },
];

export default function DataView({ tab, heard }: { tab: MusicDataTab; heard?: 'unheard' }) {
  const profileId = useProfileStore(s => s.activeProfileId);
  const profileName = useProfileStore(s => s.profiles.find(p => p.id === s.activeProfileId)?.name ?? '');
  const { data: info, reload } = useRepo(() => window.api.musicRepo.info(), [profileId]);
  const [confirm, setConfirm] = useState(false);

  const setTab = (next: string) => useMusicStore.setState({ view: { kind: 'data', tab: next as MusicDataTab } });

  async function setAside() {
    try {
      await window.api.musicRepo.setAside();
      toast.success('The damaged file was kept beside the new one');
      reload();
    } catch (err) {
      toast.error(`Could not start a new database: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const header = (
    <div className="flex flex-col gap-1 px-2.5">
      <h1 className="text-[28px] font-bold">Your music</h1>
      <p className="text-[12.5px] text-muted-foreground">
        Everything <span className="text-foreground">{profileName || 'this profile'}</span> has played and found, kept on this computer only
      </p>
    </div>
  );

  if (!info) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Skeleton className="mx-2.5 h-9 w-96" />
        <Skeleton className="mx-2.5 h-40" />
      </div>
    );
  }

  if (info.status === 'closed') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Database size={15} strokeWidth={1.6} />
            </EmptyMedia>
            <EmptyTitle>No database open</EmptyTitle>
            <EmptyDescription>The Music database opens with the active profile. Pick a profile and it opens on its own.</EmptyDescription>
          </EmptyHeader>
          <Button size="sm" variant="outline" onClick={reload}>
            Check again
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {header}

      {info.status === 'error' && (
        <Alert variant="destructive" className="mx-2.5 w-auto bg-card/50">
          <TriangleAlert size={15} strokeWidth={1.6} />
          <AlertTitle>The Music database could not be opened</AlertTitle>
          <AlertDescription>
            <p>{info.error}</p>
            <p>
              Listening is not being recorded for this profile until this is fixed. Nothing was deleted, the file is still at{' '}
              <span className="font-mono text-[11.5px] break-all">{info.path}</span>.
            </p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setConfirm(true)}>
              Set it aside and start a new one
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {info.status === 'open' && (
        <>
          <Tabs value={tab} onValueChange={setTab} className="px-2.5">
            <TabsList>
              {TABS.map(t => (
                <TabsTrigger key={t.id} value={t.id}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {tab === 'overview' && <OverviewTab info={info} />}
          {tab === 'tracks' && <TracksTable key={heard ?? 'all'} heard={heard} />}
          {tab === 'artists' && <ArtistsTable />}
          {tab === 'albums' && <AlbumsTable />}
          {tab === 'history' && <Timeline filters />}
          {tab === 'database' && <DatabaseTab info={info} profileName={profileName} onInfo={reload} />}
        </>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new Music database?</AlertDialogTitle>
            <AlertDialogDescription>
              The damaged file is renamed and left in the same folder, nothing is deleted. A new, empty database takes its place for this profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void setAside()}>Set aside</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
