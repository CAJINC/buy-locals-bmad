import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { ClusterMarkerProps } from './types';

const getClusterSize = (pointCount: number): 'small' | 'medium' | 'large' => {
  if (pointCount < 10) return 'small';
  if (pointCount < 50) return 'medium';
  return 'large';
};

const getClusterColor = (pointCount: number): string => {
  if (pointCount < 10) return '#FF6B6B';
  if (pointCount < 25) return '#FF8C42';
  if (pointCount < 50) return '#FFD93D';
  return '#6BCF7F';
};

interface ClusterMarkerViewProps {
  pointCount: number;
  size: 'small' | 'medium' | 'large';
}

const ClusterMarkerView: React.FC<ClusterMarkerViewProps> = ({ 
  pointCount, 
  size 
}) => {
  const backgroundColor = getClusterColor(pointCount);
  
  const clusterStyle = [
    styles.clusterContainer,
    styles[`cluster${size.charAt(0).toUpperCase() + size.slice(1)}`],
    { backgroundColor },
  ];

  const textStyle = [
    styles.clusterText,
    styles[`clusterText${size.charAt(0).toUpperCase() + size.slice(1)}`],
  ];

  return (
    <View style={styles.clusterWrapper}>
      <View style={clusterStyle}>
        <Text style={textStyle}>{pointCount}</Text>
      </View>
      <View style={styles.clusterPulse} />
    </View>
  );
};

export const ClusterMarker: React.FC<ClusterMarkerProps> = ({
  cluster,
  onPress,
}) => {
  const size = getClusterSize(cluster.pointCount);

  const handlePress = () => {
    onPress(cluster);
  };

  return (
    <Marker
      coordinate={{
        latitude: cluster.coordinate.latitude,
        longitude: cluster.coordinate.longitude,
      }}
      onPress={handlePress}
      identifier={cluster.id}
      tracksViewChanges={false}
    >
      <ClusterMarkerView 
        pointCount={cluster.pointCount}
        size={size}
      />
    </Marker>
  );
};

const styles = StyleSheet.create({
  clusterWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterContainer: {
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  clusterSmall: {
    width: 40,
    height: 40,
  },
  clusterMedium: {
    width: 50,
    height: 50,
  },
  clusterLarge: {
    width: 60,
    height: 60,
  },
  clusterText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  clusterTextSmall: {
    fontSize: 14,
  },
  clusterTextMedium: {
    fontSize: 16,
  },
  clusterTextLarge: {
    fontSize: 18,
  },
  clusterPulse: {
    position: 'absolute',
    width: '150%',
    height: '150%',
    borderRadius: 50,
    backgroundColor: 'rgba(255, 107, 107, 0.3)',
    opacity: 0.6,
  },
});

export default ClusterMarker;