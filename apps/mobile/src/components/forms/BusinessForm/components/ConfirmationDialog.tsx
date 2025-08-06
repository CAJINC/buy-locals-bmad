import React from 'react';
import {
  AlertDialog,
  Button,
  Text,
  VStack,
  HStack,
  Icon,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  isLoading = false,
}) => {
  const cancelRef = React.useRef(null);

  const getTypeConfig = () => {
    switch (type) {
      case 'danger':
        return {
          iconName: 'warning' as const,
          iconColor: 'red.500',
          confirmColorScheme: 'red',
        };
      case 'warning':
        return {
          iconName: 'warning' as const,
          iconColor: 'orange.500',
          confirmColorScheme: 'orange',
        };
      case 'info':
        return {
          iconName: 'info' as const,
          iconColor: 'blue.500',
          confirmColorScheme: 'blue',
        };
      default:
        return {
          iconName: 'warning' as const,
          iconColor: 'orange.500',
          confirmColorScheme: 'orange',
        };
    }
  };

  const config = getTypeConfig();

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
      motionPreset="fade"
    >
      <AlertDialog.Content>
        <AlertDialog.Body>
          <VStack space={4} alignItems="center">
            {/* Icon */}
            <Icon
              as={MaterialIcons}
              name={config.iconName}
              size="4xl"
              color={config.iconColor}
            />

            {/* Title */}
            <Text fontSize="lg" fontWeight="bold" textAlign="center" color="gray.800">
              {title}
            </Text>

            {/* Message */}
            <Text fontSize="md" textAlign="center" color="gray.600">
              {message}
            </Text>
          </VStack>
        </AlertDialog.Body>

        <AlertDialog.Footer>
          <HStack space={3} width="100%" justifyContent="center">
            <Button
              variant="ghost"
              colorScheme="gray"
              onPress={onClose}
              ref={cancelRef}
              isDisabled={isLoading}
              flex={1}
            >
              {cancelText}
            </Button>
            
            <Button
              colorScheme={config.confirmColorScheme}
              onPress={onConfirm}
              isLoading={isLoading}
              loadingText="Please wait..."
              flex={1}
            >
              {confirmText}
            </Button>
          </HStack>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
};

// Predefined dialog configurations for common actions
export const DialogConfigs = {
  CANCEL_FORM: {
    title: 'Cancel Business Registration?',
    message: 'Your progress will be saved as a draft. You can continue later from where you left off.',
    confirmText: 'Yes, Cancel',
    cancelText: 'Keep Editing',
    type: 'warning' as const,
  },
  
  DELETE_DRAFT: {
    title: 'Delete Draft?',
    message: 'This will permanently delete your saved progress. This action cannot be undone.',
    confirmText: 'Delete Draft',
    cancelText: 'Keep Draft',
    type: 'danger' as const,
  },
  
  DISCARD_CHANGES: {
    title: 'Discard Changes?',
    message: 'You have unsaved changes. Are you sure you want to discard them?',
    confirmText: 'Discard',
    cancelText: 'Keep Editing',
    type: 'warning' as const,
  },
  
  NAVIGATE_AWAY: {
    title: 'Leave This Step?',
    message: 'You have unsaved changes on this step. Your progress will be saved as a draft.',
    confirmText: 'Continue',
    cancelText: 'Stay Here',
    type: 'info' as const,
  },
  
  SUBMIT_INCOMPLETE: {
    title: 'Submit Incomplete Form?',
    message: 'Some fields are still empty. You can submit now and complete them later, or continue editing.',
    confirmText: 'Submit Anyway',
    cancelText: 'Continue Editing',
    type: 'warning' as const,
  },
  
  DELETE_BUSINESS: {
    title: 'Delete Business?',
    message: 'This will permanently delete your business profile and all associated data. This action cannot be undone.',
    confirmText: 'Delete Business',
    cancelText: 'Keep Business',
    type: 'danger' as const,
  },
};

// Hook for easy dialog management
export const useConfirmationDialog = () => {
  const [dialog, setDialog] = React.useState<{
    isOpen: boolean;
    config: Partial<ConfirmationDialogProps>;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    config: {},
  });

  const showDialog = (
    config: Partial<ConfirmationDialogProps>,
    onConfirm?: () => void
  ) => {
    setDialog({
      isOpen: true,
      config,
      onConfirm,
    });
  };

  const hideDialog = () => {
    setDialog(prev => ({ ...prev, isOpen: false }));
  };

  const confirmDialog = () => {
    if (dialog.onConfirm) {
      dialog.onConfirm();
    }
    hideDialog();
  };

  return {
    dialog: {
      ...dialog.config,
      isOpen: dialog.isOpen,
      onClose: hideDialog,
      onConfirm: confirmDialog,
    } as ConfirmationDialogProps,
    showDialog,
    hideDialog,
  };
};