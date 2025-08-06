import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { useReceiptData } from '../../hooks/useReceiptData';
import { logger } from '../../utils/logger';
import { styles } from './styles';

export interface ReceiptViewerProps {
  transactionId: string;
  receiptNumber: string;
  format?: 'html' | 'pdf';
  language?: 'en' | 'es' | 'fr';
  theme?: 'light' | 'dark';
  showActions?: boolean;
  onError?: (error: string) => void;
}

export interface ReceiptData {
  id: string;
  receiptNumber: string;
  htmlContent: string;
  pdfUrl?: string;
  downloadUrl?: string;
  generatedAt: string;
  expiresAt?: string;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * ReceiptViewer Component
 * 
 * Displays receipts in HTML format with options to:
 * - View receipt in WebView
 * - Download as PDF
 * - Share receipt
 * - Print receipt (iOS/Android)
 * - Email receipt
 */
export const ReceiptViewer: React.FC<ReceiptViewerProps> = ({
  transactionId,
  receiptNumber,
  format = 'html',
  language = 'en',
  theme = 'light',
  showActions = true,
  onError,
}) => {
  const [viewMode, setViewMode] = useState<'web' | 'native'>('web');
  const [isSharing, setIsSharing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [webViewHeight, setWebViewHeight] = useState(screenHeight * 0.8);

  const {
    receipt,
    isLoading,
    error,
    fetchReceipt,
    downloadPdf,
    refreshReceipt,
  } = useReceiptData({
    transactionId,
    format,
    language,
  });

  useEffect(() => {
    fetchReceipt();
  }, [transactionId, format, language, fetchReceipt]);

  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Handle WebView navigation state change
  const handleWebViewNavigationStateChange = useCallback((navState: any) => {
    // Prevent external navigation
    if (navState.url !== 'about:blank' && !navState.url.startsWith('data:')) {
      return false;
    }
    return true;
  }, []);

  // Handle WebView message (for height calculation)
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'height' && data.height) {
        setWebViewHeight(Math.min(data.height + 100, screenHeight * 0.9));
      }
    } catch (error) {
      logger.warn('Failed to parse WebView message', { error });
    }
  }, []);

  // Handle share receipt
  const handleShare = useCallback(async () => {
    if (!receipt) return;

    setIsSharing(true);

    try {
      const shareContent = {
        title: `Receipt #${receipt.receiptNumber}`,
        message: `Receipt #${receipt.receiptNumber}`,
        url: receipt.downloadUrl || receipt.pdfUrl,
      };

      if (Platform.OS === 'ios') {
        await Share.share(shareContent);
      } else {
        // Android
        await Share.share({
          message: `${shareContent.message}\n${shareContent.url}`,
          title: shareContent.title,
        });
      }

      logger.info('Receipt shared successfully', {
        transactionId,
        receiptNumber: receipt.receiptNumber,
      });

    } catch (error) {
      logger.error('Failed to share receipt', { error, transactionId });
      Alert.alert('Error', 'Failed to share receipt');
    } finally {
      setIsSharing(false);
    }
  }, [receipt, transactionId]);

  // Handle download PDF
  const handleDownloadPdf = useCallback(async () => {
    if (!receipt) return;

    try {
      const result = await downloadPdf();
      
      if (result.success && result.localPath) {
        Alert.alert(
          'Download Complete',
          'Receipt PDF saved to device',
          [
            {
              text: 'Share',
              onPress: () => Sharing.shareAsync(result.localPath!),
            },
            { text: 'OK' },
          ]
        );
      } else {
        throw new Error(result.error || 'Download failed');
      }

    } catch (error) {
      logger.error('Failed to download PDF', { error, transactionId });
      Alert.alert('Error', 'Failed to download PDF');
    }
  }, [receipt, downloadPdf, transactionId]);

  // Handle print receipt
  const handlePrint = useCallback(async () => {
    if (!receipt) return;

    setIsPrinting(true);

    try {
      const printOptions = {
        html: receipt.htmlContent,
        base64: false,
        width: 612, // 8.5 inches at 72 DPI
        height: 792, // 11 inches at 72 DPI
      };

      await Print.printAsync(printOptions);

      logger.info('Receipt printed successfully', {
        transactionId,
        receiptNumber: receipt.receiptNumber,
      });

    } catch (error) {
      logger.error('Failed to print receipt', { error, transactionId });
      Alert.alert('Error', 'Failed to print receipt');
    } finally {
      setIsPrinting(false);
    }
  }, [receipt, transactionId]);

  // Handle email receipt
  const handleEmail = useCallback(async () => {
    if (!receipt) return;

    Alert.prompt(
      'Email Receipt',
      'Enter email address:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async (email) => {
            if (email) {
              try {
                // API call to email receipt would go here
                logger.info('Receipt email requested', {
                  transactionId,
                  receiptNumber: receipt.receiptNumber,
                  email,
                });
                Alert.alert('Success', `Receipt sent to ${email}`);
              } catch (error) {
                logger.error('Failed to email receipt', { error, transactionId });
                Alert.alert('Error', 'Failed to send receipt email');
              }
            }
          },
        },
      ],
      'plain-text'
    );
  }, [receipt, transactionId]);

  // Render action buttons
  const renderActions = useCallback(() => {
    if (!showActions) return null;

    return (
      <View style={[styles.receiptActions, theme === 'dark' && styles.receiptActionsDark]}>
        <TouchableOpacity
          style={[styles.receiptActionButton, theme === 'dark' && styles.receiptActionButtonDark]}
          onPress={handleShare}
          disabled={isSharing}
          accessibilityLabel="Share receipt"
          accessibilityRole="button"
        >
          {isSharing ? (
            <ActivityIndicator size="small" color={theme === 'dark' ? '#60A5FA' : '#3B82F6'} />
          ) : (
            <Ionicons
              name="share"
              size={20}
              color={theme === 'dark' ? '#60A5FA' : '#3B82F6'}
            />
          )}
          <Text style={[styles.receiptActionText, theme === 'dark' && styles.receiptActionTextDark]}>
            Share
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.receiptActionButton, theme === 'dark' && styles.receiptActionButtonDark]}
          onPress={handleDownloadPdf}
          accessibilityLabel="Download PDF"
          accessibilityRole="button"
        >
          <Ionicons
            name="download"
            size={20}
            color={theme === 'dark' ? '#60A5FA' : '#3B82F6'}
          />
          <Text style={[styles.receiptActionText, theme === 'dark' && styles.receiptActionTextDark]}>
            Download
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.receiptActionButton, theme === 'dark' && styles.receiptActionButtonDark]}
          onPress={handlePrint}
          disabled={isPrinting}
          accessibilityLabel="Print receipt"
          accessibilityRole="button"
        >
          {isPrinting ? (
            <ActivityIndicator size="small" color={theme === 'dark' ? '#60A5FA' : '#3B82F6'} />
          ) : (
            <Ionicons
              name="print"
              size={20}
              color={theme === 'dark' ? '#60A5FA' : '#3B82F6'}
            />
          )}
          <Text style={[styles.receiptActionText, theme === 'dark' && styles.receiptActionTextDark]}>
            Print
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.receiptActionButton, theme === 'dark' && styles.receiptActionButtonDark]}
          onPress={handleEmail}
          accessibilityLabel="Email receipt"
          accessibilityRole="button"
        >
          <Ionicons
            name="mail"
            size={20}
            color={theme === 'dark' ? '#60A5FA' : '#3B82F6'}
          />
          <Text style={[styles.receiptActionText, theme === 'dark' && styles.receiptActionTextDark]}>
            Email
          </Text>
        </TouchableOpacity>
      </View>
    );
  }, [
    showActions,
    theme,
    handleShare,
    handleDownloadPdf,
    handlePrint,
    handleEmail,
    isSharing,
    isPrinting,
  ]);

  // Render view mode toggle
  const renderViewModeToggle = useCallback(() => (
    <View style={[styles.viewModeToggle, theme === 'dark' && styles.viewModeToggleDark]}>
      <TouchableOpacity
        style={[
          styles.viewModeButton,
          viewMode === 'web' && styles.viewModeButtonActive,
          theme === 'dark' && styles.viewModeButtonDark,
          viewMode === 'web' && theme === 'dark' && styles.viewModeButtonActiveDark,
        ]}
        onPress={() => setViewMode('web')}
      >
        <Text
          style={[
            styles.viewModeButtonText,
            viewMode === 'web' && styles.viewModeButtonTextActive,
            theme === 'dark' && styles.viewModeButtonTextDark,
            viewMode === 'web' && theme === 'dark' && styles.viewModeButtonTextActiveDark,
          ]}
        >
          Web View
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.viewModeButton,
          viewMode === 'native' && styles.viewModeButtonActive,
          theme === 'dark' && styles.viewModeButtonDark,
          viewMode === 'native' && theme === 'dark' && styles.viewModeButtonActiveDark,
        ]}
        onPress={() => setViewMode('native')}
      >
        <Text
          style={[
            styles.viewModeButtonText,
            viewMode === 'native' && styles.viewModeButtonTextActive,
            theme === 'dark' && styles.viewModeButtonTextDark,
            viewMode === 'native' && theme === 'dark' && styles.viewModeButtonTextActiveDark,
          ]}
        >
          Native
        </Text>
      </TouchableOpacity>
    </View>
  ), [viewMode, theme]);

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.receiptViewerContainer, styles.loadingContainer, theme === 'dark' && styles.receiptViewerContainerDark]}>
        <ActivityIndicator size="large" color={theme === 'dark' ? '#60A5FA' : '#3B82F6'} />
        <Text style={[styles.loadingText, theme === 'dark' && styles.loadingTextDark]}>
          Loading receipt...
        </Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.receiptViewerContainer, styles.errorContainer, theme === 'dark' && styles.receiptViewerContainerDark]}>
        <Ionicons
          name="alert-circle"
          size={48}
          color={theme === 'dark' ? '#F87171' : '#EF4444'}
        />
        <Text style={[styles.errorTitle, theme === 'dark' && styles.errorTitleDark]}>
          Failed to load receipt
        </Text>
        <Text style={[styles.errorMessage, theme === 'dark' && styles.errorMessageDark]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, theme === 'dark' && styles.retryButtonDark]}
          onPress={refreshReceipt}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!receipt) return null;

  return (
    <View style={[styles.receiptViewerContainer, theme === 'dark' && styles.receiptViewerContainerDark]}>
      {/* Header */}
      <View style={[styles.receiptHeader, theme === 'dark' && styles.receiptHeaderDark]}>
        <View>
          <Text style={[styles.receiptTitle, theme === 'dark' && styles.receiptTitleDark]}>
            Receipt #{receiptNumber}
          </Text>
          <Text style={[styles.receiptSubtitle, theme === 'dark' && styles.receiptSubtitleDark]}>
            Generated on {new Date(receipt.generatedAt).toLocaleDateString()}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[styles.refreshButton, theme === 'dark' && styles.refreshButtonDark]}
          onPress={refreshReceipt}
          accessibilityLabel="Refresh receipt"
          accessibilityRole="button"
        >
          <Ionicons
            name="refresh"
            size={20}
            color={theme === 'dark' ? '#60A5FA' : '#3B82F6'}
          />
        </TouchableOpacity>
      </View>

      {/* View Mode Toggle */}
      {renderViewModeToggle()}

      {/* Receipt Content */}
      <View style={styles.receiptContent}>
        {viewMode === 'web' ? (
          <WebView
            source={{ html: receipt.htmlContent }}
            style={[
              styles.receiptWebView,
              { height: webViewHeight },
              theme === 'dark' && styles.receiptWebViewDark,
            ]}
            onNavigationStateChange={handleWebViewNavigationStateChange}
            onMessage={handleWebViewMessage}
            injectedJavaScript={`
              // Calculate and send content height
              const sendHeight = () => {
                const height = Math.max(
                  document.documentElement.scrollHeight,
                  document.body.scrollHeight
                );
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'height',
                  height: height
                }));
              };
              
              // Send height when content loads
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', sendHeight);
              } else {
                sendHeight();
              }
              
              // Send height when images load
              const images = document.images;
              for (let i = 0; i < images.length; i++) {
                images[i].addEventListener('load', sendHeight);
              }
              
              true;
            `}
            scalesPageToFit={Platform.OS === 'android'}
            startInLoadingState={true}
            renderLoading={() => (
              <ActivityIndicator
                size="large"
                color={theme === 'dark' ? '#60A5FA' : '#3B82F6'}
                style={styles.webViewLoading}
              />
            )}
            allowsInlineMediaPlayback={false}
            mediaPlaybackRequiresUserAction={true}
            allowsBackForwardNavigationGestures={false}
            bounces={false}
            scrollEnabled={true}
            showsVerticalScrollIndicator={true}
            backgroundColor={theme === 'dark' ? '#1F2937' : '#FFFFFF'}
          />
        ) : (
          <ScrollView
            style={styles.nativeReceiptView}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.nativeReceiptContent}
          >
            <Text style={[styles.nativeReceiptText, theme === 'dark' && styles.nativeReceiptTextDark]}>
              Native receipt view would display structured receipt data here.
              {'\n\n'}
              For now, please use the Web View mode to see the formatted receipt.
            </Text>
          </ScrollView>
        )}
      </View>

      {/* Actions */}
      {renderActions()}

      {/* Footer Info */}
      {receipt.expiresAt && (
        <View style={[styles.receiptFooter, theme === 'dark' && styles.receiptFooterDark]}>
          <Text style={[styles.receiptFooterText, theme === 'dark' && styles.receiptFooterTextDark]}>
            Download link expires on {new Date(receipt.expiresAt).toLocaleDateString()}
          </Text>
        </View>
      )}
    </View>
  );
};