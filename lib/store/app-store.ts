import { create } from "zustand";

type AppState = {
  dataEpoch: number;
  bumpDataEpoch: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  dataEpoch: 0,
  bumpDataEpoch: () => set((s) => ({ dataEpoch: s.dataEpoch + 1 })),
}));
