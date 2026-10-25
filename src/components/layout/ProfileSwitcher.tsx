import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Item, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ACCENTS } from '@/lib/accents';
import { GLASS } from '@/lib/glass';
import { cn } from '@/lib/utils';
import { useLayoutStore } from '@/stores/useLayoutStore';
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

interface ProfileSwitcherProps {
  collapsed?: boolean;
}

export default function ProfileSwitcher({ collapsed = false }: ProfileSwitcherProps) {
  const profiles = useProfileStore(s => s.profiles);
  const activeId = useProfileStore(s => s.activeProfileId);
  const loading = useProfileStore(s => s.loading);
  const switchProfile = useProfileStore(s => s.switchProfile);
  const createProfile = useProfileStore(s => s.createProfile);
  const setActivePanel = useLayoutStore(s => s.setActivePanel);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAccent, setNewAccent] = useState<string>('blue');
  const [busy, setBusy] = useState(false);

  const active = profiles.find(p => p.id === activeId) ?? null;

  if (loading && profiles.length === 0) {
    return (
      <div className={`flex items-center gap-2 p-1 ${collapsed ? 'justify-center' : ''}`}>
        <Skeleton className="size-7 rounded-full" />
        {!collapsed && <Skeleton className="h-3 w-24" />}
      </div>
    );
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await createProfile({ name: newName.trim(), color: newAccent });
      toast.success(`Created ${newName.trim()}`);
      setCreating(false);
      setOpen(false);
      setNewName('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create profile');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className={
              collapsed
                ? 'size-8 justify-center p-0'
                : 'h-10 flex-1 justify-start gap-2 px-1.5'
            }
            aria-label="Switch profile"
          >
            <ProfileAvatar profile={active} compact={collapsed} />
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate text-left text-[13px]">
                  {active?.name ?? 'No profile'}
                </span>
                <ChevronsUpDown size={15} strokeWidth={1.6} className="text-muted-foreground" />
              </>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent side="right" align="end" className={cn(GLASS, 'w-64 rounded-xl p-1.5')}>
          <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Profiles
          </div>

          {profiles.map(profile => (
            <Item
              key={profile.id}
              size="sm"
              className="cursor-pointer rounded-md px-2 py-2 hover:bg-accent/60"
              onClick={() => {
                setOpen(false);
                void switchProfile(profile.id);
              }}
            >
              <ItemMedia>
                <ProfileAvatar profile={profile} />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="truncate">{profile.name}</ItemTitle>
              </ItemContent>
              {profile.id === activeId && (
                <Check size={15} strokeWidth={1.6} className="text-primary" />
              )}
            </Item>
          ))}

          <Separator className="my-1.5" />

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => setCreating(true)}
          >
            <Plus size={15} strokeWidth={1.6} /> New profile
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => {
              setOpen(false);
              setActivePanel('settings');
            }}
          >
            <Settings2 size={15} strokeWidth={1.6} /> Manage profiles
          </Button>
        </PopoverContent>
      </Popover>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New profile</DialogTitle>
          </DialogHeader>

          <Field>
            <FieldLabel htmlFor="profile-name">Name</FieldLabel>
            <Input
              id="profile-name"
              value={newName}
              autoFocus
              placeholder="Work"
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void handleCreate();
              }}
            />
            <FieldDescription>
              Each profile keeps its own settings, keystrokes and music data.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Accent color</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map(accent => (
                <button
                  key={accent}
                  type="button"
                  aria-label={accent}
                  aria-pressed={newAccent === accent}
                  data-accent={accent}
                  onClick={() => setNewAccent(accent)}
                  style={{ background: 'var(--primary)' }}
                  className={`size-6 rounded-full border-2 transition-transform duration-150 hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
                    newAccent === accent ? 'border-foreground' : 'border-transparent'
                  }`}
                />
              ))}
            </div>
          </Field>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !newName.trim()} onClick={() => void handleCreate()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProfileAvatar({ profile, compact = false }: { profile: Profile | null; compact?: boolean }) {
  return (
    <Avatar
      className={`size-7 shrink-0 ring-primary ring-offset-sidebar ${
        compact ? 'ring-1 ring-offset-1' : 'ring-2 ring-offset-2'
      }`}
      data-accent={profile?.color}
    >
      <AvatarFallback className="text-[10px]">
        {profile ? initialsOf(profile.name) : '?'}
      </AvatarFallback>
    </Avatar>
  );
}
