import { RefreshCw, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useUpdateStore } from '@/stores/useUpdateStore';
import type { UpdateState } from '@/types';
import SettingRow from './SettingRow';
import SettingsGroup from './SettingsGroup';

function statusText(state: UpdateState): string {
  if (!state.supported) return 'Updates run in the installed build, not in dev or the portable copy';
  switch (state.stage) {
    case 'checking':
      return 'Looking for a newer build';
    case 'downloading':
      return `Downloading ${state.version}`;
    case 'ready':
      return `Version ${state.version} is downloaded, restart to install it`;
    case 'restarting':
      return `Installing ${state.version}`;
    case 'error':
      return state.message || 'Could not reach the update feed';
    case 'none':
      return 'This is the latest version';
    default:
      return 'Checked on launch and every 30 minutes, downloads on its own';
  }
}

export default function UpdateCard() {
  const state = useUpdateStore(s => s.state);
  const check = useUpdateStore(s => s.check);
  const install = useUpdateStore(s => s.install);

  const busy = state.stage === 'checking' || state.stage === 'downloading' || state.stage === 'restarting';

  return (
    <SettingsGroup title="Updates">
      <SettingRow title={`Version ${state.currentVersion}`} description={statusText(state)}>
        {state.stage === 'ready' ? (
          <Button size="sm" onClick={install}>
            <RotateCw size={15} strokeWidth={1.6} />
            Restart to update
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled={busy || !state.supported} onClick={() => void check()}>
            <RefreshCw size={15} strokeWidth={1.6} className={busy ? 'animate-spin' : undefined} />
            {state.stage === 'checking' ? 'Checking' : 'Check for updates'}
          </Button>
        )}
      </SettingRow>

      {state.stage === 'downloading' && (
        <SettingRow title="Progress" description={`${state.percent}% of the update`}>
          <Progress value={state.percent} className="h-1.5 w-[280px]" />
        </SettingRow>
      )}

      {state.notes && (state.stage === 'downloading' || state.stage === 'ready') && (
        <SettingRow title="What changed" description={state.notes}>
          <span />
        </SettingRow>
      )}
    </SettingsGroup>
  );
}
