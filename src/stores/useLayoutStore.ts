import { create } from 'zustand';
import type {
  LayoutState,
  PanelId,
  SettingsSection,
  SidebarState,
} from '@/types';
import { useProfileStore } from '@/stores/useProfileStore';

export const DEFAULT_LAYOUT: LayoutState = {
  activePanel: 'music',
  navSidebar: { mode: 'retracted', width: 240 },
  settingsSection: 'appearance',
  music: null,
};

interface LayoutStore extends LayoutState {
  hydrated: boolean;

  setActivePanel: (id: PanelId) => void;
  goBack: () => void;
  goForward: () => void;
  setNavSidebar: (patch: Partial<SidebarState>) => void;
  setSettingsSection: (section: SettingsSection) => void;
  setMusic: (music: LayoutState['music']) => void;

  hydrate: (layout: Partial<LayoutState> | null) => void;
  loadLayout: (profileId: string) => Promise<void>;
  flush: () => Promise<void>;
}

function snapshot(state: LayoutStore): LayoutState {
  return {
    activePanel: state.activePanel,
    navSidebar: state.navSidebar,
    settingsSection: state.settingsSection,
    music: state.music,
  };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function writeLayout(): Promise<void> {
  const profileId = useProfileStore.getState().activeProfileId;
  if (!profileId) return;
  try {
    await window.api.profile.saveLayout(profileId, snapshot(useLayoutStore.getState()));
  } catch (err) {
    console.error('[useLayoutStore] saveLayout failed:', err);
  }
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void writeLayout();
  }, 300);
}

let backStack: PanelId[] = [];
let forwardStack: PanelId[] = [];

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  ...DEFAULT_LAYOUT,
  hydrated: false,

  setActivePanel: id => {
    const current = get().activePanel;
    if (current === id) return;
    backStack.push(current);
    if (backStack.length > 50) backStack.shift();
    forwardStack = [];
    set({ activePanel: id });
    scheduleSave();
  },

  goBack: () => {
    const current = get().activePanel;
    const target = backStack.pop();
    if (target === undefined || target === current) return;
    forwardStack.push(current);
    set({ activePanel: target });
    scheduleSave();
  },

  goForward: () => {
    const current = get().activePanel;
    const target = forwardStack.pop();
    if (target === undefined || target === current) return;
    backStack.push(current);
    set({ activePanel: target });
    scheduleSave();
  },

  setNavSidebar: patch => {
    set(s => ({ navSidebar: { ...s.navSidebar, ...patch } }));
    scheduleSave();
  },

  setSettingsSection: section => {
    if (get().settingsSection === section) return;
    set({ settingsSection: section });
    scheduleSave();
  },

  setMusic: music => {
    set({ music });
    scheduleSave();
  },

  hydrate: layout => {
    const next = { ...DEFAULT_LAYOUT, ...(layout ?? {}) };
    if (next.activePanel !== 'music' && next.activePanel !== 'settings') {
      next.activePanel = DEFAULT_LAYOUT.activePanel;
    }
    backStack = [];
    forwardStack = [];
    set({ ...next, hydrated: true });
  },

  loadLayout: async profileId => {
    try {
      const layout = (await window.api.profile.getLayout(profileId)) as Partial<LayoutState> | null;
      get().hydrate(layout);
    } catch (err) {
      console.error('[useLayoutStore] loadLayout failed:', err);
      get().hydrate(null);
    }
  },

  flush: async () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    await writeLayout();
  },
}));
