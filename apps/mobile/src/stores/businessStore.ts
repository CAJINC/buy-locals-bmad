import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { BusinessResponseDto } from '@buy-locals/shared';
import { businessService, BusinessFormData } from '../services/businessService';

interface BusinessCache {
  [businessId: string]: {
    data: BusinessResponseDto;
    timestamp: number;
    lastFetch: number;
  };
}

interface BusinessState {
  // Current business being edited/created
  currentBusiness: BusinessResponseDto | null;
  isLoading: boolean;
  error: string | null;
  
  // Form draft state for persistence
  formDraft: Partial<BusinessFormData> | null;
  
  // Caching and synchronization
  businessCache: BusinessCache;
  lastSync: number | null;
  syncInProgress: boolean;
  
  // User's businesses
  userBusinesses: BusinessResponseDto[];
  
  // Actions
  createBusiness: (businessData: BusinessFormData) => Promise<BusinessResponseDto>;
  updateBusiness: (businessId: string, updates: Partial<BusinessFormData>) => Promise<BusinessResponseDto>;
  getBusiness: (businessId: string, forceRefresh?: boolean) => Promise<BusinessResponseDto>;
  getUserBusinesses: (forceRefresh?: boolean) => Promise<BusinessResponseDto[]>;
  clearCurrentBusiness: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  
  // Caching management
  invalidateCache: (businessId?: string) => void;
  syncBusinesses: () => Promise<void>;
  
  // Draft management
  saveDraft: (draft: Partial<BusinessFormData>) => void;
  clearDraft: () => void;
  loadDraft: () => Partial<BusinessFormData> | null;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export const useBusinessStore = create<BusinessState>()(
  persist(
    (set, get) => ({
      currentBusiness: null,
      isLoading: false,
      error: null,
      formDraft: null,
      businessCache: {},
      lastSync: null,
      syncInProgress: false,
      userBusinesses: [],

  createBusiness: async (businessData: BusinessFormData) => {
    set({ isLoading: true, error: null });
    
    try {
      const business = await businessService.createBusiness(businessData);
      set({ 
        currentBusiness: business, 
        isLoading: false,
        formDraft: null // Clear draft after successful creation
      });
      return business;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create business';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  updateBusiness: async (businessId: string, updates: Partial<BusinessFormData>) => {
    set({ isLoading: true, error: null });
    
    try {
      const business = await businessService.updateBusiness(businessId, updates);
      set({ 
        currentBusiness: business, 
        isLoading: false 
      });
      return business;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update business';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  getBusiness: async (businessId: string, forceRefresh = false) => {
    const { businessCache } = get();
    const now = Date.now();
    
    // Check cache first unless force refresh is requested
    if (!forceRefresh && businessCache[businessId]) {
      const cachedBusiness = businessCache[businessId];
      const isStale = now - cachedBusiness.lastFetch > CACHE_DURATION;
      
      if (!isStale) {
        set({ currentBusiness: cachedBusiness.data, isLoading: false, error: null });
        return cachedBusiness.data;
      }
    }
    
    set({ isLoading: true, error: null });
    
    try {
      const business = await businessService.getBusiness(businessId);
      
      // Update cache
      const updatedCache = {
        ...businessCache,
        [businessId]: {
          data: business,
          timestamp: now,
          lastFetch: now,
        },
      };
      
      set({ 
        currentBusiness: business, 
        businessCache: updatedCache,
        isLoading: false 
      });
      return business;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch business';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  getUserBusinesses: async (forceRefresh = false) => {
    const { userBusinesses, lastSync } = get();
    const now = Date.now();
    
    // Check if we need to refresh
    if (!forceRefresh && userBusinesses.length > 0 && lastSync) {
      const isStale = now - lastSync > CACHE_DURATION;
      if (!isStale) {
        return userBusinesses;
      }
    }
    
    set({ isLoading: true, error: null });
    
    try {
      // This would be a new endpoint to get user's businesses
      const businesses = await businessService.getUserBusinesses();
      
      set({ 
        userBusinesses: businesses,
        lastSync: now,
        isLoading: false 
      });
      return businesses;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch user businesses';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  clearCurrentBusiness: () => {
    set({ currentBusiness: null, error: null });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  invalidateCache: (businessId?: string) => {
    const { businessCache } = get();
    
    if (businessId) {
      // Invalidate specific business
      const updatedCache = { ...businessCache };
      delete updatedCache[businessId];
      set({ businessCache: updatedCache });
    } else {
      // Invalidate all cache
      set({ 
        businessCache: {},
        lastSync: null,
        userBusinesses: []
      });
    }
  },

  syncBusinesses: async () => {
    const { syncInProgress } = get();
    
    if (syncInProgress) {
      return; // Prevent concurrent syncs
    }
    
    set({ syncInProgress: true });
    
    try {
      // Sync user's businesses
      await get().getUserBusinesses(true);
      
      set({ 
        syncInProgress: false,
        lastSync: Date.now()
      });
    } catch (error) {
      console.error('Business sync failed:', error);
      set({ syncInProgress: false });
    }
  },

  saveDraft: (draft: Partial<BusinessFormData>) => {
    set({ formDraft: draft });
    // Also save to AsyncStorage for persistence across app restarts
    // TODO: Implement AsyncStorage persistence
  },

  clearDraft: () => {
    set({ formDraft: null });
    // TODO: Clear from AsyncStorage
  },

  loadDraft: () => {
    const { formDraft } = get();
    return formDraft;
  },
    }),
    {
      name: 'business-store',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          // Mock AsyncStorage for now - replace with actual AsyncStorage in production
          const item = localStorage?.getItem(name);
          return item ? JSON.parse(item) : null;
        },
        setItem: (name, value) => {
          localStorage?.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage?.removeItem(name);
        },
      })),
      partialize: (state) => ({
        // Only persist certain parts of the state
        formDraft: state.formDraft,
        businessCache: state.businessCache,
        userBusinesses: state.userBusinesses,
        lastSync: state.lastSync,
      }),
    }
  )
);