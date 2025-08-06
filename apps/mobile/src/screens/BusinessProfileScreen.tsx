import React, { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Center,
  Spinner,
  Alert,
  Icon,
  useToast,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { BusinessProfile } from '../components/business/BusinessProfile/BusinessProfile';
import { useBusinessStore } from '../stores/businessStore';
import { Business } from 'packages/shared/src/types/business';
import { Linking, Share } from 'react-native';
import { linkingService } from '../services/linkingService';
import { useBusinessOwnership } from '../hooks/useBusinessOwnership';

type BusinessProfileScreenRouteProp = RouteProp<RootStackParamList, 'BusinessProfile'>;
type BusinessProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessProfile'>;

export const BusinessProfileScreen: React.FC = () => {
  const navigation = useNavigation<BusinessProfileScreenNavigationProp>();
  const route = useRoute<BusinessProfileScreenRouteProp>();
  const { businessId, business: passedBusiness } = route.params;
  const ownership = useBusinessOwnership(businessId, passedBusiness);
  const toast = useToast();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { getBusiness } = useBusinessStore();

  useEffect(() => {
    loadBusiness();
  }, [businessId]);

  const loadBusiness = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use passed business data if available, otherwise fetch
      if (passedBusiness) {
        setBusiness(passedBusiness);
        setLoading(false);
        return;
      }
      
      const businessData = await getBusiness(businessId);
      setBusiness(businessData);
    } catch (err) {
      console.error('Error loading business:', err);
      setError('Failed to load business profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCall = async (phone: string) => {
    try {
      const phoneUrl = `tel:${phone.replace(/\D/g, '')}`;
      const canOpen = await Linking.canOpenURL(phoneUrl);
      
      if (canOpen) {
        await Linking.openURL(phoneUrl);
      } else {
        toast.show({
          title: "Can't make calls",
          description: "Your device doesn't support making phone calls",
          status: "warning",
        });
      }
    } catch (error) {
      console.error('Error opening phone app:', error);
      toast.show({
        title: "Error",
        description: "Failed to open phone app",
        status: "error",
      });
    }
  };

  const handleWebsite = async (url: string) => {
    try {
      // Ensure URL has protocol
      const websiteUrl = url.startsWith('http') ? url : `https://${url}`;
      const canOpen = await Linking.canOpenURL(websiteUrl);
      
      if (canOpen) {
        await Linking.openURL(websiteUrl);
      } else {
        toast.show({
          title: "Can't open website",
          description: "Invalid website URL",
          status: "warning",
        });
      }
    } catch (error) {
      console.error('Error opening website:', error);
      toast.show({
        title: "Error",
        description: "Failed to open website",
        status: "error",
      });
    }
  };

  const handleGetDirections = async (address: string) => {
    try {
      // Try Google Maps first, then Apple Maps
      const encodedAddress = encodeURIComponent(address);
      const googleMapsUrl = `https://maps.google.com/maps?daddr=${encodedAddress}`;
      const appleMapsUrl = `http://maps.apple.com/?daddr=${encodedAddress}`;
      
      let canOpenGoogle = false;
      try {
        canOpenGoogle = await Linking.canOpenURL(googleMapsUrl);
      } catch {}
      
      if (canOpenGoogle) {
        await Linking.openURL(googleMapsUrl);
      } else {
        try {
          const canOpenApple = await Linking.canOpenURL(appleMapsUrl);
          if (canOpenApple) {
            await Linking.openURL(appleMapsUrl);
          } else {
            throw new Error('No maps app available');
          }
        } catch {
          toast.show({
            title: "Can't open maps",
            description: "No compatible maps app found",
            status: "warning",
          });
        }
      }
    } catch (error) {
      console.error('Error opening maps:', error);
      toast.show({
        title: "Error",
        description: "Failed to open directions",
        status: "error",
      });
    }
  };

  const handleShare = async () => {
    if (!business) return;
    
    try {
      const shareUrl = linkingService.generateBusinessProfileUrl(business.id, business.name);
      const shareMessage = `Check out ${business.name} on Buy Locals!\n\n${business.description || ''}\n\n${shareUrl}`;
      
      const result = await Share.share({
        message: shareMessage,
        url: shareUrl,
        title: business.name,
      });

      if (result.action === Share.sharedAction) {
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
  };

  const handleRetry = () => {
    loadBusiness();
  };

  if (loading) {
    return (
      <Center flex={1} bg="white">
        <VStack space={4} alignItems="center">
          <Spinner size="lg" color="blue.500" />
          <Text color="gray.600">Loading business profile...</Text>
        </VStack>
      </Center>
    );
  }

  if (error || !business) {
    return (
      <Center flex={1} bg="white" p={6}>
        <VStack space={6} alignItems="center" maxWidth="300px">
          <Icon
            as={MaterialIcons}
            name="error-outline"
            size="6xl"
            color="red.400"
          />
          
          <VStack space={2} alignItems="center">
            <Text fontSize="lg" fontWeight="bold" color="gray.800" textAlign="center">
              Business Not Found
            </Text>
            <Text fontSize="md" color="gray.600" textAlign="center">
              {error || "The business profile you're looking for doesn't exist or has been removed."}
            </Text>
          </VStack>

          <VStack space={3} width="100%">
            <Button
              colorScheme="blue"
              onPress={handleRetry}
              leftIcon={<Icon as={MaterialIcons} name="refresh" />}
            >
              Try Again
            </Button>
            
            <Button
              variant="ghost"
              colorScheme="gray"
              onPress={() => navigation.goBack()}
            >
              Go Back
            </Button>
          </VStack>
        </VStack>
      </Center>
    );
  }

  const handleEdit = () => {
    if (ownership.permissions.canEdit && business) {
      // Navigate to edit form
      // This would be implemented with the business form in edit mode
      toast.show({
        title: "Edit Business",
        description: "Edit functionality will be implemented",
        status: "info",
      });
    }
  };

  return (
    <Box flex={1} bg="white">
      <BusinessProfile
        business={business}
        showActions={true}
        onEdit={ownership.permissions.canEdit ? handleEdit : undefined}
        onShare={handleShare}
        onCall={handleCall}
        onWebsite={handleWebsite}
        onGetDirections={handleGetDirections}
      />
      
      {/* Owner Actions */}
      {ownership.isOwner && (
        <Box p={4} bg="blue.50" borderTopWidth={1} borderTopColor="blue.100">
          <VStack space={3}>
            <Text fontSize="sm" fontWeight="semibold" color="blue.700">
              Business Owner Actions
            </Text>
            <HStack space={3} flexWrap="wrap">
              {ownership.permissions.canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  colorScheme="blue"
                  flex={1}
                  minW="120px"
                  onPress={handleEdit}
                  leftIcon={<Icon as={MaterialIcons} name="edit" size="sm" />}
                >
                  Edit Profile
                </Button>
              )}
              
              {ownership.permissions.canViewAnalytics && (
                <Button
                  size="sm"
                  variant="outline"
                  colorScheme="green"
                  flex={1}
                  minW="120px"
                  onPress={() => {
                    toast.show({
                      title: "Analytics",
                      description: "Analytics feature coming soon",
                      status: "info",
                    });
                  }}
                  leftIcon={<Icon as={MaterialIcons} name="analytics" size="sm" />}
                >
                  Analytics
                </Button>
              )}
            </HStack>
          </VStack>
        </Box>
      )}
    </Box>
  );
};