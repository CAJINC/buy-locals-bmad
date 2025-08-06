import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { MapView, Business, MapRegion } from '../components/discovery';
import { locationService } from '../services/locationService';

// Mock business data for demonstration
const mockBusinesses: Business[] = [
  {
    id: '1',
    name: 'Blue Bottle Coffee',
    category: 'cafe',
    coordinates: { latitude: 37.7849, longitude: -122.4094, accuracy: 10, timestamp: Date.now() },
    address: '66 Mint St, San Francisco, CA 94103',
    rating: 4.3,
    reviewCount: 847,
    priceLevel: 2,
    isOpen: true,
    distance: 0.5,
    phone: '+1 (510) 653-3394',
    website: 'https://bluebottlecoffee.com',
    verified: true,
    businessHours: {
      monday: { open: '6:00 AM', close: '7:00 PM' },
      tuesday: { open: '6:00 AM', close: '7:00 PM' },
      wednesday: { open: '6:00 AM', close: '7:00 PM' },
      thursday: { open: '6:00 AM', close: '7:00 PM' },
      friday: { open: '6:00 AM', close: '7:00 PM' },
      saturday: { open: '7:00 AM', close: '8:00 PM' },
      sunday: { open: '7:00 AM', close: '8:00 PM' },
    },
  },
  {
    id: '2',
    name: 'Swan Oyster Depot',
    category: 'restaurant',
    coordinates: { latitude: 37.7914, longitude: -122.4194, accuracy: 15, timestamp: Date.now() },
    address: '1517 Polk St, San Francisco, CA 94109',
    rating: 4.6,
    reviewCount: 2341,
    priceLevel: 3,
    isOpen: true,
    distance: 1.2,
    phone: '+1 (415) 673-1101',
    verified: true,
  },
  {
    id: '3',
    name: 'REI Co-op',
    category: 'shop',
    coordinates: { latitude: 37.7857, longitude: -122.4011, accuracy: 8, timestamp: Date.now() },
    address: '840 Brannan St, San Francisco, CA 94103',
    rating: 4.2,
    reviewCount: 456,
    priceLevel: 2,
    isOpen: false,
    distance: 0.8,
    phone: '+1 (415) 934-1938',
    website: 'https://rei.com',
    verified: true,
  },
  {
    id: '4',
    name: 'The Fillmore',
    category: 'entertainment',
    coordinates: { latitude: 37.7841, longitude: -122.4339, accuracy: 12, timestamp: Date.now() },
    address: '1805 Geary Blvd, San Francisco, CA 94115',
    rating: 4.5,
    reviewCount: 1876,
    priceLevel: 3,
    distance: 2.1,
    phone: '+1 (415) 346-3000',
    website: 'https://thefillmore.com',
    verified: true,
  },
  {
    id: '5',
    name: 'Golden Gate Pharmacy',
    category: 'pharmacy',
    coordinates: { latitude: 37.7799, longitude: -122.4156, accuracy: 20, timestamp: Date.now() },
    address: '2590 California St, San Francisco, CA 94115',
    rating: 4.0,
    reviewCount: 123,
    isOpen: true,
    distance: 1.5,
    phone: '+1 (415) 567-2332',
    verified: false,
  },
];

// More businesses for clustering demonstration
const generateClusteredBusinesses = (): Business[] => {
  const additionalBusinesses: Business[] = [];
  const categories = ['restaurant', 'cafe', 'shop', 'bar', 'grocery'];
  
  // Create businesses around Union Square for clustering
  for (let i = 0; i < 15; i++) {
    const latOffset = (Math.random() - 0.5) * 0.01; // ~0.5 mile radius
    const lngOffset = (Math.random() - 0.5) * 0.01;
    
    additionalBusinesses.push({
      id: `cluster-${i}`,
      name: `Business ${i + 1}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      coordinates: {
        latitude: 37.7879 + latOffset, // Union Square area
        longitude: -122.4075 + lngOffset,
        accuracy: Math.random() * 20 + 5,
        timestamp: Date.now(),
      },
      address: `${100 + i} Market St, San Francisco, CA`,
      rating: Math.random() * 2 + 3, // 3-5 stars
      reviewCount: Math.floor(Math.random() * 500) + 10,
      isOpen: Math.random() > 0.3, // 70% open
      distance: Math.random() * 3 + 0.1,
      verified: Math.random() > 0.5,
    });
  }
  
  return additionalBusinesses;
};

export const MapExampleScreen: React.FC = () => {
  const [businesses, setBusinesses] = useState<Business[]>(mockBusinesses);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialRegion, setInitialRegion] = useState<MapRegion | undefined>();

  useEffect(() => {
    // Initialize with user location or add clustered businesses
    const initializeMap = async () => {
      try {
        const location = await locationService.getCurrentLocation();
        setInitialRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
        
        // Add clustered businesses for demonstration
        setTimeout(() => {
          setBusinesses([...mockBusinesses, ...generateClusteredBusinesses()]);
        }, 2000);
      } catch (err) {
        console.warn('Could not get initial location:', err);
        // Use default San Francisco location
        setInitialRegion({
          latitude: 37.7849,
          longitude: -122.4194,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
    };

    initializeMap();
  }, []);

  const handleRegionChange = async (region: MapRegion) => {
    console.log('Map region changed:', region);
    
    // Simulate business search API call
    setLoading(true);
    setError(null);
    
    try {
      // In a real app, you would call your business search API here
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
      
      // For demo, we could filter or add businesses based on region
      console.log('Would search for businesses in region:', region);
    } catch (err) {
      setError('Failed to search for businesses in this area');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBusinessSelect = (business: Business) => {
    console.log('Business selected:', business);
    
    // In a real app, you might navigate to a business detail screen
    // or show additional information
    Alert.alert(
      business.name,
      `${business.category} • ${business.address}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'View Details', 
          onPress: () => console.log('Navigate to business details:', business.id) 
        },
      ]
    );
  };

  const handleLocationPress = () => {
    console.log('Location button pressed');
    // Custom location handling if needed
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    
    // Simulate retry
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  return (
    <View style={styles.container}>
      <MapView
        businesses={businesses}
        initialRegion={initialRegion}
        onRegionChange={handleRegionChange}
        onBusinessSelect={handleBusinessSelect}
        showUserLocation={true}
        enableClustering={true}
        clusteringRadius={50}
        searchRadius={10}
        loading={loading}
        error={error}
        onRetry={handleRetry}
        showTrafficLayer={false}
        followUserLocation={false}
        minZoomLevel={3}
        maxZoomLevel={20}
        onLocationPress={handleLocationPress}
        onMapReady={() => console.log('Map is ready!')}
        testID="main-map-view"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MapExampleScreen;