import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  ScrollView,
  Divider,
  Heading,
  Badge,
  Icon,
  Pressable,
  useToast,
  Spinner,
  Center,
  Alert,
  RefreshControl,
  Link,
  Flex,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { Linking } from 'react-native';
import { Business } from 'packages/shared/src/types/business';
import { BusinessProfileProps } from './types';
import { BusinessContactInfo } from './BusinessContactInfo';
import { BusinessHoursDisplay } from './BusinessHoursDisplay';
import { BusinessPhotoGallery } from './BusinessPhotoGallery';
import { ShareService } from '../../../services/shareService';

// Enhanced component imports
import { BusinessHeader } from './BusinessHeader';
import { BusinessSocialMedia } from './BusinessSocialMedia';
import { ExpandableText } from './ExpandableText';
import { ServicesCatalog } from './ServicesCatalog';
import { EnhancedService } from './types';

// New enhanced components
import { LocationMap } from './LocationMap';
import { ContactMethods } from './ContactMethods';
import { OptimizedImage } from './OptimizedImage';
import { useResponsiveStyles } from './hooks/useResponsiveDesign';
import { AccessibilityHelper, ScreenReaderOptimizer } from './utils/accessibilityUtils';
import { PerformanceMonitor, ImageOptimizer } from './utils/performanceUtils';

export const BusinessProfile: React.FC<BusinessProfileProps> = React.memo(({
  business,
  showActions = true,
  onEdit,
  onShare,
  onCall,
  onWebsite,
  onGetDirections,
  isLoading = false,
  error = null,
  onRefresh,
}) => {
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const { responsive, styles } = useResponsiveStyles();

  // Performance monitoring
  useEffect(() => {
    if (business) {
      PerformanceMonitor.startMeasure('business_profile_render');
      return () => {
        PerformanceMonitor.endMeasure('business_profile_render');
      };
    }
  }, [business]);

  // Initialize accessibility
  useEffect(() => {
    AccessibilityHelper.initialize();
    return () => {
      AccessibilityHelper.cleanup();
    };
  }, []);

  // Preload images for better performance
  useEffect(() => {
    if (business?.media) {
      const imageUrls = business.media
        .filter(m => m.type === 'photo')
        .slice(0, 3) // Preload first 3 images
        .map(m => m.url);
      
      if (imageUrls.length > 0) {
        ImageOptimizer.preloadImages(imageUrls);
      }
    }
  }, [business?.media]);

  // Memoized computed values for performance
  const logoImage = useMemo(() => 
    business?.media?.find(m => m.type === 'logo'), [business?.media]
  );
  
  const photos = useMemo(() => 
    business?.media?.filter(m => m.type === 'photo') || [], [business?.media]
  );
  
  const displayCategories = useMemo(() => 
    business?.categories?.slice(0, 3) || [], [business?.categories]
  );
  
  const remainingCategoriesCount = useMemo(() => 
    Math.max(0, (business?.categories?.length || 0) - 3), [business?.categories]
  );

  // Transform basic services to enhanced services format
  const enhancedServices = useMemo(() => {
    if (!business?.services) return [];
    
    return business.services.map((service, index) => ({
      id: `${business.id}-service-${index}`,
      name: service.name,
      description: service.description || '',
      category: business.categories[0] || 'General',
      pricing: {
        type: 'exact' as const,
        amount: service.price,
        currency: '$',
      },
      duration: service.duration,
      availability: (service.isActive !== false ? 'available' : 'unavailable') as const,
      bookingEnabled: service.isActive !== false,
      isActive: service.isActive !== false,
    } as EnhancedService));
  }, [business?.services, business?.categories, business?.id]);

  // Memoized event handlers for performance
  const handleGetDirections = useCallback(() => {
    if (!business?.location) return;
    const addressString = `${business.location.address}, ${business.location.city}, ${business.location.state} ${business.location.zipCode}`;
    onGetDirections?.(addressString);
  }, [business?.location, onGetDirections]);

  const handleCall = useCallback(() => {
    if (business?.contact?.phone && onCall) {
      onCall(business.contact.phone);
    }
  }, [business?.contact?.phone, onCall]);

  const handleWebsite = useCallback(() => {
    if (business?.contact?.website && onWebsite) {
      onWebsite(business.contact.website);
    }
  }, [business?.contact?.website, onWebsite]);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const handleShare = useCallback(async () => {
    if (onShare) {
      onShare();
      return;
    }

    // Use built-in share service
    try {
      const success = await ShareService.shareBusiness(business);
      if (success) {
        toast.show({
          title: "Shared successfully",
          description: "Business profile shared!",
          status: "success",
        });
      }
    } catch (error) {
      console.error('Error sharing business:', error);
      toast.show({
        title: "Error",
        description: "Failed to share business profile",
        status: "error",
      });
    }
  }, [business, onShare, toast]);

  // Service handlers
  const handleServicePress = useCallback((service: EnhancedService) => {
    // For now, just show service details in toast
    toast.show({
      title: service.name,
      description: service.description,
      status: "info",
    });
  }, [toast]);

  const handleBookService = useCallback((service: EnhancedService) => {
    // Prepare for future booking integration
    toast.show({
      title: "Booking Coming Soon",
      description: `Book "${service.name}" - Feature coming soon!`,
      status: "info",
    });
  }, [toast]);

  // Loading state
  if (isLoading) {
    return (
      <Center flex={1} bg="white">
        <VStack space={4} alignItems="center">
          <Spinner size="lg" color="blue.500" />
          <Text color="gray.600">Loading business profile...</Text>
        </VStack>
      </Center>
    );
  }

  // Error state
  if (error) {
    return (
      <Center flex={1} bg="white" p={4}>
        <Alert w="100%" status="error">
          <VStack space={2} flexShrink={1} w="100%" alignItems="center">
            <Alert.Icon />
            <Text fontSize="md" fontWeight="medium" color="error.600">
              Failed to load business profile
            </Text>
            <Text fontSize="sm" color="error.500" textAlign="center">
              {error}
            </Text>
            {onRefresh && (
              <Button
                size="sm"
                variant="outline"
                colorScheme="error"
                onPress={handleRefresh}
                mt={2}
              >
                Try Again
              </Button>
            )}
          </VStack>
        </Alert>
      </Center>
    );
  }

  // No business data
  if (!business) {
    return (
      <Center flex={1} bg="white">
        <Text color="gray.500">Business not found</Text>
      </Center>
    );
  }

  return (
    <ScrollView 
      flex={1} 
      bg={responsive.isDark ? 'gray.900' : 'white'}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        ) : undefined
      }
      accessible={true}
      accessibilityLabel={`Business profile for ${business?.name || 'Unknown business'}`}
      accessibilityHint="Scroll to view business information"
    >
      <VStack space={responsive.getSpacing(24)} p={responsive.getSpacing(16)}>
        {/* Enhanced Business Header */}
        <BusinessHeader
          business={{
            name: business.name,
            rating: business.rating,
            reviewCount: business.reviewCount,
            categories: business.categories,
            isVerified: business.isVerified,
            verificationLevel: business.verificationLevel,
          }}
          logoImage={logoImage}
          showVerification={true}
        />

        {/* Enhanced Business Description */}
        {business.description && (
          <VStack space={3}>
            <ExpandableText
              text={business.description}
              maxLines={3}
              showMoreText="Read More"
              showLessText="Read Less"
              fontSize="md"
              color="gray.600"
            />
          </VStack>
        )}

        {/* Action Buttons */}
        {showActions && (
          <HStack space={3} justifyContent="space-around">
            {business.contact.phone && (
              <Button
                variant="solid"
                colorScheme="green"
                leftIcon={<Icon as={MaterialIcons} name="phone" />}
                onPress={handleCall}
                flex={1}
                size="md"
              >
                Call
              </Button>
            )}
            
            <Button
              variant="outline"
              colorScheme="blue"
              leftIcon={<Icon as={MaterialIcons} name="directions" />}
              onPress={handleGetDirections}
              flex={1}
              size="md"
            >
              Directions
            </Button>
            
            <Button
              variant="ghost"
              colorScheme="gray"
              leftIcon={<Icon as={MaterialIcons} name="share" />}
              onPress={handleShare}
              size="md"
            >
              Share
            </Button>
          </HStack>
        )}

        <Divider />

        {/* Enhanced Contact Methods */}
        <VStack space={responsive.getSpacing(16)}>
          <Heading 
            size={responsive.isPhone ? 'md' : 'lg'} 
            color={responsive.isDark ? 'white' : 'gray.800'}
            accessibilityRole="header"
          >
            Contact & Location
          </Heading>
          
          {/* Contact Methods Component */}
          <ContactMethods
            business={business}
            variant={responsive.isPhone ? 'full' : 'grid'}
            showResponseTimes={true}
            showAvailabilityStatus={true}
            showPreferredIndicator={true}
            onContactMethodPress={(method) => {
              AccessibilityHelper.announce(`Opening ${method.label}`);
            }}
          />
          
          <Divider />
          
          {/* Location Map Integration */}
          <LocationMap
            business={business}
            mapHeight={responsive.getValue({
              xs: 180,
              sm: 200,
              md: 220,
              lg: 250,
              xl: 280,
            }) || 200}
            showDirectionsButton={true}
            showAddressCopy={true}
            showParkingInfo={true}
            showAccessibilityInfo={true}
            onDirectionsPress={onGetDirections}
          />
        </VStack>

        <Divider />

        {/* Business Hours */}
        <VStack space={3}>
          <Heading size="md" color="gray.800">
            Hours
          </Heading>
          <BusinessHoursDisplay
            hours={business.hours}
            showCurrentStatus={true}
          />
        </VStack>

        {/* Enhanced Photo Gallery */}
        {photos.length > 0 && (
          <>
            <Divider />
            <VStack space={responsive.getSpacing(12)}>
              <Heading 
                size={responsive.isPhone ? 'md' : 'lg'} 
                color={responsive.isDark ? 'white' : 'gray.800'}
                accessibilityRole="header"
              >
                Photos ({photos.length})
              </Heading>
              <BusinessPhotoGallery 
                media={photos} 
                lazyLoadingEnabled={true}
                enableZoom={!responsive.isReducedMotion}
                enableGestures={!responsive.isReducedMotion}
                cacheEnabled={true}
                preloadCount={responsive.isHighPerformance ? 5 : 3}
                onImagePress={(imageUrl, index) => {
                  const photo = photos[index];
                  const accessibilityLabel = AccessibilityHelper.getPhotoGalleryAccessibilityLabel(
                    photos,
                    index
                  );
                  AccessibilityHelper.announce(accessibilityLabel);
                }}
              />
            </VStack>
          </>
        )}

        {/* Enhanced Services Catalog */}
        {enhancedServices.length > 0 && (
          <>
            <Divider />
            <ServicesCatalog
              services={enhancedServices}
              businessName={business.name}
              onServicePress={handleServicePress}
              onBookService={handleBookService}
              showCategories={true}
              showSearch={enhancedServices.length > 3}
              showAvailabilityFilter={true}
              enableBooking={true}
              isLoading={false}
            />
          </>
        )}

        {/* Edit Button for Owner */}
        {onEdit && (
          <>
            <Divider />
            <Button
              variant="outline"
              colorScheme="blue"
              leftIcon={<Icon as={MaterialIcons} name="edit" />}
              onPress={onEdit}
            >
              Edit Business Profile
            </Button>
          </>
        )}
      </VStack>
    </ScrollView>
  );
};