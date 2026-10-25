import ColorPicker from '@/components/shared/ColorPicker';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { resolveBackdropSettings, BACKDROP_KNOBS, type BackdropColors, type BackdropSettings, type BackdropStyle } from '@/lib/backdrop';
import Choice from './Choice';
import { Dial, Dials } from './Dials';
import SettingRow from './SettingRow';
import SettingsGroup from './SettingsGroup';
import { useSettings } from './useSettings';

const BALATRO_HINTS: Record<string, string> = {
  pixelSize: 'Size of the liquid field pixels, bigger is coarser',
  frequency: 'Complexity of the liquid folds, higher is busier',
  amplitude: 'Strength of the swirl and liquid deformation',
  speed: 'Speed of the liquid flow and slow rotation',
  colorDrift: 'How quickly related colors flow into each other',
  kickDepth: 'Each kick adds forward rotation without unwinding as it fades',
  chorusDepth: 'Loud parts and choruses add forward rotation',
  noteDepth: 'Each melody note adds forward rotation',
};

export default function BackdropSection() {
  const { get, set } = useSettings();
  const backdrop = resolveBackdropSettings(get('backdrop'));
  const setBackdrop = (patch: Partial<BackdropSettings>) => set({ backdrop: { ...backdrop, ...patch } });

  return (
    <>
      <SettingsGroup title="Backdrop" description="The background behind the whole app">
        <SettingRow title="Backdrop" description="Choose the visual style of your background." htmlFor="backdrop-style">
          <Select value={backdrop.style} onValueChange={style => setBackdrop({ style: style as BackdropStyle })}>
            <SelectTrigger id="backdrop-style" size="sm" className="w-[180px]" aria-label="Backdrop style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ascii">Chromatic ASCII</SelectItem>
              <SelectItem value="classic">Classic Dither</SelectItem>
              <SelectItem value="balatro">Balatro</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          title="Colors"
          description="Where the wave colors come from. Song cover changes them with every song, accent and custom stay put, rainbow cycles through every hue as fast as the song moves."
        >
          <Choice
            label="Backdrop colors"
            value={backdrop.colors}
            onChange={colors => setBackdrop({ colors: colors as BackdropColors })}
            options={[
              ['cover', 'Song cover'],
              ['accent', 'Accent'],
              ['custom', 'Custom'],
              ['rainbow', 'Rainbow'],
            ]}
          />
          {backdrop.colors === 'custom' && (
            <ColorPicker
              label="Backdrop color"
              value={backdrop.color}
              active
              onChange={color => setBackdrop({ color })}
            />
          )}
        </SettingRow>
        <SettingRow title="Mouse Interaction" description="Allow interactive backdrops to respond to pointer movement." htmlFor="backdrop-mouse">
          <Switch id="backdrop-mouse" checked={backdrop.mouseInteraction} onCheckedChange={mouseInteraction => setBackdrop({ mouseInteraction })} />
        </SettingRow>
        <SettingRow
          title="React to music"
          description="Kicks, beats, choruses and the highs move the waves. Off leaves only the colors and the tempo."
          htmlFor="backdrop-react"
        >
          <Switch id="backdrop-react" checked={backdrop.react} onCheckedChange={react => setBackdrop({ react })} />
        </SettingRow>
        <SettingRow
          title="Karaoke line"
          description="The line being sung, at the bottom while only the backdrop shows"
          htmlFor="backdrop-karaoke"
        >
          <Switch
            id="backdrop-karaoke"
            checked={get('backdropKaraoke')}
            onCheckedChange={backdropKaraoke => set({ backdropKaraoke })}
          />
        </SettingRow>
      </SettingsGroup>

      {BACKDROP_KNOBS.map(group => (
        <SettingsGroup key={group.title} title={group.title} description={group.description}>
          <Dials>
            {group.knobs.filter(knob => backdrop.style !== 'balatro' || knob.key !== 'colorNum').map(knob => (
              <Dial
                key={knob.key}
                label={knob.label}
                hint={backdrop.style === 'balatro' ? BALATRO_HINTS[knob.key] ?? knob.hint : knob.hint}
                value={backdrop[knob.key]}
                min={knob.min}
                max={knob.max}
                step={knob.step}
                unit={knob.unit}
                disabled={backdrop.style === 'none' || (group.music && !backdrop.react)}
                onChange={value => setBackdrop({ [knob.key]: value })}
              />
            ))}
          </Dials>
        </SettingsGroup>
      ))}
    </>
  );
}
