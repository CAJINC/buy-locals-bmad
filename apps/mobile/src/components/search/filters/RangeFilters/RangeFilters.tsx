import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanGestureHandler,
  State as GestureState,
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RangeFiltersProps } from '../FilterPanel/types';
import { RANGE_FILTER_CONFIGS, DISTANCE_CONVERSIONS } from '../FilterPanel/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDER_WIDTH = SCREEN_WIDTH - 80;
const THUMB_SIZE = 24;

interface SliderProps {
  min: number;
  max: number;
  value: number;
  onValueChange: (value: number) => void;
  formatValue: (value: number) => string;
  step?: number;
  color: string;
  disabled?: boolean;
}

const RangeSlider: React.FC<SliderProps> = ({
  min,
  max,
  value,
  onValueChange,
  formatValue,
  step = 1,
  color,
  disabled = false,
}) => {
  const translationX = useSharedValue((value - min) / (max - min) * SLIDER_WIDTH);
  const [isDragging, setIsDragging] = useState(false);

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: () => {
      runOnJS(setIsDragging)(true);
    },
    onActive: (event) => {
      const newTranslationX = Math.max(0, Math.min(SLIDER_WIDTH, event.translationX + translationX.value));
      translationX.value = newTranslationX;
      
      const newValue = Math.round((newTranslationX / SLIDER_WIDTH * (max - min) + min) / step) * step;
      const clampedValue = Math.max(min, Math.min(max, newValue));
      
      runOnJS(onValueChange)(clampedValue);
    },
    onEnd: () => {
      translationX.value = (value - min) / (max - min) * SLIDER_WIDTH;
      runOnJS(setIsDragging)(false);
    },
  });

  const thumbStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translationX.value }],
    };
  });

  const trackFillStyle = useAnimatedStyle(() => {
    return {
      width: translationX.value,
    };
  });

  return (
    <View style={styles.sliderContainer}>
      {/* Track */}
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.trackFill,
            { backgroundColor: color },
            trackFillStyle,
          ]}
        />
      </View>

      {/* Thumb */}
      <PanGestureHandler onGestureEvent={gestureHandler} enabled={!disabled}>
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: color,
              borderColor: isDragging ? color : '#fff',
            },
            thumbStyle,
          ]}
        >
          {isDragging && (
            <View style={[styles.valueTooltip, { borderBottomColor: color }]}>
              <Text style={styles.valueTooltipText}>{formatValue(value)}</Text>
            </View>
          )}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

export const RangeFilters: React.FC<RangeFiltersProps> = ({
  distance,
  priceRange,
  rating,
  onDistanceChange,
  onPriceRangeChange,
  onRatingChange,
  location,
  theme,
  testID = 'range-filters',
}) => {
  // Distance filter state and handlers
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'miles'>(distance?.unit || 'km');
  
  const distanceConfig = useMemo(() => {
    return distanceUnit === 'km' ? RANGE_FILTER_CONFIGS.distance : RANGE_FILTER_CONFIGS.distanceMiles;
  }, [distanceUnit]);

  const handleDistanceChange = useCallback((radius: number) => {
    if (onDistanceChange) {
      onDistanceChange({ radius, unit: distanceUnit });
    }
  }, [onDistanceChange, distanceUnit]);

  const handleDistanceUnitToggle = useCallback(() => {
    const newUnit = distanceUnit === 'km' ? 'miles' : 'km';
    const currentRadius = distance?.radius || 25;
    const convertedRadius = newUnit === 'km' 
      ? DISTANCE_CONVERSIONS.milesToKm(currentRadius)
      : DISTANCE_CONVERSIONS.kmToMiles(currentRadius);
    
    setDistanceUnit(newUnit);
    if (onDistanceChange) {
      onDistanceChange({ radius: convertedRadius, unit: newUnit });
    }
  }, [distance, distanceUnit, onDistanceChange]);

  // Price range dual slider
  const [priceMin, setPriceMin] = useState(priceRange?.min || 0);
  const [priceMax, setPriceMax] = useState(priceRange?.max || 1000);

  const handlePriceMinChange = useCallback((min: number) => {
    const newMin = Math.min(min, priceMax - 5);
    setPriceMin(newMin);
    if (onPriceRangeChange) {
      onPriceRangeChange({ min: newMin, max: priceMax });
    }
  }, [priceMax, onPriceRangeChange]);

  const handlePriceMaxChange = useCallback((max: number) => {
    const newMax = Math.max(max, priceMin + 5);
    setPriceMax(newMax);
    if (onPriceRangeChange) {
      onPriceRangeChange({ min: priceMin, max: newMax });
    }
  }, [priceMin, onPriceRangeChange]);

  const priceConfig = RANGE_FILTER_CONFIGS.price;
  const ratingConfig = RANGE_FILTER_CONFIGS.rating;

  return (
    <View style={styles.container} testID={testID}>
      {/* Distance Filter */}
      {distance && onDistanceChange && (
        <View style={styles.filterSection}>
          <View style={styles.filterHeader}>
            <View style={styles.filterTitleRow}>
              <Icon name="location-on" size={20} color={theme.primaryColor} />
              <Text style={[styles.filterTitle, { color: theme.textColor }]}>
                Search Radius
              </Text>
            </View>
            
            <TouchableOpacity
              style={[styles.unitToggle, { borderColor: theme.primaryColor }]}
              onPress={handleDistanceUnitToggle}
              testID={`${testID}-distance-unit-toggle`}
            >
              <Text style={[styles.unitToggleText, { color: theme.primaryColor }]}>
                {distanceUnit.toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sliderSection}>
            <RangeSlider
              min={distanceConfig.min}
              max={distanceConfig.max}
              value={distance.radius}
              onValueChange={handleDistanceChange}
              formatValue={distanceConfig.formatValue!}
              step={distanceConfig.step}
              color={theme.primaryColor}
            />
            
            <View style={styles.valueDisplay}>
              <Text style={styles.currentValue}>
                {distanceConfig.formatValue!(distance.radius)}
              </Text>
              <Text style={styles.rangeLabel}>
                {distanceConfig.min}{distanceConfig.unit} - {distanceConfig.max}{distanceConfig.unit}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Price Range Filter */}
      {priceRange && onPriceRangeChange && (
        <View style={styles.filterSection}>
          <View style={styles.filterHeader}>
            <View style={styles.filterTitleRow}>
              <Icon name="attach-money" size={20} color="#FF6B35" />
              <Text style={[styles.filterTitle, { color: theme.textColor }]}>
                Price Range
              </Text>
            </View>
          </View>

          <View style={styles.sliderSection}>
            {/* Dual Range Slider for Price */}
            <View style={styles.dualSliderContainer}>
              <View style={styles.dualTrack}>
                <View
                  style={[
                    styles.dualTrackFill,
                    {
                      backgroundColor: '#FF6B35',
                      left: (priceMin / priceConfig.max) * SLIDER_WIDTH,
                      width: ((priceMax - priceMin) / priceConfig.max) * SLIDER_WIDTH,
                    }
                  ]}
                />
              </View>
              
              {/* Min Price Slider */}
              <RangeSlider
                min={priceConfig.min}
                max={priceConfig.max}
                value={priceMin}
                onValueChange={handlePriceMinChange}
                formatValue={priceConfig.formatValue!}
                step={priceConfig.step}
                color="#FF6B35"
              />
              
              {/* Max Price Slider */}
              <View style={StyleSheet.absoluteFillObject}>
                <RangeSlider
                  min={priceConfig.min}
                  max={priceConfig.max}
                  value={priceMax}
                  onValueChange={handlePriceMaxChange}
                  formatValue={priceConfig.formatValue!}
                  step={priceConfig.step}
                  color="#FF6B35"
                />
              </View>
            </View>
            
            <View style={styles.valueDisplay}>
              <Text style={styles.currentValue}>
                {priceConfig.formatValue!(priceMin)} - {priceConfig.formatValue!(priceMax)}
              </Text>
              <Text style={styles.rangeLabel}>
                {priceConfig.formatValue!(priceConfig.min)} - {priceConfig.formatValue!(priceConfig.max)}
              </Text>
            </View>
          </View>

          {/* Price Range Presets */}
          <View style={styles.presetsRow}>
            {[
              { label: 'Free', min: 0, max: 0 },
              { label: '$', min: 0, max: 25 },
              { label: '$$', min: 25, max: 75 },
              { label: '$$$', min: 75, max: 200 },
              { label: '$$$$', min: 200, max: 1000 },
            ].map(preset => (
              <TouchableOpacity
                key={preset.label}
                style={[
                  styles.presetButton,
                  {
                    borderColor: '#FF6B35',
                    backgroundColor: (priceMin === preset.min && priceMax === preset.max) 
                      ? '#FF6B35' : 'transparent'
                  }
                ]}
                onPress={() => {
                  setPriceMin(preset.min);
                  setPriceMax(preset.max);
                  if (onPriceRangeChange) {
                    onPriceRangeChange({ min: preset.min, max: preset.max });
                  }
                }}
              >
                <Text style={[
                  styles.presetButtonText,
                  {
                    color: (priceMin === preset.min && priceMax === preset.max) 
                      ? '#fff' : '#FF6B35'
                  }
                ]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Rating Filter */}
      {rating && onRatingChange && (
        <View style={styles.filterSection}>
          <View style={styles.filterHeader}>
            <View style={styles.filterTitleRow}>
              <Icon name="star" size={20} color="#FFD93D" />
              <Text style={[styles.filterTitle, { color: theme.textColor }]}>
                Minimum Rating
              </Text>
            </View>
          </View>

          <View style={styles.sliderSection}>
            <RangeSlider
              min={ratingConfig.min}
              max={ratingConfig.max}
              value={rating.minimum}
              onValueChange={(minimum) => onRatingChange({ minimum })}
              formatValue={ratingConfig.formatValue!}
              step={ratingConfig.step}
              color="#FFD93D"
            />
            
            <View style={styles.valueDisplay}>
              <Text style={styles.currentValue}>
                {ratingConfig.formatValue!(rating.minimum)}
              </Text>
            </View>
          </View>

          {/* Rating Star Presets */}
          <View style={styles.presetsRow}>
            {[0, 1, 2, 3, 4, 4.5, 5].map(stars => (
              <TouchableOpacity
                key={stars}
                style={[
                  styles.starPresetButton,
                  {
                    borderColor: '#FFD93D',
                    backgroundColor: rating.minimum === stars ? '#FFD93D' : 'transparent'
                  }
                ]}
                onPress={() => onRatingChange({ minimum: stars })}
              >
                <View style={styles.starPresetContent}>
                  <Icon
                    name={stars === 0 ? 'star-border' : 'star'}
                    size={16}
                    color={rating.minimum === stars ? '#fff' : '#FFD93D'}
                  />
                  {stars > 0 && (
                    <Text style={[
                      styles.starPresetText,
                      {
                        color: rating.minimum === stars ? '#fff' : '#FFD93D'
                      }
                    ]}>
                      {stars}+
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterSection: {
    marginBottom: 32,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  filterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  unitToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  unitToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sliderSection: {
    marginBottom: 16,
  },
  sliderContainer: {
    height: THUMB_SIZE + 10,
    justifyContent: 'center',
    marginBottom: 12,
  },
  track: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    width: SLIDER_WIDTH,
  },
  trackFill: {
    height: 4,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  valueTooltip: {
    position: 'absolute',
    bottom: THUMB_SIZE + 8,
    left: -20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#333',
    borderRadius: 4,
    borderBottomWidth: 6,
    borderBottomColor: 'transparent',
    minWidth: 40,
    alignItems: 'center',
  },
  valueTooltipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dualSliderContainer: {
    position: 'relative',
    height: THUMB_SIZE + 10,
    justifyContent: 'center',
    marginBottom: 12,
  },
  dualTrack: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    width: SLIDER_WIDTH,
  },
  dualTrackFill: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
  },
  valueDisplay: {
    alignItems: 'center',
    marginTop: 8,
  },
  currentValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  rangeLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  presetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  starPresetButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 40,
    alignItems: 'center',
  },
  starPresetContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starPresetText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
});