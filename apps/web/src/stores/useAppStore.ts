import { create } from 'zustand'

interface AppState {
  isLoading: boolean
  user: {
    id: string
    name: string
    email: string
    role: 'admin' | 'business_owner'
  } | null
  businesses: any[]
  setLoading: (loading: boolean) => void
  setUser: (user: AppState['user']) => void
  clearUser: () => void
  setBusinesses: (businesses: any[]) => void
}

export const useAppStore = create<AppState>((set) => ({
  isLoading: false,
  user: null,
  businesses: [],
  setLoading: (loading) => set({ isLoading: loading }),
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
  setBusinesses: (businesses) => set({ businesses }),
}))