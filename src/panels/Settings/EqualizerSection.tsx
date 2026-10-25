import { useMemo, useState } from 'react';
import { RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import CometDial from '@/components/reactbits/CometDial';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent } from '@/components/ui/item';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  EQ_BANDS,
  EQ_PRESETS,
  EQ_RANGE,
  EQ_STEP,
  bandLabel,
  OWN_BANDS,
  eqResponse,
  eqSound,
  genrePreset,
  readEq,
  type EqManual,
  type EqPreset,
  type MusicEq,
} from '@/lib/equalizer';
import { cn } from '@/lib/utils';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useMusicStore } from '@/stores/useMusicStore';
import EqGraph from './EqGraph';
import { Dials } from './Dials';
import SettingRow from './SettingRow';
import SettingsGroup from './SettingsGroup';
import { useSettings } from './useSettings';

const CUSTOM = 'custom';
const PEAK_FREQS = Array.from({ length: 120 }, (_, i) => 20 * Math.pow(1000, i / 119));

function signed(db: number): string {
  return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
}

export default function EqualizerSection() {
  const { get, set } = useSettings();
  const saved = readEq(get('musicEq'));
  const presets = get('musicEqPresets');
  const musicStarted = useMusicStore(s => s.state !== null);
  const onScreen = useLayoutStore(s => s.activePanel === 'settings' && s.settingsSection === 'equalizer');

  const [draft, setDraft] = useState<MusicEq | null>(null);
  const eq = draft ?? saved;
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const autoEq = useMusicStore(s => s.autoEq);
  const videoId = useMusicStore(s => s.state?.videoId ?? '');
  const eqManual = useMusicStore(s => s.eqManual);
  const setEqManual = useMusicStore(s => s.setEqManual);
  const [manualDraft, setManualDraft] = useState<EqManual | null>(null);

  const allPresets = [...EQ_PRESETS, ...presets];
  const autoOn = eq.enabled && eq.auto;
  const autoPreset = autoOn ? autoEq?.preset || null : null;
  const forSong = autoOn && !!videoId && !!autoEq;
  const manual = forSong ? (manualDraft ?? (eqManual?.videoId === videoId ? eqManual : null)) : null;
  const shown: MusicEq = { ...eq, ...eqSound(eq, presets, autoPreset, manual) };
  const peak = useMemo(() => Math.max(...eqResponse(shown, PEAK_FREQS)), [shown.gains, shown.preamp, shown.q]);
  const selected = !forSong ? eq.preset : manual ? manual.preset : autoPreset !== OWN_BANDS ? autoPreset : eq.preset;
  const current = allPresets.find(p => p.id === selected);
  const own = presets.find(p => p.id === selected);

  function hear(next: MusicEq, song: EqManual | null = manual) {
    window.api.ytmusic
      .eq(eqSound(next, presets, autoPreset, song))
      .catch(err => console.error('[Settings] equalizer failed:', err));
  }

  function change(patch: Partial<MusicEq>, done: boolean) {
    const next = { ...eq, ...patch };
    if (done) {
      setDraft(null);
      set({ musicEq: next });
    } else {
      setDraft(next);
      hear(next);
    }
  }

  function changeSound(patch: Partial<Pick<MusicEq, 'preset' | 'preamp' | 'gains'>>, done: boolean) {
    if (!forSong) return change(patch, done);
    const song: EqManual = {
      videoId,
      preset: patch.preset ?? '',
      preamp: patch.preamp ?? shown.preamp,
      gains: patch.gains ?? shown.gains,
    };
    if (done) {
      setManualDraft(null);
      setEqManual(song);
    } else {
      setManualDraft(song);
      hear(eq, song);
    }
  }

  function setBand(index: number, gain: number, done: boolean) {
    const gains = shown.gains.map((g, i) => (i === index ? gain : g));
    changeSound({ gains, preset: '' }, done);
  }

  function pickPreset(id: string) {
    const preset = allPresets.find(p => p.id === id);
    if (!preset) return;
    changeSound({ preset: preset.id, preamp: preset.preamp, gains: EQ_BANDS.map((_, i) => preset.gains[i] ?? 0) }, true);
  }

  function savePreset() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const same = presets.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
    const preset: EqPreset = { id: same?.id ?? `own-${Date.now()}`, name: trimmed, preamp: shown.preamp, gains: [...shown.gains] };
    const musicEqPresets = same ? presets.map(p => (p.id === same.id ? preset : p)) : [...presets, preset];
    if (forSong) {
      set({ musicEqPresets });
      setEqManual({ videoId, preset: preset.id, preamp: preset.preamp, gains: preset.gains });
    } else {
      set({ musicEqPresets, musicEq: { ...eq, preset: preset.id } });
    }
    setSaving(false);
    toast.success(same ? `Preset ${trimmed} updated` : `Preset ${trimmed} saved`);
  }

  function deletePreset() {
    if (!own) return;
    set({
      musicEqPresets: presets.filter(p => p.id !== own.id),
      musicEq: { ...eq, preset: eq.preset === own.id ? '' : eq.preset },
    });
    if (manual?.preset === own.id) setEqManual({ ...manual, preset: '' });
    toast.success(`Preset ${own.name} deleted`);
  }

  const off = !eq.enabled;

  function nameOf(id: string): string {
    return !id || id === OWN_BANDS ? 'Your bands' : (allPresets.find(p => p.id === id)?.name ?? id);
  }

  let status = 'Waiting for a song';
  let detected = 'Nothing yet';
  let using = nameOf(eq.preset);
  if (autoEq?.looking) {
    status = 'Looking up the genre';
    detected = 'Looking';
    using = `${nameOf(autoEq.preset)}, kept from the last song`;
  } else if (autoEq) {
    status = 'On';
    detected = !autoEq.genre ? 'Not found' : genrePreset(autoEq.genre) ? autoEq.genre : `${autoEq.genre}, no preset for it`;
    using = genrePreset(autoEq.genre) ? nameOf(autoEq.preset) : `${nameOf(autoEq.preset)}, the fallback`;
  }
  if (manual) {
    status = 'Manual for this song';
    using = manual.preset ? `${nameOf(manual.preset)}, picked for this song` : 'Your changes, for this song';
  }

  return (
    <>
      {!musicStarted && (
        <Alert>
          <AlertTitle>Music has not started yet</AlertTitle>
          <AlertDescription>
            The equalizer runs inside the YouTube Music page, which loads the first time the Music panel opens. Changes
            made here are kept and apply once it has.
          </AlertDescription>
        </Alert>
      )}

      <SettingsGroup title="Sound" description="Shapes YouTube Music before it reaches your speakers">
        <SettingRow
          title="Equalizer"
          description="Off leaves every song the way YouTube Music plays it"
          htmlFor="eq-enabled"
        >
          <Switch id="eq-enabled" checked={eq.enabled} onCheckedChange={enabled => change({ enabled }, true)} />
        </SettingRow>
        <SettingRow
          title="Auto EQ"
          description="Looks up each song's genre from its title and artist on the iTunes Search API and picks a preset to match"
          htmlFor="eq-auto"
          disabled={off}
        >
          <Switch id="eq-auto" checked={eq.auto} onCheckedChange={auto => change({ auto }, true)} />
        </SettingRow>
        {autoOn && (
          <Item size="sm" className="rounded-none px-5 py-3 last:rounded-b-xl">
            <ItemContent>
              <dl className="grid grid-cols-[80px_minmax(0,1fr)] gap-x-4 gap-y-1 text-[12px]">
                <dt className="text-muted-foreground">Status</dt>
                <dd className={cn(autoEq?.looking && 'text-muted-foreground')}>{status}</dd>
                <dt className="text-muted-foreground">Detected</dt>
                <dd className="truncate">{detected}</dd>
                <dt className="text-muted-foreground">Using</dt>
                <dd className="truncate">{using}</dd>
              </dl>
            </ItemContent>
            {manual && (
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => setEqManual(null)}>
                  <RotateCcw size={15} strokeWidth={1.6} />
                  Back to auto
                </Button>
              </ItemActions>
            )}
          </Item>
        )}
        <SettingRow
          title="When no genre is found"
          description="What auto EQ plays when a song's genre cannot be found or has no preset"
          disabled={!autoOn}
        >
          <Select value={eq.autoFallback} onValueChange={autoFallback => change({ autoFallback }, true)}>
            <SelectTrigger size="sm" className="w-[180px]" aria-label="When no genre is found">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={OWN_BANDS}>Your bands</SelectItem>
              <SelectSeparator />
              {allPresets.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          title="Preset"
          description={
            forSong
              ? 'Auto EQ picks one for each song, a preset picked here holds for this song only'
              : 'A starting point, moving any band turns it into your own'
          }
          disabled={off}
        >
          <Select value={current ? current.id : CUSTOM} onValueChange={pickPreset}>
            <SelectTrigger size="sm" className="w-[180px]" aria-label="Preset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!current && <SelectItem value={CUSTOM}>Custom</SelectItem>}
              <SelectGroup>
                <SelectLabel>Built in</SelectLabel>
                {EQ_PRESETS.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectGroup>
              {presets.length > 0 && (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Saved</SelectLabel>
                    {presets.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </>
              )}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setName(own?.name ?? '');
              setSaving(true);
            }}
          >
            <Save size={15} strokeWidth={1.6} />
            Save preset
          </Button>
          {own && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Delete preset ${own.name}`} title="Delete preset">
                  <Trash2 size={15} strokeWidth={1.6} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {own.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The preset is removed from this profile. The bands stay where they are.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={deletePreset}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </SettingRow>
        <SettingRow
          title="Limiter"
          description="Holds loud peaks under 0 dB so boosted bands do not crackle"
          htmlFor="eq-limiter"
          disabled={off}
        >
          <Switch id="eq-limiter" checked={eq.limiter} onCheckedChange={limiter => change({ limiter }, true)} />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup
        title="Frequency response"
        description={
          peak > 0.05 && !eq.limiter
            ? `Peaks at ${signed(peak)}, turn the preamp down or the limiter on to keep it from clipping`
            : forSong
              ? `Peaks at ${signed(peak)}. Auto EQ is shaping this song, a point moved here holds for this song only.`
              : `Peaks at ${signed(peak)}. Drag a point to move its band, double click to put it back to 0.`
        }
        action={
          <Button variant="outline" size="sm" disabled={off} onClick={() => pickPreset('flat')}>
            <RotateCcw size={15} strokeWidth={1.6} />
            Flat
          </Button>
        }
      >
        <div className="px-5 py-4">
          <EqGraph eq={shown} disabled={off} live={onScreen} onBand={setBand} />
        </div>
      </SettingsGroup>

      <SettingsGroup title="Bands" description={`Ten bands, each ${EQ_RANGE} dB up or down. The lowest and highest are shelves.`}>
        <div className="flex flex-wrap justify-center gap-2 px-5 py-4">
          {EQ_BANDS.map((hz, i) => (
            <Knob
              key={hz}
              label={`${bandLabel(hz)}Hz`}
              value={shown.gains[i]}
              min={-EQ_RANGE}
              max={EQ_RANGE}
              step={EQ_STEP}
              unit="dB"
              size={72}
              disabled={off}
              onChange={(v, done) => setBand(i, v, done)}
            />
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup title="Output" description="The whole signal, before and after the bands">
        <Dials>
          <Knob
            label="Preamp"
            hint="Turns everything up or down before the bands, lower it if boosts clip"
            value={shown.preamp}
            min={-EQ_RANGE}
            max={EQ_RANGE}
            step={EQ_STEP}
            unit="dB"
            size={96}
            disabled={off}
            onChange={(preamp, done) => changeSound({ preamp, preset: '' }, done)}
          />
          <Knob
            label="Band width"
            hint="How wide each band reaches, higher is narrower and more precise"
            value={eq.q}
            min={0.5}
            max={4}
            step={0.05}
            unit="Q"
            size={96}
            disabled={off}
            onChange={(q, done) => change({ q }, done)}
          />
          <Knob
            label="Balance"
            hint="Left or right speaker louder"
            value={Math.round(eq.balance * 100)}
            min={-100}
            max={100}
            step={1}
            unit={eq.balance < 0 ? 'L' : eq.balance > 0 ? 'R' : ''}
            size={96}
            disabled={off}
            onChange={(v, done) => change({ balance: v / 100 }, done)}
          />
        </Dials>
      </SettingsGroup>

      <Dialog open={saving} onOpenChange={setSaving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save preset</DialogTitle>
            <DialogDescription>Keeps the ten bands and the preamp under a name, in this profile.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="eq-preset-name">Name</FieldLabel>
            <Input
              id="eq-preset-name"
              autoFocus
              value={name}
              placeholder="My headphones"
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && savePreset()}
            />
            <FieldDescription>A saved preset with the same name is replaced.</FieldDescription>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaving(false)}>
              Cancel
            </Button>
            <Button disabled={!name.trim()} onClick={savePreset}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Knob({
  label,
  hint,
  value,
  min,
  max,
  step,
  unit,
  size,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  size: number;
  disabled: boolean;
  onChange: (value: number, done: boolean) => void;
}) {
  return (
    <div className={`flex flex-col items-center gap-1.5 text-center ${hint ? 'w-[124px]' : ''}`}>
      <CometDial
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        unit={unit}
        size={size}
        disabled={disabled}
        onChange={next => onChange(next, false)}
        onChangeEnd={next => onChange(next, true)}
      />
      <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
      {hint && <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>}
    </div>
  );
}
