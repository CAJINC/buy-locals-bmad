import { LocationCoordinates } from '../../../services/locationService';

export interface Business {
  id: string;
  name: string;
  category: string;
  coordinates: LocationCoordinates;
  address: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
  isOpen?: boolean;
  distance?: number;
  phone?: string;
  website?: string;
  image?: string;
  verified?: boolean;
  businessHours?: BusinessHours;
}

export interface BusinessHours {
  [key: string]: {
    open: string;
    close: string;
  };
}

export interface BusinessMarker {
  business: Business;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  title: string;
  description: string;
}

export interface MarkerCluster {
  id: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  pointCount: number;
  businesses: Business[];
  geometry: {
    coordinates: [number, number];
  };
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapViewProps {
  businesses: Business[];
  initialRegion?: MapRegion;
  onRegionChange?: (region: MapRegion) => void;
  onBusinessSelect?: (business: Business) => void;
  showUserLocation?: boolean;
  enableClustering?: boolean;
  clusteringRadius?: number;
  searchRadius?: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  customMapStyle?: object[];
  showTrafficLayer?: boolean;
  followUserLocation?: boolean;
  minZoomLevel?: number;
  maxZoomLevel?: number;
  onLocationPress?: () => void;
  onMapReady?: () => void;
  testID?: string;
}

export interface CustomMarkerProps {
  business: Business;
  onPress: (business: Business) => void;
  selected?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export interface ClusterMarkerProps {
  cluster: MarkerCluster;
  onPress: (cluster: MarkerCluster) => void;
  size?: 'small' | 'medium' | 'large';
}

export interface BusinessSummaryProps {
  business: Business;
  onClose: () => void;
  onGetDirections?: (business: Business) => void;
  onCall?: (business: Business) => void;
  onVisitWebsite?: (business: Business) => void;
  visible: boolean;
}

export interface MapLoadingState {
  isLoading: boolean;
  loadingText?: string;
  progress?: number;
}

export interface MapErrorState {
  hasError: boolean;
  errorMessage?: string;
  errorType?: 'permission' | 'network' | 'location' | 'unknown';
  canRetry: boolean;
}

export interface UserLocationButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export interface MapControlsProps {
  onLocationPress: () => void;
  onToggleMapType: () => void;
  onToggleTraffic?: () => void;
  showTrafficLayer?: boolean;
  mapType: 'standard' | 'satellite' | 'hybrid' | 'terrain';
  locationLoading?: boolean;
  locationDisabled?: boolean;
}

export type MapType = 'standard' | 'satellite' | 'hybrid' | 'terrain';

export interface ZoomLevel {
  min: number;
  max: number;
  current?: number;
}

export interface SearchTriggerConfig {
  debounceMs: number;
  minRegionChange: number;
  enableAutoSearch: boolean;
}

export interface MapAnimationConfig {
  duration?: number;
  useNativeDriver?: boolean;
  easing?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface GeofenceConfig {
  radius: number;
  identifier: string;
  enabled: boolean;
}

export interface MapViewState {
  region: MapRegion;
  mapType: MapType;
  showTrafficLayer: boolean;
  followUserLocation: boolean;
  selectedBusiness: Business | null;
  clusters: MarkerCluster[];
  loadingState: MapLoadingState;
  errorState: MapErrorState;
  userLocation: LocationCoordinates | null;
  searchInProgress: boolean;
}

export interface MapViewActions {
  updateRegion: (region: MapRegion) => void;
  setMapType: (mapType: MapType) => void;
  toggleTrafficLayer: () => void;
  toggleFollowUserLocation: () => void;
  selectBusiness: (business: Business | null) => void;
  setClusters: (clusters: MarkerCluster[]) => void;
  setLoadingState: (state: MapLoadingState) => void;
  setErrorState: (state: MapErrorState) => void;
  setUserLocation: (location: LocationCoordinates | null) => void;
  setSearchInProgress: (inProgress: boolean) => void;
  animateToRegion: (region: MapRegion, config?: MapAnimationConfig) => void;
  animateToCoordinate: (coordinate: LocationCoordinates, config?: MapAnimationConfig) => void;
  fitToCoordinates: (coordinates: LocationCoordinates[], config?: MapAnimationConfig) => void;
}

export interface MapClusteringConfig {
  radius: number;
  maxZoom: number;
  minZoom: number;
  extent: number;
  nodeSize: number;
  algorithm: 'kmeans' | 'grid' | 'supercluster';
}

export interface MapPerformanceConfig {
  enableClusterAnimation: boolean;
  markerUpdateBatchSize: number;
  throttleRegionChanges: boolean;
  optimizeMarkerRendering: boolean;
  useNativeOptimizations: boolean;
}