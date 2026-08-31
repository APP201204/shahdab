import { create } from "zustand";

interface AppState {
  // TODO: add runtime state for auth, selected outlet, active orders, etc.
}

export const useAppStore = create<AppState>(() => ({}));
