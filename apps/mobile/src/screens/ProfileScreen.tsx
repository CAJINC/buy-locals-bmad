import React from 'react';
import { Box, Text, VStack, HStack, Button, Icon, Divider, ScrollView } from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { navigationService } from '../services/navigationService';
import { useBusinessStore } from '../stores/businessStore';
import { useBusinessManagementPermissions, useCanCreateBusiness } from '../hooks/useBusinessOwnership';

export const ProfileScreen: React.FC = () => {
  const { userBusinesses } = useBusinessStore();
  const { hasBusinesses, ownedBusinesses, canManageBusinesses } = useBusinessManagementPermissions();
  const { canCreate, reason } = useCanCreateBusiness();

  const handleCreateBusiness = () => {
    if (canCreate) {
      navigationService.navigateToBusinessForm();
    } else {
      // Show login prompt or reason
      console.log('Cannot create business:', reason);
    }
  };

  const handleViewBusiness = (businessId: string) => {
    navigationService.navigateToBusinessProfile(businessId);
  };

  return (
    <Box flex={1} bg="white" safeArea>
      <ScrollView>
        <VStack space={6} p={4}>
          {/* Header */}
          <VStack space={2}>
            <Text fontSize="2xl" fontWeight="bold" color="gray.800">
              Profile
            </Text>
            <Text fontSize="md" color="gray.600">
              Manage your account and business listings.
            </Text>
          </VStack>

          <Divider />

          {/* Business Management Section */}
          <VStack space={4}>
            <HStack justifyContent="space-between" alignItems="center">
              <Text fontSize="lg" fontWeight="semibold" color="gray.800">
                My Businesses
              </Text>
              <HStack space={2}>
                {hasBusinesses && (
                  <Button
                    size="sm"
                    colorScheme="green"
                    variant="outline"
                    onPress={() => navigationService.navigateToBusinessDashboard()}
                    leftIcon={<Icon as={MaterialIcons} name="dashboard" size="sm" />}
                  >
                    Dashboard
                  </Button>
                )}
                <Button
                  size="sm"
                  colorScheme="blue"
                  variant="outline"
                  onPress={handleCreateBusiness}
                  isDisabled={!canCreate}
                  leftIcon={<Icon as={MaterialIcons} name="add-business" size="sm" />}
                >
                  Create Business
                </Button>
              </HStack>
            </HStack>

            {hasBusinesses ? (
              <VStack space={3}>
                {ownedBusinesses.map((business) => (
                  <Box
                    key={business.id}
                    bg="gray.50"
                    p={4}
                    borderRadius="lg"
                    borderWidth={1}
                    borderColor="gray.200"
                  >
                    <HStack justifyContent="space-between" alignItems="center">
                      <VStack flex={1}>
                        <Text fontSize="md" fontWeight="medium" color="gray.800">
                          {business.name}
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          {business.location.city}, {business.location.state}
                        </Text>
                        <HStack space={2} mt={1}>
                          {business.categories.slice(0, 2).map((category) => (
                            <Box
                              key={category}
                              bg="blue.100"
                              px={2}
                              py={1}
                              borderRadius="full"
                            >
                              <Text fontSize="xs" color="blue.700">
                                {category}
                              </Text>
                            </Box>
                          ))}
                        </HStack>
                      </VStack>
                      <Button
                        size="sm"
                        variant="ghost"
                        colorScheme="blue"
                        onPress={() => handleViewBusiness(business.id)}
                        rightIcon={<Icon as={MaterialIcons} name="arrow-forward" size="sm" />}
                      >
                        View
                      </Button>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Box
                bg="gray.50"
                p={6}
                borderRadius="lg"
                borderStyle="dashed"
                borderWidth={2}
                borderColor="gray.300"
                alignItems="center"
              >
                <Icon
                  as={MaterialIcons}
                  name="business"
                  size="2xl"
                  color="gray.400"
                  mb={3}
                />
                <Text fontSize="md" fontWeight="medium" color="gray.600" textAlign="center" mb={2}>
                  No businesses yet
                </Text>
                <Text fontSize="sm" color="gray.500" textAlign="center" mb={4}>
                  Create your first business profile to get started
                </Text>
                <Button
                  colorScheme="blue"
                  onPress={handleCreateBusiness}
                  isDisabled={!canCreate}
                  leftIcon={<Icon as={MaterialIcons} name="add" size="sm" />}
                >
                  {canCreate ? "Create Business Profile" : (reason || "Sign in to create business")}
                </Button>
              </Box>
            )}
          </VStack>

          <Divider />

          {/* Account Settings */}
          <VStack space={4}>
            <Text fontSize="lg" fontWeight="semibold" color="gray.800">
              Account Settings
            </Text>
            
            <VStack space={2}>
              <Button
                variant="ghost"
                justifyContent="flex-start"
                leftIcon={<Icon as={MaterialIcons} name="person" size="sm" />}
                rightIcon={<Icon as={MaterialIcons} name="chevron-right" size="sm" />}
              >
                Edit Profile
              </Button>
              
              <Button
                variant="ghost"
                justifyContent="flex-start"
                leftIcon={<Icon as={MaterialIcons} name="notifications" size="sm" />}
                rightIcon={<Icon as={MaterialIcons} name="chevron-right" size="sm" />}
              >
                Notifications
              </Button>
              
              <Button
                variant="ghost"
                justifyContent="flex-start"
                leftIcon={<Icon as={MaterialIcons} name="settings" size="sm" />}
                rightIcon={<Icon as={MaterialIcons} name="chevron-right" size="sm" />}
              >
                Settings
              </Button>
            </VStack>
          </VStack>
        </VStack>
      </ScrollView>
    </Box>
  );
};