import { useState, useEffect, useMemo } from 'react';
import { BusinessResponseDto } from '@buy-locals/shared';
import { useAppStore } from '../stores/useAppStore';
import { useBusinessStore } from '../stores/businessStore';

export interface BusinessOwnershipPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canManageMedia: boolean;
  canViewAnalytics: boolean;
  canManageReviews: boolean;
  canUpdateStatus: boolean;
}

export interface BusinessOwnershipData {
  isOwner: boolean;
  isLoading: boolean;
  error: string | null;
  permissions: BusinessOwnershipPermissions;
  business: BusinessResponseDto | null;
  userId: string | null;
}

/**
 * Hook for managing business ownership verification and permissions
 */
export const useBusinessOwnership = (businessId?: string, business?: BusinessResponseDto): BusinessOwnershipData => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedBusiness, setVerifiedBusiness] = useState<BusinessResponseDto | null>(business || null);

  const { user, isUserBusinessOwner } = useAppStore();
  const { getBusiness } = useBusinessStore();

  // Fetch business data if not provided and businessId is available
  useEffect(() => {
    const fetchBusiness = async () => {
      if (!business && businessId && !verifiedBusiness) {
        try {
          setIsLoading(true);
          setError(null);
          const fetchedBusiness = await getBusiness(businessId);
          setVerifiedBusiness(fetchedBusiness);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to fetch business data';
          setError(errorMessage);
          console.error('Error fetching business for ownership verification:', err);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchBusiness();
  }, [businessId, business, verifiedBusiness, getBusiness]);

  // Update verified business when prop changes
  useEffect(() => {
    if (business) {
      setVerifiedBusiness(business);
    }
  }, [business]);

  // Calculate ownership status
  const isOwner = useMemo(() => {
    if (!user || !verifiedBusiness) {
      return false;
    }
    return isUserBusinessOwner(verifiedBusiness.ownerId);
  }, [user, verifiedBusiness, isUserBusinessOwner]);

  // Calculate permissions based on ownership and business status
  const permissions = useMemo((): BusinessOwnershipPermissions => {
    const basePermissions: BusinessOwnershipPermissions = {
      canEdit: false,
      canDelete: false,
      canManageMedia: false,
      canViewAnalytics: false,
      canManageReviews: false,
      canUpdateStatus: false,
    };

    if (!isOwner || !verifiedBusiness) {
      return basePermissions;
    }

    // Owner has full permissions for their business
    return {
      canEdit: true,
      canDelete: true,
      canManageMedia: true,
      canViewAnalytics: true,
      canManageReviews: true,
      canUpdateStatus: true,
    };
  }, [isOwner, verifiedBusiness]);

  return {
    isOwner,
    isLoading,
    error,
    permissions,
    business: verifiedBusiness,
    userId: user?.id || null,
  };
};

/**
 * Hook for verifying ownership of multiple businesses
 */
export const useMultipleBusinessOwnership = (businesses: BusinessResponseDto[]) => {
  const { user, isUserBusinessOwner } = useAppStore();

  return useMemo(() => {
    if (!user) {
      return businesses.map(() => false);
    }

    return businesses.map((business) => isUserBusinessOwner(business.ownerId));
  }, [businesses, user, isUserBusinessOwner]);
};

/**
 * Hook for checking if user can create businesses
 */
export const useCanCreateBusiness = () => {
  const { user } = useAppStore();

  return {
    canCreate: !!user,
    reason: !user ? 'User must be logged in to create businesses' : null,
  };
};

/**
 * Hook for business management permissions
 */
export const useBusinessManagementPermissions = () => {
  const { user } = useAppStore();
  const { userBusinesses } = useBusinessStore();

  const ownedBusinesses = useMemo(() => {
    if (!user) return [];
    return userBusinesses.filter(business => user.id === business.ownerId);
  }, [user, userBusinesses]);

  return {
    hasBusinesses: ownedBusinesses.length > 0,
    businessCount: ownedBusinesses.length,
    ownedBusinesses,
    canManageBusinesses: !!user,
  };
};