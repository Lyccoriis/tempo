import { Switch } from '@/components/ui/switch';
import { readFade } from '@/lib/equalizer';
import Choice from './Choice';
import SettingRow from './SettingRow';
import SettingsGroup from './SettingsGroup';
import { useSettings } from './useSettings';

export default function MusicSection() {
  const { get, set } = useSettings();
  const fade = readFade(get('musicFade'));

  return (
    <SettingsGroup
      title="Playback"
      description="YouTube Music plays one song at a time, so songs fade out and in rather than overlap"
    >
      <SettingRow
        title="Fade between songs"
        description="Fades a song out over its last seconds, and the next one in when it follows on by itself"
      >
        <Choice
          label="Fade between songs"
          value={String(fade.seconds)}
          onChange={v => set({ musicFade: { ...fade, seconds: Number(v) } })}
          options={[
            ['0', 'Off'],
            ['2', '2s'],
            ['4', '4s'],
            ['6', '6s'],
          ]}
        />
      </SettingRow>
      <SettingRow
        title="Keep albums whole"
        description="No fade between songs that follow each other on the same album"
        htmlFor="fade-albums"
        disabled={!fade.seconds}
      >
        <Switch
          id="fade-albums"
          checked={fade.keepAlbums}
          onCheckedChange={keepAlbums => set({ musicFade: { ...fade, keepAlbums } })}
        />
      </SettingRow>
    </SettingsGroup>
  );
}
