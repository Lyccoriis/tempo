import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Switch } from '@/components/ui/switch';
import { APP_COMMANDS, resolveBindings } from '@/lib/commands';
import { bindingFromEvent, formatBinding, isUsableBinding, setCapturing } from '@/lib/keys';
import { useProfileStore } from '@/stores/useProfileStore';
import ResetButton from './ResetButton';
import SettingRow from './SettingRow';
import SettingsGroup from './SettingsGroup';

export default function KeystrokesCard() {
  const config = useProfileStore(s => s.activeConfig);
  const updateConfig = useProfileStore(s => s.updateConfig);
  const [recording, setRecording] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const bindings = resolveBindings(config?.keys);
  const doubleShift = config?.doubleShiftFinder ?? true;
  const bound = APP_COMMANDS.filter(command => bindings[command.id]).length;

  function write(next: Record<string, string>) {
    void updateConfig({ keys: next });
  }

  function assign(commandId: string, binding: string) {
    const next = { ...(config?.keys ?? {}) };

    for (const command of APP_COMMANDS) {
      if (command.id !== commandId && bindings[command.id] === binding) {
        next[command.id] = '';
        toast.info(`${command.label} lost its keystroke`);
      }
    }

    next[commandId] = binding;
    write(next);
  }

  useEffect(() => {
    if (!recording) return;
    const target = recording;
    setCapturing(true);

    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setRecording(null);
        return;
      }

      const binding = bindingFromEvent(e);
      if (!binding) return;

      if (!isUsableBinding(binding)) {
        toast.error('A keystroke needs Ctrl, Alt or Cmd, or a function key');
        return;
      }

      assign(target, binding);
      setRecording(null);
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      setCapturing(false);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  });

  function clear(commandId: string) {
    write({ ...(config?.keys ?? {}), [commandId]: '' });
  }

  function resetAll() {
    write({});
    toast.success('Keystrokes back to defaults');
  }

  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? APP_COMMANDS.filter(command =>
        `${command.label} ${command.hint} ${formatBinding(bindings[command.id]).join(' ')}`
          .toLowerCase()
          .includes(needle),
      )
    : APP_COMMANDS;

  return (
    <>
      <SettingsGroup title="Finder">
        <SettingRow
          title="Double Shift opens the finder"
          description="Two Shift taps in a row, the way IntelliJ does it"
          htmlFor="double-shift"
        >
          <Switch
            id="double-shift"
            checked={doubleShift}
            onCheckedChange={v => void updateConfig({ doubleShiftFinder: v })}
          />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup
        title="Keystrokes"
        description={`${bound} of ${APP_COMMANDS.length} commands bound. Click one and press the keys, Esc cancels.`}
        action={
          <>
            <InputGroup className="h-8 w-[220px]">
              <InputGroupAddon>
                <Search size={15} strokeWidth={1.6} />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Filter commands"
                placeholder="Filter commands"
                value={filter}
                onChange={event => setFilter(event.target.value)}
              />
            </InputGroup>
            <ResetButton
              label="Reset"
              title="Reset every keystroke?"
              description="Every command goes back to its default keys. Commands you unbound get their default back too."
              onReset={resetAll}
            />
          </>
        }
      >
        {shown.length === 0 ? (
          <p className="px-5 py-4 text-[12.5px] text-muted-foreground">No command matches that.</p>
        ) : (
          shown.map(command => (
            <SettingRow key={command.id} title={command.label} description={command.hint}>
              <Recorder
                binding={bindings[command.id]}
                recording={recording === command.id}
                onStart={() => setRecording(command.id)}
                onClear={() => clear(command.id)}
              />
            </SettingRow>
          ))
        )}
      </SettingsGroup>
    </>
  );
}

interface RecorderProps {
  binding: string;
  recording: boolean;
  onStart: () => void;
  onClear: () => void;
}

function Recorder({ binding, recording, onStart, onClear }: RecorderProps) {
  const keys = formatBinding(binding);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={onStart}
        aria-pressed={recording}
        className={`min-w-[140px] justify-center ${recording ? 'border-primary ring-[3px] ring-ring/30' : ''}`}
      >
        {recording ? (
          <span className="text-muted-foreground">Press keys, Esc to cancel</span>
        ) : keys.length ? (
          <KbdGroup>
            {keys.map(key => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </KbdGroup>
        ) : (
          <span className="text-muted-foreground">Not bound</span>
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClear}
        disabled={!binding}
        aria-label="Clear keystroke"
      >
        <X size={15} strokeWidth={1.6} />
      </Button>
    </>
  );
}
