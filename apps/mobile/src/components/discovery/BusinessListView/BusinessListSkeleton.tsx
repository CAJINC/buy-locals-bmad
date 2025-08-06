import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { BusinessListSkeletonProps } from './types';

const { width } = Dimensions.get('window');

// Simple shimmer effect using opacity animation
const ShimmerView: React.FC<{ 
  style: any; 
  testID?: string;
}> = ({ style, testID }) => {
  return (
    <View 
      style={[styles.shimmer, style]} 
      testID={testID}
    />
  );
};

const BusinessListSkeletonItem: React.FC<{ testID?: string }> = ({ 
  testID = 'business-list-skeleton-item' 
}) => {
  return (
    <View style={styles.skeletonItem} testID={testID}>
      <View style={styles.imageContainer}>
        <ShimmerView 
          style={styles.image} 
          testID={`${testID}-image`}
        />
      </View>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <ShimmerView 
            style={styles.title} 
            testID={`${testID}-title`}
          />
          <ShimmerView 
            style={styles.distance} 
            testID={`${testID}-distance`}
          />
        </View>
        
        <View style={styles.metaRow}>
          <ShimmerView 
            style={styles.rating} 
            testID={`${testID}-rating`}
          />
          <ShimmerView 
            style={styles.category} 
            testID={`${testID}-category`}
          />
        </View>
        
        <ShimmerView 
          style={styles.description} 
          testID={`${testID}-description`}
        />
        <ShimmerView 
          style={styles.descriptionShort} 
          testID={`${testID}-description-short`}
        />
        
        <View style={styles.footerRow}>
          <ShimmerView 
            style={styles.hours} 
            testID={`${testID}-hours`}
          />
          <ShimmerView 
            style={styles.phone} 
            testID={`${testID}-phone`}
          />
        </View>
      </View>
    </View>
  );
};

export const BusinessListSkeleton: React.FC<BusinessListSkeletonProps> = ({
  count = 5,
  testID = 'business-list-skeleton'
}) => {
  return (
    <View style={styles.container} testID={testID}>
      {Array.from({ length: count }, (_, index) => (
        <BusinessListSkeletonItem
          key={`skeleton-${index}`}
          testID={`${testID}-item-${index}`}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skeletonItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 1,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  imageContainer: {
    marginRight: 12,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    height: 20,
    width: '60%',
    borderRadius: 4,
  },
  distance: {
    height: 16,
    width: 60,
    borderRadius: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  rating: {
    height: 16,
    width: 80,
    borderRadius: 4,
  },
  category: {
    height: 16,
    width: 100,
    borderRadius: 4,
  },
  description: {
    height: 14,
    width: '85%',
    borderRadius: 4,
    marginBottom: 4,
  },
  descriptionShort: {
    height: 14,
    width: '60%',
    borderRadius: 4,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hours: {
    height: 14,
    width: 70,
    borderRadius: 4,
  },
  phone: {
    height: 14,
    width: 90,
    borderRadius: 4,
  },
  shimmer: {
    backgroundColor: '#E0E0E0',
    opacity: 0.7,
  },
});