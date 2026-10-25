import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, FolderOpen, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RepoInfo, RepoIntegrity } from '@/types';

import { Facts, fmtBytes, fmtDate, fmtDateTime, Section, Tile, useRepo } from './parts';

const PLAIN_ROW = 'border-border/60 hover:bg-transparent';

export default function DatabaseTab({ info, profileName, onInfo }: { info: RepoInfo; profileName: string; onInfo: () => void }) {
  const { data: tables } = useRepo(() => window.api.musicRepo.tables(), [info.profileId, info.status]);
  const { data: searches, reload: reloadSearches } = useRepo(() => window.api.musicRepo.searchHistory(50), [info.profileId]);
  const [integrity, setIntegrity] = useState<RepoIntegrity | null>(null);
  const [busy, setBusy] = useState<'' | 'check' | 'rebuild'>('');

  async function copyPath() {
    try {
      await navigator.clipboard.writeText(info.path);
      toast.success('Database path copied');
    } catch (err) {
      console.error('[music data] copy failed', err);
      toast.error('Could not copy the path');
    }
  }

  async function check() {
    setBusy('check');
    try {
      setIntegrity(await window.api.musicRepo.integrity());
    } catch (err) {
      toast.error(`Integrity check failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy('');
    }
  }

  async function rebuild() {
    setBusy('rebuild');
    try {
      const done = await window.api.musicRepo.rebuildStats();
      toast.success(`Stats rebuilt for ${done.tracks.toLocaleString('en-US')} songs in ${done.ms} ms`);
      onInfo();
    } catch (err) {
      toast.error(`Rebuild failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy('');
    }
  }

  async function clearSearch(id?: number) {
    try {
      await window.api.musicRepo.clearSearch(id);
      reloadSearches();
    } catch (err) {
      toast.error(`Could not clear: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const legacy =
    info.legacy.state === 'here'
      ? `${info.legacy.plays.toLocaleString('en-US')} plays imported ${fmtDate(info.legacy.at)}`
      : info.legacy.state === 'elsewhere'
        ? 'Imported into another profile'
        : 'Nothing to import';

  const total = info.sizeBytes + info.walBytes + info.shmBytes;
  const rows = (tables ?? []).reduce((n, t) => n + t.rows, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 px-2.5">
        <Tile label="On disk" value={total / 1024 / 1024} decimals={2} suffix="MB" sub="Database, log and index together" />
        <Tile label="Schema" text={`Version ${info.schemaVersion}`} sub={info.schemaVersion === info.latestVersion ? 'Up to date' : `${info.latestVersion} is the newest`} />
        <Tile label="Rows" value={rows} sub={`Across ${tables?.length ?? 0} tables`} />
        <Tile
          label="Integrity"
          text={integrity ? (integrity.ok ? 'No problems' : 'Problems found') : 'Not checked'}
          sub={integrity ? `Checked in ${integrity.ms} ms` : 'Run a check below'}
        />
      </div>

      <Section
        title="File"
        action={
          <>
            <Button variant="outline" size="sm" onClick={() => void copyPath()}>
              <Copy size={15} strokeWidth={1.6} /> Copy path
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.api.shell.showInFolder(info.path)}>
              <FolderOpen size={15} strokeWidth={1.6} /> Open folder
            </Button>
          </>
        }
      >
        <Facts
          rows={[
            ['Profile', profileName],
            ['Path', <span className="font-mono text-[11.5px] break-all text-muted-foreground">{info.path}</span>],
            ['Database', fmtBytes(info.sizeBytes)],
            ['Write ahead log', fmtBytes(info.walBytes)],
            ['Shared memory index', fmtBytes(info.shmBytes)],
            ['Total on disk', <span className="font-semibold">{fmtBytes(total)}</span>],
            ['Journal', info.journalMode],
            ['Foreign keys', info.foreignKeys ? 'On' : 'Off'],
            ['Opened', fmtDateTime(info.openedAt)],
            ['Last write', fmtDateTime(info.lastWriteAt)],
            ['Old app wide history', legacy],
          ]}
        />
      </Section>

      <Section
        title="Health"
        action={
          <>
            <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void check()}>
              {busy === 'check' ? <Spinner className="size-4" /> : <ShieldCheck size={15} strokeWidth={1.6} />} Run integrity check
            </Button>
            <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void rebuild()}>
              {busy === 'rebuild' ? <Spinner className="size-4" /> : <RefreshCw size={15} strokeWidth={1.6} />} Rebuild stats
            </Button>
          </>
        }
      >
        <p className="px-2.5 text-[12px] text-muted-foreground">
          Rebuilding recomputes every song's totals from its plays. It never touches the plays or events themselves.
        </p>
        {integrity && (
          <Alert variant={integrity.ok ? 'default' : 'destructive'} className="mx-2.5 w-auto bg-card/50">
            <ShieldCheck size={15} strokeWidth={1.6} />
            <AlertTitle>{integrity.ok ? 'No problems found' : 'Problems found'}</AlertTitle>
            <AlertDescription>
              {integrity.messages.join(', ')}
              {integrity.foreignKeyErrors ? `, ${integrity.foreignKeyErrors} broken references` : ''}. Took {integrity.ms} ms.
            </AlertDescription>
          </Alert>
        )}
      </Section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
        <Section title="Migrations">
          <Table className="text-[12.5px]">
            <TableHeader>
              <TableRow className={PLAIN_ROW}>
                <TableHead className="pl-3">Version</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="pr-3">Applied</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {info.migrations.map(m => (
                <TableRow key={m.version} className={PLAIN_ROW}>
                  <TableCell className="pl-3 tabular-nums">{m.version}</TableCell>
                  <TableCell className="font-mono text-[11.5px]">{m.name}</TableCell>
                  <TableCell className="pr-3 text-muted-foreground tabular-nums">
                    {m.appliedAt ? fmtDateTime(m.appliedAt) : <Badge variant="outline">Pending</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>

        <Section title="Tables">
          <Table className="text-[12.5px]">
            <TableHeader>
              <TableRow className={PLAIN_ROW}>
                <TableHead className="pl-3">Table</TableHead>
                <TableHead className="pr-3 text-right">Rows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tables ?? []).map(t => (
                <TableRow key={t.name} className={PLAIN_ROW}>
                  <TableCell className="pl-3 font-mono text-[11.5px]">{t.name}</TableCell>
                  <TableCell className="pr-3 text-right tabular-nums">{t.rows.toLocaleString('en-US')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      </div>

      <Section
        title="Search history"
        action={
          searches?.length ? (
            <Button variant="outline" size="sm" onClick={() => void clearSearch()}>
              <Trash2 size={15} strokeWidth={1.6} /> Clear all
            </Button>
          ) : null
        }
      >
        {!searches?.length ? (
          <p className="flex items-center gap-2 px-2.5 text-[12.5px] text-muted-foreground">
            <Search size={15} strokeWidth={1.6} /> No searches kept. A search is kept once its results stay on screen, the newest 500 are kept.
          </p>
        ) : (
          <div className="flex flex-col">
            {searches.map(s => (
              <div key={s.id} className="group flex items-center gap-3 rounded-md px-2.5 py-1 text-[13px] transition-colors duration-150 hover:bg-accent/60">
                <span className="min-w-0 flex-1 truncate">{s.query}</span>
                <span className="text-[11.5px] text-muted-foreground tabular-nums">
                  {s.count > 1 ? `${s.count} times, ` : ''}
                  {fmtDateTime(s.searchedAt)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Forget ${s.query}`}
                  onClick={() => void clearSearch(s.id)}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <X size={15} strokeWidth={1.6} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
