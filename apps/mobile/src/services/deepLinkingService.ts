import { Linking } from 'react-native';
import { logger } from '../utils/logger';

export interface PaymentDeepLinkParams {
  paymentIntentId?: string;
  transactionId?: string;
  status: 'success' | 'failed' | 'cancelled';
  redirectUrl?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Deep Linking Service
 * 
 * Handles deep linking for payment confirmation and other app flows
 * Supports URLs like: buylocals://payment-result?status=success&transactionId=123
 */
export class DeepLinkingService {
  private readonly scheme = 'buylocals';
  
  // Deep link URL patterns
  private readonly patterns = {
    paymentResult: `${this.scheme}://payment-result`,
    paymentSuccess: `${this.scheme}://payment-success`,
    paymentFailed: `${this.scheme}://payment-failed`,
    paymentCancelled: `${this.scheme}://payment-cancelled`,
  };

  /**
   * Initialize deep linking listener
   */
  initialize(): void {
    // Listen for incoming deep links
    Linking.addEventListener('url', this.handleDeepLink);

    // Handle deep link if app was opened from a link
    Linking.getInitialURL().then((url) => {
      if (url) {
        logger.info('App opened with initial deep link', { url });
        this.handleDeepLink({ url });
      }
    }).catch((error) => {
      logger.error('Error getting initial deep link URL', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    logger.info('Deep linking service initialized', {
      scheme: this.scheme,
      patterns: Object.keys(this.patterns),
    });
  }

  /**
   * Clean up deep linking listener
   */
  cleanup(): void {
    Linking.removeAllListeners('url');
    logger.info('Deep linking service cleaned up');
  }

  /**
   * Handle incoming deep link
   */
  private handleDeepLink = ({ url }: { url: string }): void => {
    try {
      logger.info('Deep link received', { url });

      const parsedUrl = new URL(url);
      const { protocol, host, pathname, searchParams } = parsedUrl;

      // Validate scheme
      if (`${protocol}//${host}` !== `${this.scheme}://`) {
        logger.warn('Invalid deep link scheme', { url, expectedScheme: this.scheme });
        return;
      }

      // Route based on path
      switch (`${protocol}//${host}${pathname}`) {
        case this.patterns.paymentResult:
          this.handlePaymentResult(searchParams);
          break;
        case this.patterns.paymentSuccess:
          this.handlePaymentSuccess(searchParams);
          break;
        case this.patterns.paymentFailed:
          this.handlePaymentFailed(searchParams);
          break;
        case this.patterns.paymentCancelled:
          this.handlePaymentCancelled(searchParams);
          break;
        default:
          logger.warn('Unknown deep link path', { url, pathname });
          break;
      }

    } catch (error) {
      logger.error('Error handling deep link', {
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Handle payment result deep link
   */
  private handlePaymentResult(searchParams: URLSearchParams): void {
    const params: PaymentDeepLinkParams = {
      paymentIntentId: searchParams.get('paymentIntentId') || undefined,
      transactionId: searchParams.get('transactionId') || undefined,
      status: (searchParams.get('status') as PaymentDeepLinkParams['status']) || 'failed',
      redirectUrl: searchParams.get('redirectUrl') || undefined,
      errorCode: searchParams.get('errorCode') || undefined,
      errorMessage: searchParams.get('errorMessage') || undefined,
    };

    logger.info('Payment result deep link handled', {
      status: params.status,
      transactionId: params.transactionId,
      paymentIntentId: params.paymentIntentId,
    });

    // Emit custom event for payment result
    this.emitPaymentResult(params);
  }

  /**
   * Handle payment success deep link
   */
  private handlePaymentSuccess(searchParams: URLSearchParams): void {
    const params: PaymentDeepLinkParams = {
      paymentIntentId: searchParams.get('paymentIntentId') || undefined,
      transactionId: searchParams.get('transactionId') || undefined,
      status: 'success',
      redirectUrl: searchParams.get('redirectUrl') || undefined,
    };

    logger.info('Payment success deep link handled', {
      transactionId: params.transactionId,
      paymentIntentId: params.paymentIntentId,
    });

    this.emitPaymentResult(params);
  }

  /**
   * Handle payment failed deep link
   */
  private handlePaymentFailed(searchParams: URLSearchParams): void {
    const params: PaymentDeepLinkParams = {
      paymentIntentId: searchParams.get('paymentIntentId') || undefined,
      transactionId: searchParams.get('transactionId') || undefined,
      status: 'failed',
      errorCode: searchParams.get('errorCode') || undefined,
      errorMessage: searchParams.get('errorMessage') || undefined,
    };

    logger.info('Payment failed deep link handled', {
      transactionId: params.transactionId,
      paymentIntentId: params.paymentIntentId,
      errorCode: params.errorCode,
    });

    this.emitPaymentResult(params);
  }

  /**
   * Handle payment cancelled deep link
   */
  private handlePaymentCancelled(searchParams: URLSearchParams): void {
    const params: PaymentDeepLinkParams = {
      paymentIntentId: searchParams.get('paymentIntentId') || undefined,
      transactionId: searchParams.get('transactionId') || undefined,
      status: 'cancelled',
    };

    logger.info('Payment cancelled deep link handled', {
      transactionId: params.transactionId,
      paymentIntentId: params.paymentIntentId,
    });

    this.emitPaymentResult(params);
  }

  /**
   * Emit payment result event for app components to handle
   */
  private emitPaymentResult(params: PaymentDeepLinkParams): void {
    // In a real app, you would use a more robust event system
    // For now, we'll store the result and let components poll for it
    this.lastPaymentResult = params;

    // You could use libraries like EventEmitter or Redux for better event handling
    if (this.paymentResultCallback) {
      this.paymentResultCallback(params);
    }
  }

  /**
   * Generate payment confirmation deep link URL
   */
  generatePaymentResultUrl(params: Partial<PaymentDeepLinkParams>): string {
    const url = new URL(this.patterns.paymentResult);
    
    if (params.paymentIntentId) {
      url.searchParams.set('paymentIntentId', params.paymentIntentId);
    }
    
    if (params.transactionId) {
      url.searchParams.set('transactionId', params.transactionId);
    }
    
    if (params.status) {
      url.searchParams.set('status', params.status);
    }
    
    if (params.redirectUrl) {
      url.searchParams.set('redirectUrl', params.redirectUrl);
    }
    
    if (params.errorCode) {
      url.searchParams.set('errorCode', params.errorCode);
    }
    
    if (params.errorMessage) {
      url.searchParams.set('errorMessage', params.errorMessage);
    }

    logger.debug('Generated payment result URL', { url: url.toString() });
    
    return url.toString();
  }

  /**
   * Generate payment success deep link URL
   */
  generatePaymentSuccessUrl(transactionId: string, paymentIntentId?: string): string {
    const url = new URL(this.patterns.paymentSuccess);
    url.searchParams.set('status', 'success');
    url.searchParams.set('transactionId', transactionId);
    
    if (paymentIntentId) {
      url.searchParams.set('paymentIntentId', paymentIntentId);
    }

    logger.debug('Generated payment success URL', { url: url.toString() });
    
    return url.toString();
  }

  /**
   * Check if a URL is a valid app deep link
   */
  isValidDeepLink(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === `${this.scheme}:`;
    } catch {
      return false;
    }
  }

  /**
   * Open external URL
   */
  async openExternalUrl(url: string): Promise<boolean> {
    try {
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        await Linking.openURL(url);
        logger.info('External URL opened successfully', { url });
        return true;
      } else {
        logger.warn('Cannot open external URL', { url });
        return false;
      }
    } catch (error) {
      logger.error('Error opening external URL', {
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  // Payment result callback and storage for simple event handling
  private lastPaymentResult: PaymentDeepLinkParams | null = null;
  private paymentResultCallback: ((params: PaymentDeepLinkParams) => void) | null = null;

  /**
   * Set callback for payment result events
   */
  setPaymentResultCallback(callback: (params: PaymentDeepLinkParams) => void): void {
    this.paymentResultCallback = callback;
  }

  /**
   * Get last payment result (if any) and clear it
   */
  getAndClearLastPaymentResult(): PaymentDeepLinkParams | null {
    const result = this.lastPaymentResult;
    this.lastPaymentResult = null;
    return result;
  }

  /**
   * Clear payment result callback
   */
  clearPaymentResultCallback(): void {
    this.paymentResultCallback = null;
  }
}

// Export singleton instance
export const deepLinkingService = new DeepLinkingService();
export default deepLinkingService;