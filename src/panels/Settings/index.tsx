import { useMemo, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import ColorPicker from '@/components/shared/ColorPicker';
import { ACCENTS, isHexColor } from '@/lib/accents';
import { GLASS } from '@/lib/glass';
import { cn } from '@/lib/utils';
import { useLayoutStore } from '@/stores/useLayoutStore';
import type { ProfileConfig } from '@/stores/useProfileStore';
import type { SettingsSection } from '@/types';
import BackdropSection from './BackdropSection';
import Choice from './Choice';
import EqualizerSection from './EqualizerSection';
import KeystrokesCard from './KeystrokesCard';
import MusicSection from './MusicSection';
import ProfilesCard from './ProfilesCard';
import ResetButton from './ResetButton';
import SettingRow from './SettingRow';
import SettingsGroup from './SettingsGroup';
import { SETTINGS_SECTIONS } from './sections';
import UpdateCard from './UpdateCard';
import { SECTION_KEYS, defaultsFor, useSettings } from './useSettings';

const THEMES = [
  { id: 'oled', label: 'OLED black' },
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'system', label: 'System' },
] as const;

const RADII: [string, string][] = [
  ['0rem', 'square'],
  ['0.35rem', 'slight'],
  ['0.625rem', 'default'],
  ['1rem', 'round'],
];

export default function SettingsPanel() {
  const section = useLayoutStore(s => s.settingsSection);
  const setSection = useLayoutStore(s => s.setSettingsSection);
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!needle) return [];
    return SETTINGS_SECTIONS.flatMap(info => {
      const own = `${info.label} ${info.hint}`.toLowerCase().includes(needle);
      const rows = info.rows.filter(row => row.toLowerCase().includes(needle));
      return [
        ...(own ? [{ key: info.id, title: info.label, where: 'Section', id: info.id }] : []),
        ...rows.map(row => ({ key: `${info.id}:${row}`, title: row, where: info.label, id: info.id })),
      ];
    });
  }, [needle]);

  function jump(id: SettingsSection) {
    setSection(id);
    setQuery('');
  }

  const { set } = useSettings();
  const allKeys = Object.values(SECTION_KEYS).flat();

  const current = SETTINGS_SECTIONS.find(info => info.id === section) ?? SETTINGS_SECTIONS[0];
  const resetKeys = SECTION_KEYS[current.id as keyof typeof SECTION_KEYS];

  return (
    <div className="grid h-full min-h-0 grid-cols-[232px_minmax(0,1fr)] gap-2">
      <aside className={cn(GLASS, 'flex min-h-0 flex-col overflow-hidden rounded-xl')}>
        <div className="p-3">
          <InputGroup className="h-8">
            <InputGroupAddon>
              <Search size={15} strokeWidth={1.6} />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Search settings"
              placeholder="Search settings"
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && matches[0]) jump(matches[0].id);
                if (event.key === 'Escape') setQuery('');
              }}
            />
          </InputGroup>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-0.5 px-2 pb-3">
            {needle ? (
              matches.length === 0 ? (
                <p className="px-2 py-3 text-[12px] text-muted-foreground">No setting matches that.</p>
              ) : (
                matches.map(match => (
                  <Button
                    key={match.key}
                    variant="ghost"
                    className="h-auto flex-col items-start gap-0 px-2 py-1.5 text-left hover:bg-accent/60 focus-visible:bg-accent/60"
                    onClick={() => jump(match.id)}
                  >
                    <span className="text-[13px]">{match.title}</span>
                    <span className="text-[11px] font-normal text-muted-foreground">{match.where}</span>
                  </Button>
                ))
              )
            ) : (
              SETTINGS_SECTIONS.map(info => {
                const Icon = info.icon;
                const active = info.id === current.id;
                return (
                  <Button
                    key={info.id}
                    variant="ghost"
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'h-8 justify-start gap-2.5 px-2 text-[13px] font-normal hover:bg-accent/60 focus-visible:bg-accent/60',
                      active && 'bg-accent/70 font-medium text-accent-foreground hover:bg-accent/70',
                    )}
                    onClick={() => setSection(info.id)}
                  >
                    <Icon size={15} strokeWidth={1.6} />
                    {info.label}
                  </Button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </aside>

      <main className={cn(GLASS, 'flex min-h-0 flex-col overflow-hidden rounded-xl bg-card/35')}>
        <header className="flex flex-none items-center gap-3 border-b border-border px-[22px] py-3">
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold leading-tight">Settings</h1>
            <p className="truncate text-[12px] text-muted-foreground">
              Saved to this profile, every change applies right away
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ResetButton
              label="Reset everything"
              title="Reset every setting?"
              description="Appearance, backdrop, equalizer and playback settings go back to their defaults for this profile. Keystrokes and profiles are left alone."
              onReset={() => {
                set(defaultsFor(allKeys));
                toast.success('Settings back to defaults');
              }}
            />
          </div>
        </header>

        <ScrollArea className="min-h-0 min-w-0 flex-1">
          <div className="pad mx-auto w-full" style={{ maxWidth: 920 }}>
            <div className="mb-4 flex items-center gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold leading-tight">{current.label}</h2>
                <p className="text-[12px] text-muted-foreground">{current.hint}</p>
              </div>
              {resetKeys && (
                <div className="ml-auto">
                  <ResetButton
                    label="Reset section"
                    title={`Reset ${current.label}?`}
                    description={`Every ${current.label} setting on this page goes back to its default for this profile.`}
                    onReset={() => {
                      set(defaultsFor(resetKeys));
                      toast.success(`${current.label} back to defaults`);
                    }}
                  />
                </div>
              )}
            </div>

            <Section show={current.id === 'appearance'}>
              <AppearanceSection />
            </Section>
            <Section show={current.id === 'backdrop'}>
              <BackdropSection />
            </Section>
            <Section show={current.id === 'equalizer'}>
              <EqualizerSection />
            </Section>
            <Section show={current.id === 'music'}>
              <MusicSection />
            </Section>
            <Section show={current.id === 'keystrokes'}>
              <KeystrokesCard />
            </Section>
            <Section show={current.id === 'updates'}>
              <UpdateCard />
            </Section>
            <Section show={current.id === 'profiles'}>
              <ProfilesCard />
            </Section>
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}

function Section({ show, children }: { show: boolean; children: ReactNode }) {
  return <div className={cn('flex-col gap-4', show ? 'flex' : 'hidden')}>{children}</div>;
}

function AppearanceSection() {
  const { get, set } = useSettings();

  return (
    <SettingsGroup title="Look" description="How the whole app paints, per profile">
      <SettingRow title="Theme" description="OLED is true black, the right one for an OLED panel">
        {THEMES.map(t => (
          <ThemeCard
            key={t.id}
            id={t.id}
            label={t.label}
            active={get('theme') === t.id}
            onClick={() => set({ theme: t.id })}
          />
        ))}
      </SettingRow>

      <SettingRow title="Accent" description="Drives buttons, links, charts and the active states">
        <div className="flex max-w-[340px] flex-wrap justify-end gap-2">
          {ACCENTS.map(a => (
            <button
              key={a}
              type="button"
              data-accent={a}
              aria-label={a}
              title={a}
              aria-pressed={get('accent') === a}
              onClick={() => set({ accent: a })}
              style={{ background: 'var(--primary)' }}
              className={`size-6 rounded-full border-2 transition-transform duration-150 hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
                get('accent') === a ? 'border-foreground' : 'border-transparent'
              }`}
            />
          ))}
          <ColorPicker
            label="Custom accent"
            value={get('accent')}
            active={isHexColor(get('accent'))}
            onChange={accent => set({ accent })}
          />
        </div>
      </SettingRow>

      <SettingRow title="Corner radius" description="How round every surface is">
        <Choice
          label="Corner radius"
          value={get('radius')}
          onChange={v => set({ radius: v })}
          options={RADII}
        />
      </SettingRow>

      <SettingRow title="Density" description="Row height and padding across the app">
        <Choice
          label="Density"
          value={get('density')}
          onChange={v => set({ density: v as ProfileConfig['density'] })}
          options={[
            ['normal', 'Normal'],
            ['compact', 'Compact'],
          ]}
        />
      </SettingRow>

      <SettingRow
        title="Monospace interface"
        description="Use the mono face for everything, not only numbers"
        htmlFor="mono-ui"
      >
        <Switch id="mono-ui" checked={get('monoUi')} onCheckedChange={v => set({ monoUi: v })} />
      </SettingRow>
    </SettingsGroup>
  );
}

interface ThemeCardProps {
  id: (typeof THEMES)[number]['id'];
  label: string;
  active: boolean;
  onClick: () => void;
}

function ThemeCard({ id, label, active, onClick }: ThemeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-[92px] cursor-pointer rounded-md border p-2 transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
        active ? 'border-primary ring-[3px] ring-ring/30' : 'border-border hover:border-foreground/30'
      }`}
    >
      {id === 'system' ? (
        <div className="flex h-9 overflow-hidden rounded-sm border">
          <Preview theme="light" className="w-1/2" />
          <Preview theme="oled" className="w-1/2" />
        </div>
      ) : (
        <Preview theme={id} className="h-9 rounded-sm border" />
      )}
      <div className={`mt-1.5 text-center text-[11px] ${active ? '' : 'text-muted-foreground'}`}>
        {label}
      </div>
    </button>
  );
}

function Preview({ theme, className }: { theme: string; className?: string }) {
  return (
    <div
      data-theme={theme}
      className={`flex flex-col justify-between overflow-hidden p-[5px] ${className ?? ''}`}
      style={{ background: 'var(--background)' }}
    >
      <i className="block h-1 w-[60%] rounded-[2px]" style={{ background: 'var(--primary)' }} />
      <i className="block h-1 w-[85%] rounded-[2px]" style={{ background: 'var(--border)' }} />
      <i className="block h-1 w-[40%] rounded-[2px]" style={{ background: 'var(--border)' }} />
    </div>
  );
}
