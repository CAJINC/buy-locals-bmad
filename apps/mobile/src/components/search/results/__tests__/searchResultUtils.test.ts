import {
  sortSearchResults,
  calculateRelevanceScore,
  generateSearchHighlights,
  filterSearchResults,
  formatDistance,
  formatRating,
  isBusinessOpen,
  getSortLabel,
  generateExportData,
  exportToCsv,
  exportToJson,
  generateShareMessage,
  paginateResults
} from '../utils/searchResultUtils';
import { SearchResultItem } from '../types';

const mockResults: SearchResultItem[] = [
  {
    id: '1',
    name: 'Coffee Bean Café',
    category: 'restaurant',
    coordinates: { latitude: 37.7749, longitude: -122.4194 },
    address: '123 Main St',
    rating: 4.5,
    review_count: 100,
    price_range: '$$',
    phone: '555-1234',
    website: 'https://coffee.com',
    photos: [],
    hours: {
      0: { open: '07:00', close: '20:00', closed: false }, // Sunday
      1: { open: '06:00', close: '21:00', closed: false }, // Monday
      2: { open: '06:00', close: '21:00', closed: false }, // Tuesday
      3: { open: '06:00', close: '21:00', closed: false }, // Wednesday
      4: { open: '06:00', close: '21:00', closed: false }, // Thursday
      5: { open: '06:00', close: '22:00', closed: false }, // Friday
      6: { open: '07:00', close: '22:00', closed: false }, // Saturday
    },
    tags: ['coffee', 'breakfast', 'wifi'],
    description: 'Great coffee shop with excellent espresso and pastries',
    distance: 0.5,
    isCurrentlyOpen: true,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-20T00:00:00Z',
    isBookmarked: false
  },
  {
    id: '2',
    name: 'Pizza Palace',
    category: 'restaurant',
    coordinates: { latitude: 37.7849, longitude: -122.4094 },
    address: '456 Oak Ave',
    rating: 4.2,
    review_count: 80,
    price_range: '$$$',
    phone: '555-5678',
    website: 'https://pizza.com',
    photos: [],
    hours: {},
    tags: ['pizza', 'italian', 'dinner'],
    description: 'Authentic Italian pizza with fresh ingredients',
    distance: 1.2,
    isCurrentlyOpen: false,
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-01-18T00:00:00Z',
    isBookmarked: false
  },
  {
    id: '3',
    name: 'Book Nook Coffee',
    category: 'retail',
    coordinates: { latitude: 37.7649, longitude: -122.4294 },
    address: '789 Pine St',
    rating: 4.8,
    review_count: 45,
    price_range: '$',
    phone: '555-9012',
    website: 'https://booknook.com',
    photos: [],
    hours: {},
    tags: ['books', 'coffee', 'reading'],
    description: 'Cozy bookstore with great coffee and reading areas',
    distance: 0.8,
    isCurrentlyOpen: true,
    created_at: '2024-01-20T00:00:00Z',
    updated_at: '2024-01-22T00:00:00Z',
    isBookmarked: true
  }
];

const mockLocation = {
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 10,
  timestamp: Date.now()
};

describe('searchResultUtils', () => {
  describe('sortSearchResults', () => {
    it('sorts by distance correctly', () => {
      const sorted = sortSearchResults(mockResults, 'distance', mockLocation);
      expect(sorted[0].id).toBe('1'); // 0.5km
      expect(sorted[1].id).toBe('3'); // 0.8km
      expect(sorted[2].id).toBe('2'); // 1.2km
    });

    it('sorts by rating correctly', () => {
      const sorted = sortSearchResults(mockResults, 'rating', mockLocation);
      expect(sorted[0].id).toBe('3'); // 4.8
      expect(sorted[1].id).toBe('1'); // 4.5
      expect(sorted[2].id).toBe('2'); // 4.2
    });

    it('sorts alphabetically correctly', () => {
      const sorted = sortSearchResults(mockResults, 'alphabetical', mockLocation);
      expect(sorted[0].name).toBe('Book Nook Coffee');
      expect(sorted[1].name).toBe('Coffee Bean Café');
      expect(sorted[2].name).toBe('Pizza Palace');
    });

    it('sorts by newest correctly', () => {
      const sorted = sortSearchResults(mockResults, 'newest', mockLocation);
      expect(sorted[0].id).toBe('3'); // 2024-01-20
      expect(sorted[1].id).toBe('1'); // 2024-01-15
      expect(sorted[2].id).toBe('2'); // 2024-01-10
    });

    it('sorts by price low to high correctly', () => {
      const sorted = sortSearchResults(mockResults, 'price_low', mockLocation);
      expect(sorted[0].id).toBe('3'); // $
      expect(sorted[1].id).toBe('1'); // $$
      expect(sorted[2].id).toBe('2'); // $$$
    });

    it('sorts by price high to low correctly', () => {
      const sorted = sortSearchResults(mockResults, 'price_high', mockLocation);
      expect(sorted[0].id).toBe('2'); // $$$
      expect(sorted[1].id).toBe('1'); // $$
      expect(sorted[2].id).toBe('3'); // $
    });
  });

  describe('calculateRelevanceScore', () => {
    it('gives high score for exact name match', () => {
      const result = mockResults[0];
      const score = calculateRelevanceScore(result, 'Coffee Bean Café');
      expect(score).toBeGreaterThan(90);
    });

    it('gives medium score for partial name match', () => {
      const result = mockResults[0];
      const score = calculateRelevanceScore(result, 'coffee');
      expect(score).toBeGreaterThan(50);
      expect(score).toBeLessThan(90);
    });

    it('gives score for category match', () => {
      const result = mockResults[0];
      const score = calculateRelevanceScore(result, 'restaurant');
      expect(score).toBeGreaterThan(0);
    });

    it('gives score for tag match', () => {
      const result = mockResults[0];
      const score = calculateRelevanceScore(result, 'wifi');
      expect(score).toBeGreaterThan(0);
    });

    it('boosts score for higher rating', () => {
      const lowRated = { ...mockResults[0], rating: 2.0 };
      const highRated = { ...mockResults[0], rating: 5.0 };
      
      const lowScore = calculateRelevanceScore(lowRated, 'coffee');
      const highScore = calculateRelevanceScore(highRated, 'coffee');
      
      expect(highScore).toBeGreaterThan(lowScore);
    });

    it('boosts score for currently open businesses', () => {
      const closed = { ...mockResults[0], isCurrentlyOpen: false };
      const open = { ...mockResults[0], isCurrentlyOpen: true };
      
      const closedScore = calculateRelevanceScore(closed, 'coffee');
      const openScore = calculateRelevanceScore(open, 'coffee');
      
      expect(openScore).toBeGreaterThan(closedScore);
    });
  });

  describe('generateSearchHighlights', () => {
    it('generates highlights for name matches', () => {
      const result = mockResults[0];
      const highlights = generateSearchHighlights(result, 'coffee');
      
      expect(highlights?.name).toContain('coffee');
    });

    it('generates highlights for description matches', () => {
      const result = mockResults[0];
      const highlights = generateSearchHighlights(result, 'espresso');
      
      expect(highlights?.description).toContain('espresso');
    });

    it('generates highlights for tag matches', () => {
      const result = mockResults[0];
      const highlights = generateSearchHighlights(result, 'wifi');
      
      expect(highlights?.tags).toContain('wifi');
    });

    it('returns undefined for no matches', () => {
      const result = mockResults[0];
      const highlights = generateSearchHighlights(result, 'xyznomatch');
      
      expect(highlights).toBeUndefined();
    });

    it('handles empty search query', () => {
      const result = mockResults[0];
      const highlights = generateSearchHighlights(result, '');
      
      expect(highlights).toBeUndefined();
    });
  });

  describe('filterSearchResults', () => {
    it('filters by text search', () => {
      const filtered = filterSearchResults(mockResults, 'coffee');
      expect(filtered.length).toBe(2); // Coffee Bean Café and Book Nook Coffee
    });

    it('filters by open now', () => {
      const filtered = filterSearchResults(mockResults, '', { openNow: true });
      const openResults = filtered.filter(r => r.isCurrentlyOpen);
      expect(openResults.length).toBe(filtered.length);
    });

    it('filters by minimum rating', () => {
      const filtered = filterSearchResults(mockResults, '', { minimumRating: 4.5 });
      expect(filtered.every(r => (r.rating || 0) >= 4.5)).toBe(true);
    });

    it('filters by maximum distance', () => {
      const filtered = filterSearchResults(mockResults, '', { maxDistance: 1.0 });
      expect(filtered.every(r => r.distance <= 1.0)).toBe(true);
    });

    it('filters by category', () => {
      const filtered = filterSearchResults(mockResults, '', { category: 'restaurant' });
      expect(filtered.every(r => r.category === 'restaurant')).toBe(true);
    });

    it('filters by price range', () => {
      const filtered = filterSearchResults(mockResults, '', { priceRange: ['$', '$$'] });
      expect(filtered.every(r => ['$', '$$'].includes(r.price_range || ''))).toBe(true);
    });
  });

  describe('formatDistance', () => {
    it('formats distance less than 1km in meters', () => {
      expect(formatDistance(0.5)).toBe('500m');
      expect(formatDistance(0.15)).toBe('150m');
    });

    it('formats distance 1km or more in kilometers', () => {
      expect(formatDistance(1.0)).toBe('1.0km');
      expect(formatDistance(2.5)).toBe('2.5km');
    });
  });

  describe('formatRating', () => {
    it('formats rating with star emoji', () => {
      expect(formatRating(4.5)).toBe('4.5 ⭐');
      expect(formatRating(3.2)).toBe('3.2 ⭐');
    });

    it('handles no rating', () => {
      expect(formatRating()).toBe('No rating');
      expect(formatRating(undefined)).toBe('No rating');
    });
  });

  describe('isBusinessOpen', () => {
    // Mock current time to be Monday 10:00 AM
    const mockDate = new Date('2024-01-22T10:00:00'); // Monday
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

    it('returns true for open business during hours', () => {
      const hours = {
        1: { open: '09:00', close: '17:00', closed: false } // Monday
      };
      expect(isBusinessOpen(hours)).toBe(true);
    });

    it('returns false for closed business', () => {
      const hours = {
        1: { open: '14:00', close: '17:00', closed: false } // Monday, opens later
      };
      expect(isBusinessOpen(hours)).toBe(false);
    });

    it('returns false for business closed on current day', () => {
      const hours = {
        1: { closed: true } // Monday is closed
      };
      expect(isBusinessOpen(hours)).toBe(false);
    });

    it('returns false for no hours data', () => {
      expect(isBusinessOpen()).toBe(false);
      expect(isBusinessOpen({})).toBe(false);
    });
  });

  describe('getSortLabel', () => {
    it('returns correct labels for sort options', () => {
      expect(getSortLabel('distance')).toBe('Nearest');
      expect(getSortLabel('rating')).toBe('Highest Rated');
      expect(getSortLabel('relevance')).toBe('Most Relevant');
      expect(getSortLabel('newest')).toBe('Recently Added');
      expect(getSortLabel('alphabetical')).toBe('A-Z');
      expect(getSortLabel('price_low')).toBe('Price: Low');
      expect(getSortLabel('price_high')).toBe('Price: High');
    });

    it('returns default for unknown sort option', () => {
      expect(getSortLabel('unknown' as any)).toBe('Default');
    });
  });

  describe('generateExportData', () => {
    it('creates export data with all required fields', () => {
      const exportData = generateExportData(
        mockResults,
        'coffee',
        'distance',
        mockLocation
      );

      expect(exportData.searchQuery).toBe('coffee');
      expect(exportData.sortBy).toBe('distance');
      expect(exportData.totalResults).toBe(mockResults.length);
      expect(exportData.results).toHaveLength(mockResults.length);
      expect(exportData.location).toEqual(mockLocation);
      expect(exportData.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('exportToCsv', () => {
    it('generates valid CSV format', () => {
      const exportData = generateExportData(
        mockResults.slice(0, 1),
        'coffee',
        'distance',
        mockLocation
      );
      
      const csv = exportToCsv(exportData);
      const lines = csv.split('\n');
      
      expect(lines[0]).toContain('Name,Category,Rating'); // Headers
      expect(lines[1]).toContain('Coffee Bean Café'); // Data
    });

    it('handles special characters in CSV', () => {
      const resultWithComma = {
        ...mockResults[0],
        name: 'Café, Coffee & More',
        description: 'A place with "quotes" and commas, lots of them'
      };
      
      const exportData = generateExportData(
        [resultWithComma],
        'coffee',
        'distance',
        mockLocation
      );
      
      const csv = exportToCsv(exportData);
      expect(csv).toContain('"Café, Coffee & More"');
      expect(csv).toContain('"A place with "quotes" and commas, lots of them"');
    });
  });

  describe('exportToJson', () => {
    it('generates valid JSON format', () => {
      const exportData = generateExportData(
        mockResults.slice(0, 1),
        'coffee',
        'distance',
        mockLocation
      );
      
      const json = exportToJson(exportData);
      const parsed = JSON.parse(json);
      
      expect(parsed.searchQuery).toBe('coffee');
      expect(parsed.results).toHaveLength(1);
      expect(parsed.results[0].name).toBe('Coffee Bean Café');
    });
  });

  describe('generateShareMessage', () => {
    it('generates single business share message', () => {
      const { subject, message } = generateShareMessage(
        [mockResults[0]],
        'coffee',
        'single'
      );
      
      expect(subject).toBe('Check out this local business');
      expect(message).toContain('Coffee Bean Café');
      expect(message).toContain('123 Main St');
    });

    it('generates multiple business share message', () => {
      const { subject, message } = generateShareMessage(
        mockResults,
        'coffee',
        'multiple'
      );
      
      expect(subject).toBe('Local business recommendations');
      expect(message).toContain('3 great local businesses');
      expect(message).toContain('coffee');
    });
  });

  describe('paginateResults', () => {
    it('paginates results correctly', () => {
      const { items, hasNextPage, totalPages, currentPage } = paginateResults(
        mockResults,
        0,
        2
      );
      
      expect(items).toHaveLength(2);
      expect(hasNextPage).toBe(true);
      expect(totalPages).toBe(2);
      expect(currentPage).toBe(0);
    });

    it('handles last page correctly', () => {
      const { items, hasNextPage } = paginateResults(
        mockResults,
        1,
        2
      );
      
      expect(items).toHaveLength(1); // Last item
      expect(hasNextPage).toBe(false);
    });

    it('handles empty results', () => {
      const { items, hasNextPage, totalPages } = paginateResults(
        [],
        0,
        10
      );
      
      expect(items).toHaveLength(0);
      expect(hasNextPage).toBe(false);
      expect(totalPages).toBe(0);
    });
  });
});