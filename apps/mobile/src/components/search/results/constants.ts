import { SearchSortBy } from './types';

export const SORT_OPTIONS: SearchSortBy[] = [
  {
    key: 'distance',
    label: 'Distance',
    icon: 'location',
    description: 'Closest first'
  },
  {
    key: 'rating',
    label: 'Rating',
    icon: 'star',
    description: 'Highest rated first'
  },
  {
    key: 'relevance',
    label: 'Relevance',
    icon: 'search',
    description: 'Most relevant to your search'
  },
  {
    key: 'newest',
    label: 'Recently Added',
    icon: 'clock',
    description: 'Newest businesses first'
  },
  {
    key: 'alphabetical',
    label: 'A-Z',
    icon: 'text',
    description: 'Alphabetical order'
  },
  {
    key: 'price_low',
    label: 'Price: Low to High',
    icon: 'dollar-sign',
    description: 'Most affordable first'
  },
  {
    key: 'price_high',
    label: 'Price: High to Low',
    icon: 'dollar-sign',
    description: 'Premium options first'
  }
];

export const DEFAULT_SORT = 'distance';
export const RESULTS_PER_PAGE = 20;
export const INFINITE_SCROLL_THRESHOLD = 0.7;
export const SEARCH_RESULT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
export const BOOKMARK_STORAGE_KEY = '@buy_locals:bookmarked_results';
export const SORT_PREFERENCE_STORAGE_KEY = '@buy_locals:search_sort_preference';

export const EMPTY_STATE_MESSAGES = {
  no_results: {
    title: 'No businesses found',
    subtitle: 'Try adjusting your search terms or expanding your search area.',
    suggestions: [
      'Check your spelling',
      'Use more general terms',
      'Expand your search radius',
      'Try different categories'
    ]
  },
  no_results_with_filters: {
    title: 'No results match your filters',
    subtitle: 'Try removing some filters to see more options.',
    suggestions: [
      'Clear some filters',
      'Expand distance range',
      'Adjust price range',
      'Try different categories'
    ]
  },
  loading_error: {
    title: 'Unable to load results',
    subtitle: 'Please check your connection and try again.',
    suggestions: [
      'Check internet connection',
      'Try again in a moment',
      'Clear app cache'
    ]
  }
};

export const SHARE_TEMPLATES = {
  single: {
    subject: 'Check out this local business',
    message: (businessName: string, address: string) => 
      `I found this great local business: ${businessName}\n\nLocation: ${address}\n\nShared via BuyLocals`
  },
  multiple: {
    subject: 'Local business recommendations',
    message: (count: number, searchQuery: string) => 
      `I found ${count} great local businesses for "${searchQuery}"\n\nShared via BuyLocals`
  }
};

export const EXPORT_FORMATS = {
  csv: {
    name: 'CSV Spreadsheet',
    extension: 'csv',
    mimeType: 'text/csv'
  },
  json: {
    name: 'JSON Data',
    extension: 'json',
    mimeType: 'application/json'
  }
};

export const HIGHLIGHT_COLORS = {
  primary: '#007AFF',
  secondary: '#FF9500',
  background: '#F0F8FF'
};