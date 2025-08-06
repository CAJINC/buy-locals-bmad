import React, { useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Icon,
  ScrollView,
  Badge,
  Divider,
  Pressable,
  useToast,
  Center,
  Spinner,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useBusinessStore } from '../stores/businessStore';
import { useBusinessManagementPermissions } from '../hooks/useBusinessOwnership';
import { navigationService } from '../services/navigationService';
import { BusinessCard } from '../components/business/BusinessProfile/BusinessCard';

type BusinessDashboardScreenRouteProp = RouteProp<RootStackParamList, 'BusinessDashboard'>;
type BusinessDashboardScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessDashboard'>;

export const BusinessDashboardScreen: React.FC = () => {
  const navigation = useNavigation<BusinessDashboardScreenNavigationProp>();
  const route = useRoute<BusinessDashboardScreenRouteProp>();
  const toast = useToast();
  
  const { isLoading, getUserBusinesses } = useBusinessStore();
  const { hasBusinesses, ownedBusinesses, businessCount, canManageBusinesses } = useBusinessManagementPermissions();

  useEffect(() => {
    // Load user businesses when screen loads
    if (canManageBusinesses) {
      getUserBusinesses(true); // Force refresh
    }
  }, [canManageBusinesses, getUserBusinesses]);

  const handleCreateBusiness = () => {
    navigationService.navigateToBusinessForm();
  };

  const handleViewBusiness = (businessId: string, business?: any) => {
    navigationService.navigateToBusinessProfile(businessId, business);
  };

  const handleEditBusiness = (businessId: string) => {
    // This would navigate to edit form
    toast.show({
      title: "Edit Business",
      description: "Edit functionality will be implemented",
      status: "info",
    });
  };

  const getBusinessStatusColor = (isActive: boolean) => {
    return isActive ? 'green' : 'orange';
  };

  const getBusinessStatusText = (isActive: boolean) => {
    return isActive ? 'Active' : 'Inactive';
  };

  if (!canManageBusinesses) {
    return (
      <Center flex={1} bg="white" p={6}>
        <VStack space={4} alignItems="center">
          <Icon as={MaterialIcons} name="business" size="6xl" color="gray.400" />
          <Text fontSize="lg" fontWeight="bold" color="gray.800">
            Sign In Required
          </Text>
          <Text fontSize="md" color="gray.600" textAlign="center">
            Please sign in to manage your business listings
          </Text>
          <Button colorScheme="blue" onPress={() => navigation.goBack()}>
            Go Back
          </Button>
        </VStack>
      </Center>
    );
  }

  if (isLoading) {
    return (
      <Center flex={1} bg="white">
        <VStack space={4} alignItems="center">
          <Spinner size="lg" color="blue.500" />
          <Text color="gray.600">Loading your businesses...</Text>
        </VStack>
      </Center>
    );
  }

  return (
    <Box flex={1} bg="white" safeArea>
      <ScrollView>
        <VStack space={6} p={4}>
          {/* Header */}
          <VStack space={2}>
            <HStack justifyContent="space-between" alignItems="center">
              <VStack>
                <Text fontSize="2xl" fontWeight="bold" color="gray.800">
                  Business Dashboard
                </Text>
                <Text fontSize="md" color="gray.600">
                  Manage {businessCount} business{businessCount !== 1 ? 'es' : ''}
                </Text>
              </VStack>
              <Button
                size="sm"
                colorScheme="blue"
                onPress={handleCreateBusiness}
                leftIcon={<Icon as={MaterialIcons} name="add" size="sm" />}
              >
                New Business
              </Button>
            </HStack>
          </VStack>

          <Divider />

          {/* Business Overview */}
          {hasBusinesses ? (
            <VStack space={4}>
              <Text fontSize="lg" fontWeight="semibold" color="gray.800">
                Your Businesses
              </Text>
              
              <VStack space={4}>
                {ownedBusinesses.map((business) => (
                  <Box
                    key={business.id}
                    bg="white"
                    borderWidth={1}
                    borderColor="gray.200"
                    borderRadius="lg"
                    overflow="hidden"
                    shadow={1}
                  >
                    {/* Business Card */}
                    <Box p={4}>
                      <BusinessCard
                        business={business}
                        compact={false}
                        showDistance={false}
                        onPress={() => handleViewBusiness(business.id, business)}
                      />
                    </Box>
                    
                    {/* Status and Actions */}
                    <Box bg="gray.50" px={4} py={3}>
                      <HStack justifyContent="space-between" alignItems="center">
                        <HStack space={3} alignItems="center">
                          <Badge
                            colorScheme={getBusinessStatusColor(business.isActive)}
                            variant="solid"
                          >
                            {getBusinessStatusText(business.isActive)}
                          </Badge>
                          <Text fontSize="xs" color="gray.600">
                            Created {new Date(business.createdAt).toLocaleDateString()}
                          </Text>
                        </HStack>
                        
                        <HStack space={2}>
                          <Button
                            size="xs"
                            variant="outline"
                            colorScheme="blue"
                            onPress={() => handleEditBusiness(business.id)}
                            leftIcon={<Icon as={MaterialIcons} name="edit" size="xs" />}
                          >
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            colorScheme="green"
                            onPress={() => {
                              toast.show({
                                title: "Analytics",
                                description: "Analytics feature coming soon",
                                status: "info",
                              });
                            }}
                            leftIcon={<Icon as={MaterialIcons} name="analytics" size="xs" />}
                          >
                            Analytics
                          </Button>
                        </HStack>
                      </HStack>
                    </Box>
                  </Box>
                ))}
              </VStack>
            </VStack>
          ) : (
            <Center py={8}>
              <VStack space={4} alignItems="center" maxWidth="280px">
                <Icon as={MaterialIcons} name="business" size="6xl" color="gray.400" />
                <Text fontSize="lg" fontWeight="medium" color="gray.600" textAlign="center">
                  No businesses yet
                </Text>
                <Text fontSize="sm" color="gray.500" textAlign="center">
                  Create your first business profile to start building your digital presence
                </Text>
                <Button
                  colorScheme="blue"
                  size="lg"
                  onPress={handleCreateBusiness}
                  leftIcon={<Icon as={MaterialIcons} name="add" size="sm" />}
                >
                  Create Your First Business
                </Button>
              </VStack>
            </Center>
          )}

          <Divider />

          {/* Quick Actions */}
          <VStack space={4}>
            <Text fontSize="lg" fontWeight="semibold" color="gray.800">
              Quick Actions
            </Text>
            
            <VStack space={3}>
              <Pressable
                onPress={handleCreateBusiness}
                _pressed={{ opacity: 0.8 }}
              >
                <HStack
                  space={3}
                  alignItems="center"
                  p={4}
                  bg="blue.50"
                  borderRadius="lg"
                  borderWidth={1}
                  borderColor="blue.100"
                >
                  <Icon as={MaterialIcons} name="add-business" color="blue.600" size="md" />
                  <VStack flex={1}>
                    <Text fontSize="md" fontWeight="medium" color="blue.800">
                      Create New Business
                    </Text>
                    <Text fontSize="sm" color="blue.600">
                      Add another business to your portfolio
                    </Text>
                  </VStack>
                  <Icon as={MaterialIcons} name="chevron-right" color="blue.600" size="sm" />
                </HStack>
              </Pressable>

              <Pressable
                onPress={() => {
                  toast.show({
                    title: "Analytics",
                    description: "Business analytics dashboard coming soon",
                    status: "info",
                  });
                }}
                _pressed={{ opacity: 0.8 }}
              >
                <HStack
                  space={3}
                  alignItems="center"
                  p={4}
                  bg="green.50"
                  borderRadius="lg"
                  borderWidth={1}
                  borderColor="green.100"
                >
                  <Icon as={MaterialIcons} name="trending-up" color="green.600" size="md" />
                  <VStack flex={1}>
                    <Text fontSize="md" fontWeight="medium" color="green.800">
                      View Analytics
                    </Text>
                    <Text fontSize="sm" color="green.600">
                      Track performance across all businesses
                    </Text>
                  </VStack>
                  <Icon as={MaterialIcons} name="chevron-right" color="green.600" size="sm" />
                </HStack>
              </Pressable>

              <Pressable
                onPress={() => {
                  toast.show({
                    title: "Settings",
                    description: "Business settings coming soon",
                    status: "info",
                  });
                }}
                _pressed={{ opacity: 0.8 }}
              >
                <HStack
                  space={3}
                  alignItems="center"
                  p={4}
                  bg="gray.50"
                  borderRadius="lg"
                  borderWidth={1}
                  borderColor="gray.200"
                >
                  <Icon as={MaterialIcons} name="settings" color="gray.600" size="md" />
                  <VStack flex={1}>
                    <Text fontSize="md" fontWeight="medium" color="gray.800">
                      Business Settings
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Manage notifications and preferences
                    </Text>
                  </VStack>
                  <Icon as={MaterialIcons} name="chevron-right" color="gray.600" size="sm" />
                </HStack>
              </Pressable>
            </VStack>
          </VStack>
        </VStack>
      </ScrollView>
    </Box>
  );
};