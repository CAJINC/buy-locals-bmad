import { Share, Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { SearchResultItem, SearchExportData, SearchShareData } from '../types';
import { 
  generateExportData, 
  exportToCsv, 
  exportToJson, 
  generateShareMessage 
} from '../utils/searchResultUtils';
import { LocationCoordinates } from '../../../../services/locationService';
import { EXPORT_FORMATS } from '../constants';

export interface ExportOptions {
  format: 'csv' | 'json';
  includePhotos: boolean;
  includeCoordinates: boolean;
  includeFullDetails: boolean;
}

export interface ShareOptions {
  type: 'single' | 'multiple';
  includeLink: boolean;
  customMessage?: string;
}

/**
 * Service for handling search results export and sharing functionality
 */
export class SearchResultsExportService {
  /**
   * Export search results to file
   */
  static async exportResults(
    results: SearchResultItem[],
    searchQuery: string,
    sortBy: any,
    currentLocation?: LocationCoordinates,
    options: ExportOptions = {
      format: 'csv',
      includePhotos: false,
      includeCoordinates: true,
      includeFullDetails: true
    }
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      if (results.length === 0) {
        return { success: false, error: 'No results to export' };
      }

      // Generate export data
      const exportData = generateExportData(results, searchQuery, sortBy, currentLocation);
      
      // Process data based on options
      const processedData = this.processExportData(exportData, options);
      
      // Generate file content
      let fileContent: string;
      let fileName: string;
      let mimeType: string;
      
      switch (options.format) {
        case 'csv':
          fileContent = exportToCsv(processedData);
          fileName = `search_results_${Date.now()}.csv`;
          mimeType = EXPORT_FORMATS.csv.mimeType;
          break;
        case 'json':
          fileContent = exportToJson(processedData);
          fileName = `search_results_${Date.now()}.json`;
          mimeType = EXPORT_FORMATS.json.mimeType;
          break;
        default:
          return { success: false, error: 'Unsupported export format' };
      }

      // Write file to document directory
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, fileContent, {
        encoding: FileSystem.EncodingType.UTF8
      });

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType,
          dialogTitle: `Export Search Results (${options.format.toUpperCase()})`,
          UTI: options.format === 'csv' ? 'public.comma-separated-values-text' : 'public.json'
        });
      } else {
        Alert.alert(
          'Export Complete',
          `Results exported to: ${fileName}`,
          [{ text: 'OK' }]
        );
      }

      return { success: true, filePath };
    } catch (error) {
      console.error('Export failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Export failed' 
      };
    }
  }

  /**
   * Share search results via native sharing
   */
  static async shareResults(
    results: SearchResultItem[],
    searchQuery: string,
    options: ShareOptions = {
      type: results.length === 1 ? 'single' : 'multiple',
      includeLink: true
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (results.length === 0) {
        return { success: false, error: 'No results to share' };
      }

      // Generate share message
      const { subject, message } = generateShareMessage(results, searchQuery, options.type);
      
      // Customize message if provided
      const finalMessage = options.customMessage ? 
        `${options.customMessage}\n\n${message}` : 
        message;

      // Prepare share data
      const shareData: any = {
        title: subject,
        message: finalMessage,
      };

      // Add URL for single business on iOS
      if (options.type === 'single' && Platform.OS === 'ios' && results[0].website) {
        shareData.url = results[0].website;
      }

      // Share via native API
      const shareResult = await Share.share(shareData, {
        dialogTitle: subject,
        excludedActivityTypes: [
          // Exclude some activity types that don't work well
          'com.apple.UIKit.activity.AirDrop',
        ]
      });

      if (shareResult.action === Share.sharedAction) {
        return { success: true };
      } else if (shareResult.action === Share.dismissedAction) {
        return { success: false, error: 'Share dismissed by user' };
      }

      return { success: true };
    } catch (error) {
      console.error('Share failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Share failed' 
      };
    }
  }

  /**
   * Export and share search results as file attachment
   */
  static async exportAndShare(
    results: SearchResultItem[],
    searchQuery: string,
    sortBy: any,
    currentLocation?: LocationCoordinates,
    exportOptions: ExportOptions = {
      format: 'csv',
      includePhotos: false,
      includeCoordinates: true,
      includeFullDetails: true
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const exportResult = await this.exportResults(
        results,
        searchQuery,
        sortBy,
        currentLocation,
        exportOptions
      );

      if (!exportResult.success) {
        return exportResult;
      }

      return { success: true };
    } catch (error) {
      console.error('Export and share failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Export and share failed' 
      };
    }
  }

  /**
   * Share individual business
   */
  static async shareIndividualBusiness(
    business: SearchResultItem,
    customMessage?: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.shareResults([business], '', {
      type: 'single',
      includeLink: true,
      customMessage
    });
  }

  /**
   * Create shareable link for search results (if web app exists)
   */
  static generateShareableLink(
    searchQuery: string,
    location?: LocationCoordinates,
    filters?: any
  ): string {
    // In a real app, this would generate a deep link or web URL
    const baseUrl = 'https://buylocals.app/search';
    const params = new URLSearchParams();
    
    if (searchQuery) params.append('q', searchQuery);
    if (location) {
      params.append('lat', location.latitude.toString());
      params.append('lng', location.longitude.toString());
    }
    if (filters) {
      params.append('filters', JSON.stringify(filters));
    }
    
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Process export data based on options
   */
  private static processExportData(
    exportData: SearchExportData,
    options: ExportOptions
  ): SearchExportData {
    const processedResults = exportData.results.map(result => {
      const processed: any = { ...result };
      
      // Remove photos if not included
      if (!options.includePhotos) {
        delete processed.photos;
      }
      
      // Remove coordinates if not included
      if (!options.includeCoordinates) {
        delete processed.coordinates;
      }
      
      // Remove detailed fields if not included
      if (!options.includeFullDetails) {
        delete processed.description;
        delete processed.hours;
        delete processed.tags;
        delete processed.searchMatchHighlights;
        delete processed.isBookmarked;
        delete processed.lastVisited;
      }
      
      return processed;
    });
    
    return {
      ...exportData,
      results: processedResults
    };
  }

  /**
   * Get available export formats
   */
  static getAvailableFormats(): Array<{
    key: string;
    name: string;
    extension: string;
    description: string;
  }> {
    return [
      {
        key: 'csv',
        name: EXPORT_FORMATS.csv.name,
        extension: EXPORT_FORMATS.csv.extension,
        description: 'Spreadsheet format, compatible with Excel and Google Sheets'
      },
      {
        key: 'json',
        name: EXPORT_FORMATS.json.name,
        extension: EXPORT_FORMATS.json.extension,
        description: 'Structured data format, great for developers'
      }
    ];
  }

  /**
   * Validate export options
   */
  static validateExportOptions(options: Partial<ExportOptions>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (options.format && !['csv', 'json'].includes(options.format)) {
      errors.push('Invalid export format. Must be csv or json.');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get file size estimate for export
   */
  static estimateFileSize(
    resultCount: number,
    format: 'csv' | 'json',
    includeFullDetails: boolean = true
  ): {
    estimatedSize: number; // in bytes
    estimatedSizeFormatted: string;
  } {
    // Rough estimates based on average business data
    const avgBusinessSize = includeFullDetails ? 800 : 400; // bytes
    let estimatedSize = resultCount * avgBusinessSize;
    
    // JSON typically 20% larger than CSV due to structure
    if (format === 'json') {
      estimatedSize *= 1.2;
    }
    
    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    
    return {
      estimatedSize,
      estimatedSizeFormatted: formatSize(estimatedSize)
    };
  }
}