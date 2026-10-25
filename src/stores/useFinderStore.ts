import { create } from 'zustand';

interface FinderStore {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useFinderStore = create<FinderStore>(set => ({
  open: false,
  setOpen: open => set({ open }),
  toggle: () => set(s => ({ open: !s.open })),
}));
