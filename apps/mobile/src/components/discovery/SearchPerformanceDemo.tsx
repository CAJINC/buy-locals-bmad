import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { enhancedLocationSearchService, SearchOptions, SearchFilters } from '../../services/enhancedLocationSearchService';
import { searchPerformanceService } from '../../services/searchPerformanceService';
import { locationService } from '../../services/locationService';

interface PerformanceStats {
  executionTime: number;
  cacheHit: boolean;
  resultsCount: number;
  isPartial?: boolean;
  isOffline?: boolean;
}

export const SearchPerformanceDemo: React.FC = () => {
  // Search state
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastSearchTime, setLastSearchTime] = useState(0);
  
  // Performance options
  const [enableDebouncing, setEnableDebouncing] = useState(true);
  const [useProgressiveLoading, setUseProgressiveLoading] = useState(false);
  const [enablePreloading, setEnablePreloading] = useState(true);
  const [fallbackToCache, setFallbackToCache] = useState(true);
  
  // Performance metrics
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats[]>([]);
  const [overallAnalytics, setOverallAnalytics] = useState<any>(null);
  
  // Demo data
  const categories = ['Restaurant', 'Coffee Shop', 'Gas Station', 'Grocery Store', 'Pharmacy', 'Bank'];
  const searchQueries = ['coffee', 'food', 'gas', 'groceries', 'pharmacy', 'shopping'];
  
  // Refs for demo purposes
  const searchInputRef = useRef<TextInput>(null);
  const performanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load initial analytics
    updateAnalytics();
    
    // Update analytics every 5 seconds
    const analyticsInterval = setInterval(updateAnalytics, 5000);
    
    return () => {
      clearInterval(analyticsInterval);
      if (performanceTimerRef.current) {
        clearTimeout(performanceTimerRef.current);
      }
    };
  }, []);

  const updateAnalytics = () => {
    try {
      const analytics = enhancedLocationSearchService.getSearchPerformance();
      setOverallAnalytics(analytics);
    } catch (error) {
      console.warn('Analytics update error:', error);
    }
  };

  const performSearch = async (query?: string, category?: string) => {
    const searchQuery = query || searchText;
    const searchCategory = category || selectedCategory;
    
    if (!searchQuery && !searchCategory) return;

    setIsSearching(true);
    const startTime = Date.now();

    try {
      // Get current location
      const currentLocation = await locationService.getCurrentLocation();

      // Build search filters
      const filters: SearchFilters = {};
      if (searchQuery) filters.search = searchQuery;
      if (searchCategory) filters.category = [searchCategory];

      // Build search options
      const options: SearchOptions = {
        enableDebouncing,
        useProgressiveLoading,
        preloadCommonAreas: enablePreloading,
        fallbackToCache,
        maxResults: 20,
        timeoutMs: 5000,
      };

      // Perform search
      const result = await enhancedLocationSearchService.searchBusinesses(
        currentLocation,
        filters,
        options
      );

      // Update results
      setSearchResults(result.businesses);
      setLastSearchTime(Date.now() - startTime);

      // Record performance stats
      const stats: PerformanceStats = {
        executionTime: result.executionTime,
        cacheHit: result.cacheHit,
        resultsCount: result.businesses.length,
        isPartial: result.isPartial,
        isOffline: result.isOffline,
      };

      setPerformanceStats(prev => [...prev.slice(-9), stats]); // Keep last 10 stats

      // Update analytics after search
      setTimeout(updateAnalytics, 1000);

    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const performBenchmarkTest = async () => {
    console.log('Starting performance benchmark test...');
    
    setIsSearching(true);
    setPerformanceStats([]);
    
    try {
      // Test 1: Multiple rapid searches (debouncing test)
      console.log('Test 1: Debouncing performance');
      for (const query of searchQueries.slice(0, 3)) {
        await performSearch(query);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      }
      
      // Test 2: Progressive loading test
      console.log('Test 2: Progressive loading');
      const originalProgressive = useProgressiveLoading;
      setUseProgressiveLoading(true);
      await performSearch('restaurant');
      setUseProgressiveLoading(originalProgressive);
      
      // Test 3: Cache performance test
      console.log('Test 3: Cache performance');
      for (let i = 0; i < 3; i++) {
        await performSearch('coffee'); // Same query should hit cache
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      console.log('Benchmark test completed');
      updateAnalytics();
      
    } catch (error) {
      console.error('Benchmark test error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const clearAllCaches = async () => {
    try {
      await enhancedLocationSearchService.clearSearchCache();
      await searchPerformanceService.clearAllCaches();
      setPerformanceStats([]);
      updateAnalytics();
      console.log('All caches cleared');
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  };

  const renderPerformanceCard = (title: string, value: string | number, subtitle?: string) => (
    <View style={styles.performanceCard}>
      <Text style={styles.performanceTitle}>{title}</Text>
      <Text style={styles.performanceValue}>{value}</Text>
      {subtitle && <Text style={styles.performanceSubtitle}>{subtitle}</Text>}
    </View>
  );

  const renderSearchResult = (business: any, index: number) => (
    <View key={business.id || index} style={styles.resultCard}>
      <Text style={styles.businessName}>{business.name}</Text>
      <Text style={styles.businessCategory}>
        {Array.isArray(business.category) ? business.category.join(', ') : business.category}
      </Text>
      <View style={styles.businessMeta}>
        <Text style={styles.businessDistance}>
          {business.distance?.toFixed(1)}km • ⭐ {business.rating?.toFixed(1)}
        </Text>
        {business.isOpen !== undefined && (
          <Text style={[styles.businessStatus, { color: business.isOpen ? '#4CAF50' : '#FF5722' }]}>
            {business.isOpen ? 'Open' : 'Closed'}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Search Performance Optimization Demo</Text>
      
      {/* Search Input */}
      <View style={styles.searchSection}>
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="Search for businesses..."
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={() => performSearch()}
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => performSearch()}
          disabled={isSearching}
        >
          {isSearching ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.searchButtonText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Category Buttons */}
      <View style={styles.categorySection}>
        <Text style={styles.sectionTitle}>Quick Categories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                selectedCategory === category && styles.categoryButtonSelected,
              ]}
              onPress={() => {
                setSelectedCategory(category);
                performSearch('', category);
              }}
              disabled={isSearching}
            >
              <Text
                style={[
                  styles.categoryButtonText,
                  selectedCategory === category && styles.categoryButtonTextSelected,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Performance Options */}
      <View style={styles.optionsSection}>
        <Text style={styles.sectionTitle}>Performance Options</Text>
        
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Enable Debouncing</Text>
          <Switch value={enableDebouncing} onValueChange={setEnableDebouncing} />
        </View>
        
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Progressive Loading</Text>
          <Switch value={useProgressiveLoading} onValueChange={setUseProgressiveLoading} />
        </View>
        
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Enable Preloading</Text>
          <Switch value={enablePreloading} onValueChange={setEnablePreloading} />
        </View>
        
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Fallback to Cache</Text>
          <Switch value={fallbackToCache} onValueChange={setFallbackToCache} />
        </View>
      </View>

      {/* Performance Metrics */}
      <View style={styles.metricsSection}>
        <Text style={styles.sectionTitle}>Real-Time Performance</Text>
        
        <View style={styles.metricsGrid}>
          {renderPerformanceCard(
            'Last Search',
            `${lastSearchTime}ms`,
            lastSearchTime < 1000 ? '🟢 Fast' : lastSearchTime < 2000 ? '🟡 Moderate' : '🔴 Slow'
          )}
          
          {renderPerformanceCard(
            'Results',
            searchResults.length,
            'businesses found'
          )}
          
          {performanceStats.length > 0 && renderPerformanceCard(
            'Cache Hit Rate',
            `${Math.round((performanceStats.filter(s => s.cacheHit).length / performanceStats.length) * 100)}%`,
            'recent searches'
          )}
          
          {performanceStats.length > 0 && renderPerformanceCard(
            'Avg Response',
            `${Math.round(performanceStats.reduce((sum, s) => sum + s.executionTime, 0) / performanceStats.length)}ms`,
            'execution time'
          )}
        </View>
      </View>

      {/* Overall Analytics */}
      {overallAnalytics && (
        <View style={styles.analyticsSection}>
          <Text style={styles.sectionTitle}>Overall Analytics</Text>
          
          <View style={styles.metricsGrid}>
            {renderPerformanceCard('Total Searches', overallAnalytics.totalSearches)}
            {renderPerformanceCard('Cache Hit Rate', `${overallAnalytics.cacheHitRate?.toFixed(1)}%`)}
            {renderPerformanceCard('Avg Latency', `${Math.round(overallAnalytics.averageLatency)}ms`)}
            {renderPerformanceCard('Sub-1s Rate', `${overallAnalytics.sub1SecondRate?.toFixed(1)}%`)}
          </View>
          
          {overallAnalytics.performanceService?.networkCondition && (
            <View style={styles.networkStatus}>
              <Text style={styles.networkStatusTitle}>Network Status</Text>
              <Text style={styles.networkStatusText}>
                {overallAnalytics.performanceService.networkCondition.isOnline ? '🟢 Online' : '🔴 Offline'} • 
                {overallAnalytics.performanceService.networkCondition.isSlow ? ' Slow' : ' Fast'} • 
                {Math.round(overallAnalytics.performanceService.networkCondition.reliability)}% Reliability
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Demo Actions */}
      <View style={styles.actionsSection}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={performBenchmarkTest}
          disabled={isSearching}
        >
          <Text style={styles.actionButtonText}>Run Performance Benchmark</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={clearAllCaches}
        >
          <Text style={styles.actionButtonTextSecondary}>Clear All Caches</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Performance Stats */}
      {performanceStats.length > 0 && (
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Recent Search Performance</Text>
          {performanceStats.slice(-5).reverse().map((stat, index) => (
            <View key={index} style={styles.statRow}>
              <Text style={styles.statTime}>{stat.executionTime}ms</Text>
              <Text style={[styles.statBadge, stat.cacheHit ? styles.cacheHit : styles.cacheMiss]}>
                {stat.cacheHit ? 'CACHE' : 'API'}
              </Text>
              <Text style={styles.statResults}>{stat.resultsCount} results</Text>
              {stat.isPartial && <Text style={styles.statPartial}>PARTIAL</Text>}
              {stat.isOffline && <Text style={styles.statOffline}>OFFLINE</Text>}
            </View>
          ))}
        </View>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>
            Search Results ({searchResults.length})
          </Text>
          {searchResults.slice(0, 10).map(renderSearchResult)}
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Task 6: Search Performance Optimization Implementation
        </Text>
        <Text style={styles.footerSubtext}>
          Features: Debouncing • Progressive Loading • Smart Caching • Offline Fallback • Preloading • Performance Monitoring
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    margin: 20,
    color: '#2E7D32',
  },
  searchSection: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    marginRight: 12,
  },
  searchButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  categorySection: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  categoryButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  categoryButtonSelected: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  categoryButtonText: {
    color: '#333',
    fontSize: 14,
  },
  categoryButtonTextSelected: {
    color: '#FFFFFF',
  },
  optionsSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  optionLabel: {
    fontSize: 16,
    color: '#333',
  },
  metricsSection: {
    margin: 16,
    marginBottom: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  performanceCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    width: '48%',
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  performanceTitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  performanceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginVertical: 4,
  },
  performanceSubtitle: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },
  analyticsSection: {
    margin: 16,
    marginBottom: 20,
  },
  networkStatus: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  networkStatusTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  networkStatusText: {
    fontSize: 12,
    color: '#666',
  },
  actionsSection: {
    margin: 16,
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#2E7D32',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionButtonTextSecondary: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statTime: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    width: 60,
  },
  statBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginHorizontal: 8,
  },
  cacheHit: {
    backgroundColor: '#4CAF50',
    color: '#FFFFFF',
  },
  cacheMiss: {
    backgroundColor: '#FF9800',
    color: '#FFFFFF',
  },
  statResults: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  statPartial: {
    fontSize: 10,
    color: '#FF5722',
    fontWeight: 'bold',
  },
  statOffline: {
    fontSize: 10,
    color: '#9C27B0',
    fontWeight: 'bold',
  },
  resultsSection: {
    margin: 16,
    marginBottom: 20,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  businessName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  businessCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  businessMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  businessDistance: {
    fontSize: 12,
    color: '#999',
  },
  businessStatus: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 40,
  },
  footerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
    marginBottom: 8,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default SearchPerformanceDemo;