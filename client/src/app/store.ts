import { create } from 'zustand';

interface User {
  name: string;
  email: string;
  telegram_id: string | null;
  telegram_username: string | null;
}

interface AppState {
  user: User | null;
  hasOnboarded: boolean;
  setUser: (user: User) => void;
  setHasOnboarded: (val: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  user: {
    name: 'Alex',
    email: 'alex@example.com',
    telegram_id: null,
    telegram_username: null,
  },
  hasOnboarded: false,
  setUser: (user) => set({ user }),
  setHasOnboarded: (hasOnboarded) => set({ hasOnboarded }),
}));
