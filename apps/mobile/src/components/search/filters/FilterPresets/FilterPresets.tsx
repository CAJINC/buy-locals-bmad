import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { FilterPresetsProps } from '../FilterPanel/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PRESET_ITEM_WIDTH = Math.min(140, (SCREEN_WIDTH - 60) / 2.5);

export const FilterPresets: React.FC<FilterPresetsProps> = ({
  presets,
  activePresetId,
  onPresetSelect,
  theme,
  testID = 'filter-presets',
}) => {
  const handlePresetPress = useCallback((presetId: string) => {
    // Toggle preset - deselect if already active
    if (activePresetId === presetId) {
      // For now, we don't support deselecting presets
      // This behavior can be modified based on requirements
      return;
    }
    
    onPresetSelect(presetId);
  }, [activePresetId, onPresetSelect]);

  if (presets.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} testID={testID}>
      <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
        Quick Filters
      </Text>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {presets.map((preset) => {
          const isActive = activePresetId === preset.id;
          
          return (
            <TouchableOpacity
              key={preset.id}
              style={[
                styles.presetItem,
                {
                  borderColor: isActive ? theme.primaryColor : theme.borderColor,
                  backgroundColor: isActive ? `${theme.primaryColor}10` : theme.backgroundColor,
                },
              ]}
              onPress={() => handlePresetPress(preset.id)}
              activeOpacity={0.7}
              testID={`${testID}-item-${preset.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Apply ${preset.name} filter preset`}
              accessibilityHint={preset.description}
              accessibilityState={{ selected: isActive }}
            >
              <View style={styles.presetContent}>
                {/* Icon */}
                <View style={[
                  styles.iconContainer,
                  {
                    backgroundColor: isActive ? theme.primaryColor : `${theme.primaryColor}20`,
                  }
                ]}>
                  <Icon
                    name={preset.icon}
                    size={20}
                    color={isActive ? '#fff' : theme.primaryColor}
                  />
                </View>
                
                {/* Text Content */}
                <View style={styles.textContainer}>
                  <Text
                    style={[
                      styles.presetName,
                      {
                        color: isActive ? theme.primaryColor : theme.textColor,
                        fontWeight: isActive ? '600' : '500',
                      }
                    ]}
                    numberOfLines={1}
                  >
                    {preset.name}
                  </Text>
                  
                  <Text
                    style={[
                      styles.presetDescription,
                      {
                        color: isActive ? theme.primaryColor : '#666',
                      }
                    ]}
                    numberOfLines={2}
                  >
                    {preset.description}
                  </Text>
                </View>
                
                {/* Active Indicator */}
                {isActive && (
                  <View style={styles.activeIndicator}>
                    <Icon
                      name="check-circle"
                      size={16}
                      color={theme.primaryColor}
                    />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
        
        {/* Clear Preset Option */}
        {activePresetId && (
          <TouchableOpacity
            style={[
              styles.presetItem,
              styles.clearPresetItem,
              {
                borderColor: '#FF6B35',
                backgroundColor: '#FF6B3510',
              }
            ]}
            onPress={() => onPresetSelect('')} // Clear active preset
            activeOpacity={0.7}
            testID={`${testID}-clear`}
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
            accessibilityHint="Remove all applied filters"
          >
            <View style={styles.presetContent}>
              <View style={[styles.iconContainer, { backgroundColor: '#FF6B3520' }]}>
                <Icon
                  name="clear"
                  size={20}
                  color="#FF6B35"
                />
              </View>
              
              <View style={styles.textContainer}>
                <Text
                  style={[styles.presetName, { color: '#FF6B35', fontWeight: '600' }]}
                  numberOfLines={1}
                >
                  Clear Filters
                </Text>
                
                <Text
                  style={[styles.presetDescription, { color: '#FF6B35' }]}
                  numberOfLines={2}
                >
                  Remove all filters
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 12,
  },
  presetItem: {
    width: PRESET_ITEM_WIDTH,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  clearPresetItem: {
    width: PRESET_ITEM_WIDTH * 0.8, // Slightly smaller for clear action
  },
  presetContent: {
    alignItems: 'center',
    position: 'relative',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
  },
  presetName: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  presetDescription: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
    opacity: 0.8,
  },
  activeIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});