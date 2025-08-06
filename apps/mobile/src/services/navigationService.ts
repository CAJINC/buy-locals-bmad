import { createNavigationContainerRef, NavigationAction, StackActions } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

class NavigationService {
  /**
   * Navigate to a specific screen
   */
  navigate<RouteName extends keyof RootStackParamList>(
    name: RouteName,
    params?: RootStackParamList[RouteName]
  ) {
    if (navigationRef.isReady()) {
      navigationRef.navigate(name, params);
    }
  }

  /**
   * Go back to previous screen
   */
  goBack() {
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
      navigationRef.goBack();
    }
  }

  /**
   * Replace current screen with a new one
   */
  replace<RouteName extends keyof RootStackParamList>(
    name: RouteName,
    params?: RootStackParamList[RouteName]
  ) {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(StackActions.replace(name, params));
    }
  }

  /**
   * Reset navigation stack to a specific screen
   */
  reset<RouteName extends keyof RootStackParamList>(
    name: RouteName,
    params?: RootStackParamList[RouteName]
  ) {
    if (navigationRef.isReady()) {
      navigationRef.reset({
        index: 0,
        routes: [{ name, params }],
      });
    }
  }

  /**
   * Push a new screen onto the stack
   */
  push<RouteName extends keyof RootStackParamList>(
    name: RouteName,
    params?: RootStackParamList[RouteName]
  ) {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(StackActions.push(name, params));
    }
  }

  /**
   * Navigate to business profile after creation
   */
  navigateToBusinessProfile(businessId: string, business?: any) {
    this.navigate('BusinessProfile', { businessId, business });
  }

  /**
   * Navigate to business form
   */
  navigateToBusinessForm() {
    this.navigate('BusinessForm');
  }

  /**
   * Navigate to business dashboard
   */
  navigateToBusinessDashboard() {
    this.navigate('BusinessDashboard');
  }

  /**
   * Navigate back to main after business creation
   */
  navigateBackToMain() {
    this.navigate('Main');
  }

  /**
   * Check if navigator is ready
   */
  isReady() {
    return navigationRef.isReady();
  }

  /**
   * Get current route name
   */
  getCurrentRoute() {
    if (navigationRef.isReady()) {
      return navigationRef.getCurrentRoute();
    }
    return null;
  }
}

export const navigationService = new NavigationService();