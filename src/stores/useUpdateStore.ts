import { create } from 'zustand';

import type { UpdateState } from '@/types';

const EMPTY: UpdateState = {
  stage: 'idle',
  version: '',
  currentVersion: '',
  notes: '',
  percent: 0,
  message: '',
  supported: false,
  checkedAt: '',
};

interface UpdateStore {
  state: UpdateState;
  announce: boolean;
  start: () => () => void;
  check: () => Promise<void>;
  install: () => void;
}

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  state: EMPTY,
  announce: false,

  start: () => {
    window.api.update
      .state()
      .then(state => set({ state }))
      .catch(err => console.error('[useUpdateStore] state:', err));
    return window.api.update.onState(state => set({ state }));
  },

  check: async () => {
    set({ announce: true });
    try {
      set({ state: await window.api.update.check() });
    } catch (err) {
      set({
        state: { ...get().state, stage: 'error', message: err instanceof Error ? err.message : String(err) },
      });
    }
  },

  install: () => {
    const { state } = get();
    if (state.stage !== 'ready') return;
    set({ state: { ...state, stage: 'restarting' } });
    window.api.update.install();
  },
}));
