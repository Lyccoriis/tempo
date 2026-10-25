import { useCallback, useMemo, useState } from 'react';
import { UserRound, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { NAV_ITEMS } from './NavSidebar';
import { useDoubleShift } from '@/hooks/useDoubleShift';
import { APP_COMMANDS, resolveBindings } from '@/lib/commands';
import { GLASS } from '@/lib/glass';
import { formatBinding } from '@/lib/keys';
import { cn } from '@/lib/utils';
import { useFinderStore } from '@/stores/useFinderStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { SETTINGS_SECTIONS, openSettings } from '@/panels/Settings/sections';

const GROUPS = ['Panels', 'Commands', 'Profiles', 'Settings'] as const;
type GroupName = (typeof GROUPS)[number];

interface FinderItem {
  key: string;
  label: string;
  hint: string;
  group: GroupName;
  icon: LucideIcon;
  keys: string[];
  run: () => void;
}

const FINDER_GLASS = cn(
  GLASS,
  'inset-0 m-auto h-fit translate-x-0 translate-y-0 rounded-xl sm:max-w-4xl',
  '**:data-[slot=command]:bg-transparent',
  '**:data-[slot=command-item]:data-[selected=true]:bg-accent/70',
);

const IDLE_PER_GROUP = 5;
const SEARCH_PER_GROUP = 8;

function score(text: string, needle: string): number {
  const hay = text.toLowerCase();
  const at = hay.indexOf(needle);
  if (at === 0) return 1000;
  if (at > 0) return 800 - Math.min(at, 200);

  let cursor = 0;
  let gaps = 0;
  for (const char of needle) {
    const next = hay.indexOf(char, cursor);
    if (next === -1) return -1;
    gaps += next - cursor;
    cursor = next + 1;
  }
  return 400 - Math.min(gaps, 200);
}

export default function GlobalFinder() {
  const open = useFinderStore(s => s.open);
  const setOpen = useFinderStore(s => s.setOpen);
  const toggle = useFinderStore(s => s.toggle);
  const [query, setQuery] = useState('');

  const setActivePanel = useLayoutStore(s => s.setActivePanel);
  const profiles = useProfileStore(s => s.profiles);
  const activeProfileId = useProfileStore(s => s.activeProfileId);
  const keyOverrides = useProfileStore(s => s.activeConfig?.keys);
  const doubleShift = useProfileStore(s => s.activeConfig?.doubleShiftFinder ?? true);

  const bindings = useMemo(() => resolveBindings(keyOverrides), [keyOverrides]);

  useDoubleShift(
    useCallback(() => {
      if (!doubleShift) return;
      setQuery('');
      toggle();
    }, [doubleShift, toggle]),
  );

  const items = useMemo<FinderItem[]>(() => {
    const out: FinderItem[] = [];

    for (const nav of NAV_ITEMS) {
      out.push({
        key: `panel:${nav.id}`,
        label: nav.label,
        hint: 'Panel',
        group: 'Panels',
        icon: nav.icon,
        keys: formatBinding(bindings[`panel.${nav.id}`] ?? ''),
        run: () => setActivePanel(nav.id),
      });
    }

    for (const command of APP_COMMANDS) {
      if (command.panelId || command.id === 'finder.open') continue;
      out.push({
        key: `command:${command.id}`,
        label: command.label,
        hint: command.hint,
        group: 'Commands',
        icon: command.icon ?? Zap,
        keys: formatBinding(bindings[command.id] ?? ''),
        run: command.run,
      });
    }

    for (const profile of profiles) {
      if (profile.id === activeProfileId) continue;
      out.push({
        key: `profile:${profile.id}`,
        label: profile.name,
        hint: profile.role ? `Switch profile / ${profile.role}` : 'Switch profile',
        group: 'Profiles',
        icon: UserRound,
        keys: [],
        run: () => {
          void useProfileStore.getState().switchProfile(profile.id);
        },
      });
    }

    for (const section of SETTINGS_SECTIONS) {
      for (const row of section.rows) {
        out.push({
          key: `setting:${section.id}:${row}`,
          label: row,
          hint: `Settings / ${section.label}`,
          group: 'Settings',
          icon: section.icon,
          keys: [],
          run: () => openSettings(section.id),
        });
      }
    }

    return out;
  }, [bindings, profiles, activeProfileId, setActivePanel]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const cap = needle ? SEARCH_PER_GROUP : IDLE_PER_GROUP;

    const ranked = needle
      ? items
          .map(item => ({
            item,
            rank: Math.max(score(item.label, needle), score(item.hint, needle) - 200),
          }))
          .filter(entry => entry.rank > 0)
          .sort((a, b) => b.rank - a.rank)
          .map(entry => entry.item)
      : items;

    return GROUPS.map(group => ({
      group,
      found: ranked.filter(item => item.group === group).slice(0, cap),
    })).filter(section => section.found.length > 0);
  }, [items, query]);

  function pick(item: FinderItem) {
    setOpen(false);
    setQuery('');
    item.run();
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Find anything"
      description="Search panels, commands, profiles, and settings."
      className={FINDER_GLASS}
      showCloseButton={false}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search panels, commands, settings..."
      />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>Nothing matches that.</CommandEmpty>
        {results.map(section => (
          <CommandGroup key={section.group} heading={section.group}>
            {section.found.map(item => (
              <CommandItem key={item.key} value={item.key} onSelect={() => pick(item)}>
                <item.icon size={15} strokeWidth={1.6} />
                <span className="truncate">{item.label}</span>
                <span className="ml-auto truncate pl-3 text-[11px] text-muted-foreground">
                  {item.hint}
                </span>
                {item.keys.length > 0 && (
                  <KbdGroup className="shrink-0">
                    {item.keys.map(key => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </KbdGroup>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>

      <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground">
        <KbdGroup>
          <Kbd>Shift</Kbd>
          <Kbd>Shift</Kbd>
        </KbdGroup>
        <KbdGroup>
          <Kbd>up</Kbd>
          <Kbd>down</Kbd>
          <span>move</span>
          <Kbd>enter</Kbd>
          <span>open</span>
          <Kbd>esc</Kbd>
          <span>close</span>
        </KbdGroup>
      </div>
    </CommandDialog>
  );
}
