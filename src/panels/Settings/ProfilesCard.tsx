import { useState } from 'react';
import { Check, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ItemGroup, ItemSeparator } from '@/components/ui/item';
import { ACCENTS } from '@/lib/accents';
import { useProfileStore, type Profile } from '@/stores/useProfileStore';

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word[0]!.toUpperCase())
      .join('') || '?'
  );
}

export default function ProfilesCard() {
  const profiles = useProfileStore(s => s.profiles);
  const activeId = useProfileStore(s => s.activeProfileId);
  const switchProfile = useProfileStore(s => s.switchProfile);
  const createProfile = useProfileStore(s => s.createProfile);
  const deleteProfile = useProfileStore(s => s.deleteProfile);
  const loadProfiles = useProfileStore(s => s.loadProfiles);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [accent, setAccent] = useState('blue');
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<unknown>, done: string) {
    try {
      await work();
      toast.success(done);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createProfile({ name: name.trim(), color: accent });
      toast.success(`Created ${name.trim()}`);
      setCreating(false);
      setName('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create profile');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-0 overflow-hidden bg-card/40 py-0 shadow-none">
      <CardHeader className="flex-row items-center border-b py-4">
        <CardTitle className="text-[13px]">Profiles</CardTitle>
        <div className="ml-auto flex gap-2">
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={15} strokeWidth={1.6} />
            New profile
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-0">
        <ItemGroup>
          {profiles.map((profile, index) => (
            <div key={profile.id}>
              {index > 0 && <ItemSeparator />}
              <ProfileRow
                profile={profile}
                active={profile.id === activeId}
                onlyOne={profiles.length === 1}
                onSwitch={() => void run(() => switchProfile(profile.id), `Switched to ${profile.name}`)}
                onDelete={() => void run(() => deleteProfile(profile.id), `${profile.name} deleted`)}
              />
            </div>
          ))}
        </ItemGroup>
      </CardContent>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New profile</DialogTitle>
          </DialogHeader>

          <Field>
            <FieldLabel htmlFor="new-profile-name">Name</FieldLabel>
            <Input
              id="new-profile-name"
              value={name}
              autoFocus
              placeholder="Work"
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void create();
              }}
            />
            <FieldDescription>
              The folder on disk takes a slug of this name, so profiles stay readable by hand.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Accent</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map(a => (
                <button
                  key={a}
                  type="button"
                  data-accent={a}
                  aria-label={a}
                  aria-pressed={accent === a}
                  onClick={() => setAccent(a)}
                  style={{ background: 'var(--primary)' }}
                  className={`size-6 rounded-full border-2 transition-transform duration-150 hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
                    accent === a ? 'border-foreground' : 'border-transparent'
                  }`}
                />
              ))}
            </div>
          </Field>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !name.trim()} onClick={() => void create()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface ProfileRowProps {
  profile: Profile;
  active: boolean;
  onlyOne: boolean;
  onSwitch: () => void;
  onDelete: () => void;
}

function ProfileRow({ profile, active, onlyOne, onSwitch, onDelete }: ProfileRowProps) {
  const updateProfile = useProfileStore(s => s.updateProfile);
  const [name, setName] = useState(profile.name);

  async function revealFolder() {
    try {
      const paths = await window.api.profile.paths(profile.id);
      window.api.shell.showInFolder(paths.root);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  function commitName() {
    const next = name.trim();
    if (!next || next === profile.name) {
      setName(profile.name);
      return;
    }
    void updateProfile(profile.id, { name: next });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Avatar className="size-8 shrink-0 ring-2 ring-primary ring-offset-2 ring-offset-card" data-accent={profile.color}>
        <AvatarFallback className="text-[10px]">{initialsOf(profile.name)}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-[220px] flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <Input
            value={name}
            aria-label={`name of ${profile.name}`}
            onChange={e => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            className="h-8 max-w-[240px]"
          />
          {active && (
            <Badge variant="secondary" className="gap-1">
              <Check size={15} strokeWidth={1.6} />
              active
            </Badge>
          )}
        </div>
        <span className="path truncate">profiles/{profile.folder ?? profile.id}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {ACCENTS.map(a => (
          <button
            key={a}
            type="button"
            data-accent={a}
            aria-label={`${a} accent for ${profile.name}`}
            aria-pressed={profile.color === a}
            onClick={() => void updateProfile(profile.id, { color: a })}
            style={{ background: 'var(--primary)' }}
            className={`size-4 rounded-full border-2 transition-transform duration-150 hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
              profile.color === a ? 'border-foreground' : 'border-transparent'
            }`}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={active} onClick={onSwitch}>
          Switch
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void revealFolder()}
          aria-label={`reveal the folder of ${profile.name}`}
        >
          <FolderOpen size={15} strokeWidth={1.6} />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={onlyOne}
              aria-label={`delete ${profile.name}`}
            >
              <Trash2 size={15} strokeWidth={1.6} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {profile.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                The whole profile folder goes, settings, layout and listening history in it.
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
