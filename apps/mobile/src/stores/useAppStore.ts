import { create } from 'zustand';

interface AppState {
  isLoading: boolean;
  authToken: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  setLoading: (loading: boolean) => void;
  setUser: (user: AppState['user']) => void;
  setAuthToken: (token: string | null) => void;
  clearUser: () => void;
  isUserBusinessOwner: (businessOwnerId: string) => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  isLoading: false,
  authToken: null,
  user: null,
  setLoading: (loading) => set({ isLoading: loading }),
  setUser: (user) => set({ user }),
  setAuthToken: (token) => set({ authToken: token }),
  clearUser: () => set({ user: null, authToken: null }),
  isUserBusinessOwner: (businessOwnerId: string) => {
    const { user } = get();
    return user?.id === businessOwnerId;
  },
}));