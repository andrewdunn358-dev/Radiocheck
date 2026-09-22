import { Router } from 'expo-router';
import { Platform } from 'react-native';

/**
 * Safely navigate back, handling the case where there's no history
 * (e.g., after a page refresh in web browser)
 * 
 * @param router - The expo-router router instance
 * @param fallbackPath - The path to navigate to if there's no history (default: '/home')
 */
export const safeGoBack = (router: Router, fallbackPath: string = '/home') => {
  if (Platform.OS !== 'web') {
    goBack(router, fallbackPath);
    return;
  }
  if (typeof window !== 'undefined') {
    // Check if we can go back by testing history state
    // If history.length is 1 or less, or if this appears to be a direct load
    // (referrer is empty and history.length is small), navigate to fallback
    const canGoBack = window.history.length > 2 || document.referrer !== '';
    
    if (!canGoBack) {
      router.replace(fallbackPath);
      return;
    }
  }
  router.back();
};

/**
 * Back button behaviour that works in the native app.
 *
 * Web: unchanged — plain router.back() (browser history).
 * Native: if there is nothing to go back to (e.g. the app opened straight
 * onto this screen), go to the fallback screen instead of closing the app.
 */
export const goBack = (router: Router, fallbackPath: string = '/home') => {
  if (Platform.OS === 'web') {
    router.back();
    return;
  }
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackPath as any);
  }
};
