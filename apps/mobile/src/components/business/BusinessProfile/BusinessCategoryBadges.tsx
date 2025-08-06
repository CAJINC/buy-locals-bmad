import React, { useMemo } from 'react';
import {
  HStack,
  Badge,
  Pressable,
  useToast,
} from 'native-base';

interface BusinessCategoryBadgesProps {
  categories: string[];
  maxDisplay?: number;
  onCategoryPress?: (category: string) => void;
  variant?: 'subtle' | 'solid' | 'outline';
}

export const BusinessCategoryBadges: React.FC<BusinessCategoryBadgesProps> = React.memo(({
  categories,
  maxDisplay = 3,
  onCategoryPress,
  variant = 'subtle',
}) => {
  const toast = useToast();

  const { displayCategories, remainingCount } = useMemo(() => {
    if (!categories || categories.length === 0) {
      return { displayCategories: [], remainingCount: 0 };
    }
    
    const display = categories.slice(0, maxDisplay);
    const remaining = Math.max(0, categories.length - maxDisplay);
    
    return { displayCategories: display, remainingCount: remaining };
  }, [categories, maxDisplay]);

  const getCategoryColor = (category: string, index: number) => {
    // Assign different colors based on category or index
    const colors = ['blue', 'green', 'purple', 'orange', 'pink', 'cyan'];
    return colors[index % colors.length];
  };

  const handleCategoryPress = (category: string) => {
    if (onCategoryPress) {
      onCategoryPress(category);
    } else {
      // Default behavior: show toast with category info
      toast.show({
        title: "Category",
        description: `Businesses in "${category}" category`,
        status: "info",
        duration: 2000,
      });
    }
  };

  const handleMorePress = () => {
    if (onCategoryPress) {
      // Could show a modal or navigate to category list
      toast.show({
        title: "More Categories",
        description: `${remainingCount} additional categories available`,
        status: "info",
        duration: 2000,
      });
    }
  };

  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <HStack space={2} flexWrap="wrap" alignItems="center">
      {displayCategories.map((category, index) => (
        <Pressable
          key={index}
          onPress={() => handleCategoryPress(category)}
          _pressed={{ opacity: 0.6 }}
        >
          <Badge
            colorScheme={getCategoryColor(category, index)}
            variant={variant}
            rounded="full"
            px={3}
            py={1}
            _text={{
              fontSize: 'xs',
              fontWeight: 'medium',
            }}
          >
            {category}
          </Badge>
        </Pressable>
      ))}
      
      {remainingCount > 0 && (
        <Pressable onPress={handleMorePress} _pressed={{ opacity: 0.6 }}>
          <Badge
            colorScheme="gray"
            variant={variant}
            rounded="full"
            px={3}
            py={1}
            _text={{
              fontSize: 'xs',
              fontWeight: 'medium',
            }}
          >
            +{remainingCount} more
          </Badge>
        </Pressable>
      )}
    </HStack>
  );
});