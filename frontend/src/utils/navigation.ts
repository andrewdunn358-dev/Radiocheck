import { Router } from 'expo-router';

/**
 * Safely navigate back, handling the case where there's no history
 * (e.g., after a page refresh in web browser)
 * 
 * @param router - The expo-router router instance
 * @param fallbackPath - The path to navigate to if there's no history (default: '/home')
 */
export const safeGoBack = (router: Router, fallbackPath: string = '/home') => {
  if (typeof window !== 'undefined' && window.history.length <= 1) {
    router.replace(fallbackPath);
  } else {
    router.back();
  }
};
