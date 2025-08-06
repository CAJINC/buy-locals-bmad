import { SearchResultItem, SearchSortOption, SearchExportData } from '../types';
import { LocationCoordinates } from '../../../../services/locationService';
import { EXPORT_FORMATS, SHARE_TEMPLATES } from '../constants';

/**
 * Sort search results based on the specified criteria
 */
export const sortSearchResults = (
  results: SearchResultItem[],
  sortBy: SearchSortOption,
  currentLocation?: LocationCoordinates
): SearchResultItem[] => {
  const sorted = [...results];

  switch (sortBy) {
    case 'distance':
      return sorted.sort((a, b) => a.distance - b.distance);
    
    case 'rating':
      return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    
    case 'relevance':
      return sorted.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    
    case 'newest':
      return sorted.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    
    case 'alphabetical':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    
    case 'price_low':
      return sorted.sort((a, b) => {
        const priceA = getPriceValue(a.price_range);
        const priceB = getPriceValue(b.price_range);
        return priceA - priceB;
      });
    
    case 'price_high':
      return sorted.sort((a, b) => {
        const priceA = getPriceValue(a.price_range);
        const priceB = getPriceValue(b.price_range);
        return priceB - priceA;
      });
    
    default:
      return sorted;
  }
};

/**
 * Convert price range to numeric value for sorting
 */
const getPriceValue = (priceRange?: string): number => {
  if (!priceRange) return 0;
  
  const priceMap: { [key: string]: number } = {
    '$': 1,
    '$$': 2,
    '$$$': 3,
    '$$$$': 4
  };
  
  return priceMap[priceRange] || 0;
};

/**
 * Calculate relevance score based on search query and business data
 */
export const calculateRelevanceScore = (
  result: SearchResultItem,
  searchQuery: string
): number => {
  if (!searchQuery) return 0;
  
  const query = searchQuery.toLowerCase();
  const name = result.name.toLowerCase();
  const description = (result.description || '').toLowerCase();
  const category = (result.category || '').toLowerCase();
  const tags = (result.tags || []).join(' ').toLowerCase();
  
  let score = 0;
  
  // Exact name match gets highest score
  if (name === query) score += 100;
  // Name starts with query gets high score
  else if (name.startsWith(query)) score += 80;
  // Name contains query gets medium score
  else if (name.includes(query)) score += 60;
  
  // Category match gets high score
  if (category.includes(query)) score += 70;
  
  // Description match gets medium score
  if (description.includes(query)) score += 40;
  
  // Tags match gets medium score
  if (tags.includes(query)) score += 50;
  
  // Boost score based on rating
  if (result.rating) {
    score += (result.rating / 5) * 20;
  }
  
  // Boost score if currently open
  if (result.isCurrentlyOpen) {
    score += 10;
  }
  
  return Math.min(100, score);
};

/**
 * Generate search match highlights for display
 */
export const generateSearchHighlights = (
  result: SearchResultItem,
  searchQuery: string
): SearchResultItem['searchMatchHighlights'] => {
  if (!searchQuery) return undefined;
  
  const query = searchQuery.toLowerCase();
  const highlights: SearchResultItem['searchMatchHighlights'] = {};
  
  // Highlight name matches
  const nameMatches = findMatches(result.name, query);
  if (nameMatches.length > 0) {
    highlights.name = nameMatches;
  }
  
  // Highlight description matches
  if (result.description) {
    const descMatches = findMatches(result.description, query);
    if (descMatches.length > 0) {
      highlights.description = descMatches;
    }
  }
  
  // Highlight tag matches
  if (result.tags && result.tags.length > 0) {
    const tagMatches = findMatches(result.tags.join(' '), query);
    if (tagMatches.length > 0) {
      highlights.tags = tagMatches;
    }
  }
  
  return Object.keys(highlights).length > 0 ? highlights : undefined;
};

/**
 * Find text matches for highlighting
 */
const findMatches = (text: string, query: string): string[] => {
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  const matches = text.match(regex);
  return matches ? [...new Set(matches.map(m => m.toLowerCase()))] : [];
};

/**
 * Escape special regex characters
 */
const escapeRegex = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Filter results based on search query and current filters
 */
export const filterSearchResults = (
  results: SearchResultItem[],
  searchQuery: string,
  filters?: any
): SearchResultItem[] => {
  let filtered = [...results];
  
  // Apply text search filter
  if (searchQuery) {
    filtered = filtered.filter(result => {
      const searchText = `${result.name} ${result.description || ''} ${result.category || ''} ${(result.tags || []).join(' ')}`.toLowerCase();
      return searchText.includes(searchQuery.toLowerCase());
    });
  }
  
  // Apply additional filters if provided
  if (filters) {
    if (filters.openNow) {
      filtered = filtered.filter(result => result.isCurrentlyOpen === true);
    }
    
    if (filters.minimumRating) {
      filtered = filtered.filter(result => (result.rating || 0) >= filters.minimumRating);
    }
    
    if (filters.maxDistance) {
      filtered = filtered.filter(result => result.distance <= filters.maxDistance);
    }
    
    if (filters.category) {
      filtered = filtered.filter(result => result.category === filters.category);
    }
    
    if (filters.priceRange && filters.priceRange.length > 0) {
      filtered = filtered.filter(result => 
        filters.priceRange.includes(result.price_range)
      );
    }
  }
  
  return filtered;
};

/**
 * Generate export data for search results
 */
export const generateExportData = (
  results: SearchResultItem[],
  searchQuery: string,
  sortBy: SearchSortOption,
  currentLocation?: LocationCoordinates
): SearchExportData => {
  return {
    searchQuery,
    timestamp: new Date(),
    location: currentLocation || { latitude: 0, longitude: 0, accuracy: 0, timestamp: 0 },
    sortBy,
    totalResults: results.length,
    results: results.map(result => ({
      ...result,
      // Clean up data for export
      searchMatchHighlights: undefined,
      isBookmarked: undefined
    }))
  };
};

/**
 * Convert search results to CSV format
 */
export const exportToCsv = (data: SearchExportData): string => {
  const headers = [
    'Name',
    'Category',
    'Rating',
    'Distance (km)',
    'Address',
    'Phone',
    'Website',
    'Currently Open',
    'Price Range'
  ];
  
  const rows = data.results.map(result => [
    result.name,
    result.category || '',
    result.rating?.toString() || '',
    result.distance.toFixed(2),
    result.address || '',
    result.phone || '',
    result.website || '',
    result.isCurrentlyOpen ? 'Yes' : 'No',
    result.price_range || ''
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return csvContent;
};

/**
 * Convert search results to JSON format
 */
export const exportToJson = (data: SearchExportData): string => {
  return JSON.stringify(data, null, 2);
};

/**
 * Generate share message for search results
 */
export const generateShareMessage = (
  results: SearchResultItem[],
  searchQuery: string,
  type: 'single' | 'multiple' = 'single'
): { subject: string; message: string } => {
  if (type === 'single' && results.length > 0) {
    const result = results[0];
    return {
      subject: SHARE_TEMPLATES.single.subject,
      message: SHARE_TEMPLATES.single.message(result.name, result.address || 'Address not available')
    };
  }
  
  return {
    subject: SHARE_TEMPLATES.multiple.subject,
    message: SHARE_TEMPLATES.multiple.message(results.length, searchQuery)
  };
};

/**
 * Paginate search results
 */
export const paginateResults = (
  results: SearchResultItem[],
  page: number,
  pageSize: number = 20
): {
  items: SearchResultItem[];
  hasNextPage: boolean;
  totalPages: number;
  currentPage: number;
} => {
  const totalPages = Math.ceil(results.length / pageSize);
  const startIndex = page * pageSize;
  const endIndex = startIndex + pageSize;
  const items = results.slice(startIndex, endIndex);
  
  return {
    items,
    hasNextPage: page < totalPages - 1,
    totalPages,
    currentPage: page
  };
};

/**
 * Format distance for display
 */
export const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }
  return `${distance.toFixed(1)}km`;
};

/**
 * Format rating for display
 */
export const formatRating = (rating?: number): string => {
  if (!rating) return 'No rating';
  return `${rating.toFixed(1)} ⭐`;
};

/**
 * Check if business is currently open based on hours
 */
export const isBusinessOpen = (hours?: any): boolean => {
  if (!hours) return false;
  
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentTime = now.getHours() * 100 + now.getMinutes();
  
  // Simple hours check - this would need to be enhanced based on actual hours format
  const todayHours = hours[currentDay];
  if (!todayHours || todayHours.closed) return false;
  
  const openTime = parseInt(todayHours.open?.replace(':', '') || '0');
  const closeTime = parseInt(todayHours.close?.replace(':', '') || '2359');
  
  return currentTime >= openTime && currentTime <= closeTime;
};

/**
 * Get user-friendly sort label
 */
export const getSortLabel = (sortBy: SearchSortOption): string => {
  const sortMap: { [key in SearchSortOption]: string } = {
    distance: 'Nearest',
    rating: 'Highest Rated',
    relevance: 'Most Relevant',
    newest: 'Recently Added',
    alphabetical: 'A-Z',
    price_low: 'Price: Low',
    price_high: 'Price: High'
  };
  
  return sortMap[sortBy] || 'Default';
};

/**
 * Debounce function for search operations
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
};