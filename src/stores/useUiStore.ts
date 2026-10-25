import { create } from 'zustand';

interface UiStore {
  backdropOnly: boolean;
  toggleBackdropOnly: () => void;
  backdropRun: number;
  restartBackdrop: () => void;
  flashRun: number;
  flashBackdrop: () => void;
}

export const useUiStore = create<UiStore>(set => ({
  backdropOnly: false,
  toggleBackdropOnly: () => set(s => ({ backdropOnly: !s.backdropOnly })),
  backdropRun: 0,
  restartBackdrop: () => set(s => ({ backdropRun: s.backdropRun + 1 })),
  flashRun: 0,
  flashBackdrop: () => set(s => ({ flashRun: s.flashRun + 1 })),
}));
