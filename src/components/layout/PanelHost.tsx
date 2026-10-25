import {
  Activity as Offscreen,
  memo,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from 'react';

import MusicPanel from '@/panels/Music';
import SettingsPanel from '@/panels/Settings';
import { useLayoutStore } from '@/stores/useLayoutStore';
import PanelSkeleton from './PanelSkeleton';
import { PanelVisibleContext } from './panelVisible';
import type { PanelId } from '@/types';

const PANEL_LIST: Array<[PanelId, ComponentType, boolean]> = [
  ['music', MusicPanel, false],
  ['settings', SettingsPanel, true],
];

const PANELS = PANEL_LIST.map(([id, Panel, pausable]) => [id, memo(Panel), pausable] as const);

const SLOW_MS = 100;

function PanelHost() {
  const activePanel = useLayoutStore(s => s.activePanel);

  const shown = useDeferredValue(activePanel);
  const pending = shown !== activePanel;
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  const seen = useRef(new Set<PanelId>());
  seen.current.add(shown);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {pending && slow && <PanelSkeleton />}
      {PANELS.filter(([id]) => seen.current.has(id)).map(([id, Panel, pausable]) => (
        <div
          key={id}
          className={id === shown && !(pending && slow) ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'hidden'}
        >
          <Offscreen mode={id === shown || !pausable ? 'visible' : 'hidden'}>
            <PanelVisibleContext.Provider value={id === shown}>
              <Panel />
            </PanelVisibleContext.Provider>
          </Offscreen>
        </div>
      ))}
    </div>
  );
}

export default memo(PanelHost);
