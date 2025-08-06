import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { NativeBaseProvider } from 'native-base';
import { AppNavigator } from './navigation/AppNavigator';
import { navigationRef } from './services/navigationService';
import { linking, linkingService } from './services/linkingService';
import * as Linking from 'expo-linking';

const App: React.FC = () => {
  useEffect(() => {
    // Handle deep links when app is already running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('Deep link received:', url);
      const linkData = linkingService.handleDeepLink(url);
      
      if (linkData.type === 'business' && linkData.businessId) {
        // Navigate to business profile
        navigationRef.current?.navigate('BusinessProfile', {
          businessId: linkData.businessId,
        });
      }
    });

    // Handle deep link that opened the app (cold start)
    linkingService.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial deep link:', url);
        const linkData = linkingService.handleDeepLink(url);
        
        if (linkData.type === 'business' && linkData.businessId) {
          // Navigate to business profile after navigation is ready
          setTimeout(() => {
            navigationRef.current?.navigate('BusinessProfile', {
              businessId: linkData.businessId!,
            });
          }, 100);
        }
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  return (
    <NativeBaseProvider>
      <NavigationContainer 
        ref={navigationRef}
        linking={linking}
        fallback={null}
      >
        <AppNavigator />
      </NavigationContainer>
    </NativeBaseProvider>
  );
};

export default App;