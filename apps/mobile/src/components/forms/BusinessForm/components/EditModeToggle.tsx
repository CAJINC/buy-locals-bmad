import React from 'react';
import {
  HStack,
  VStack,
  Box,
  Text,
  Switch,
  Icon,
  Pressable,
  Badge,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';

interface EditModeToggleProps {
  isEditMode: boolean;
  onToggle: (enabled: boolean) => void;
  hasUnsavedChanges?: boolean;
  isDisabled?: boolean;
  title?: string;
  description?: string;
}

export const EditModeToggle: React.FC<EditModeToggleProps> = ({
  isEditMode,
  onToggle,
  hasUnsavedChanges = false,
  isDisabled = false,
  title = "Edit Mode",
  description = "Enable editing to modify business information",
}) => {
  return (
    <Pressable
      onPress={() => !isDisabled && onToggle(!isEditMode)}
      isDisabled={isDisabled}
    >
      <Box
        bg={isEditMode ? "blue.50" : "gray.50"}
        borderWidth={1}
        borderColor={isEditMode ? "blue.200" : "gray.200"}
        borderRadius="lg"
        p={4}
        opacity={isDisabled ? 0.6 : 1}
      >
        <HStack space={3} alignItems="center" justifyContent="space-between">
          {/* Left side: Icon and text */}
          <HStack space={3} alignItems="center" flex={1}>
            <Box
              p={2}
              borderRadius="md"
              bg={isEditMode ? "blue.100" : "gray.100"}
            >
              <Icon
                as={MaterialIcons}
                name={isEditMode ? "edit" : "lock"}
                size="sm"
                color={isEditMode ? "blue.600" : "gray.600"}
              />
            </Box>
            
            <VStack flex={1} space={1}>
              <HStack alignItems="center" space={2}>
                <Text
                  fontSize="md"
                  fontWeight="semibold"
                  color={isEditMode ? "blue.800" : "gray.800"}
                >
                  {title}
                </Text>
                
                {hasUnsavedChanges && (
                  <Badge colorScheme="orange" variant="subtle" rounded="full" size="sm">
                    Unsaved
                  </Badge>
                )}
              </HStack>
              
              <Text
                fontSize="sm"
                color={isEditMode ? "blue.600" : "gray.600"}
                numberOfLines={2}
              >
                {isEditMode 
                  ? "Click fields to edit them. Changes are saved automatically."
                  : description
                }
              </Text>
            </VStack>
          </HStack>

          {/* Right side: Switch */}
          <Switch
            isChecked={isEditMode}
            onToggle={onToggle}
            colorScheme="blue"
            size="md"
            isDisabled={isDisabled}
          />
        </HStack>

        {/* Status indicator */}
        <HStack mt={3} alignItems="center" space={2}>
          <Box
            width={2}
            height={2}
            borderRadius="full"
            bg={isEditMode ? "green.500" : "gray.400"}
          />
          <Text fontSize="xs" color="gray.600">
            {isEditMode ? "Editing enabled" : "View only"}
          </Text>
          
          {isEditMode && (
            <>
              <Text fontSize="xs" color="gray.400">•</Text>
              <Text fontSize="xs" color="blue.600">
                Auto-save active
              </Text>
            </>
          )}
        </HStack>
      </Box>
    </Pressable>
  );
};

// Enhanced edit mode with permissions
interface EnhancedEditModeToggleProps extends EditModeToggleProps {
  userRole?: 'owner' | 'manager' | 'viewer';
  businessStatus?: 'active' | 'pending' | 'suspended';
  showPermissionInfo?: boolean;
}

export const EnhancedEditModeToggle: React.FC<EnhancedEditModeToggleProps> = ({
  userRole = 'owner',
  businessStatus = 'active',
  showPermissionInfo = true,
  ...props
}) => {
  const canEdit = userRole === 'owner' || userRole === 'manager';
  const isBusinessActive = businessStatus === 'active';
  const isDisabled = !canEdit || !isBusinessActive || props.isDisabled;

  const getStatusMessage = (): string => {
    if (!canEdit) {
      return "You don't have permission to edit this business";
    }
    if (!isBusinessActive) {
      return `Business is ${businessStatus} - editing is restricted`;
    }
    return props.description || "Enable editing to modify business information";
  };

  const getPermissionBadge = () => {
    if (!showPermissionInfo) return null;

    const badgeConfig = {
      owner: { text: 'Owner', colorScheme: 'green' },
      manager: { text: 'Manager', colorScheme: 'blue' },
      viewer: { text: 'View Only', colorScheme: 'gray' },
    };

    const config = badgeConfig[userRole];
    return (
      <Badge colorScheme={config.colorScheme} variant="subtle" rounded="full" size="sm">
        {config.text}
      </Badge>
    );
  };

  return (
    <VStack space={2}>
      {showPermissionInfo && (
        <HStack justifyContent="space-between" alignItems="center">
          <Text fontSize="sm" fontWeight="medium" color="gray.700">
            Edit Permissions
          </Text>
          {getPermissionBadge()}
        </HStack>
      )}
      
      <EditModeToggle
        {...props}
        isDisabled={isDisabled}
        description={getStatusMessage()}
      />
      
      {!canEdit && showPermissionInfo && (
        <Box p={3} bg="orange.50" borderRadius="md" borderLeftWidth={3} borderLeftColor="orange.400">
          <HStack space={2} alignItems="center">
            <Icon as={MaterialIcons} name="info" size="sm" color="orange.600" />
            <Text fontSize="xs" color="orange.700" flex={1}>
              Contact the business owner to request editing permissions
            </Text>
          </HStack>
        </Box>
      )}
    </VStack>
  );
};