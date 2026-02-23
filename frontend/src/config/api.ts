/**
 * Centralized API Configuration
 * 
 * This module provides a safe way to get the backend URL with failsafes
 * to prevent production builds from accidentally using preview URLs.
 */

// Production backend URL (Render)
const PRODUCTION_BACKEND_URL = 'https://veterans-support-api.onrender.com';

// Get the configured backend URL
const rawBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';

/**
 * Check if a URL is a preview/development URL
 */
function isPreviewUrl(url: string): boolean {
  const previewPatterns = [
    '.emergentagent.com',
    '.preview.',
    'localhost',
    '127.0.0.1',
  ];
  return previewPatterns.some(pattern => url.toLowerCase().includes(pattern));
}

/**
 * Check if we're running in a production build
 * Vercel sets NODE_ENV to production for production builds
 */
function isProductionBuild(): boolean {
  // Check for Vercel production indicators
  if (process.env.VERCEL_ENV === 'production') return true;
  if (process.env.NODE_ENV === 'production') return true;
  
  // Additional check: if EXPO_PUBLIC_BACKEND_URL contains the production URL
  if (rawBackendUrl.includes('veterans-support-api.onrender.com')) return true;
  
  return false;
}

/**
 * Get the safe API URL
 * 
 * FAILSAFE LOGIC:
 * - If in production and the URL is a preview URL, fall back to production backend
 * - This prevents misconfigured deployments from breaking the app
 */
export function getApiUrl(): string {
  // If no URL configured, use production as fallback
  if (!rawBackendUrl) {
    console.warn('[API Config] No EXPO_PUBLIC_BACKEND_URL set, using production fallback');
    return PRODUCTION_BACKEND_URL;
  }
  
  // In production builds, reject preview URLs
  if (isProductionBuild() && isPreviewUrl(rawBackendUrl)) {
    console.warn(
      '[API Config] FAILSAFE ACTIVATED: Preview URL detected in production build.',
      'Configured:', rawBackendUrl,
      'Using:', PRODUCTION_BACKEND_URL
    );
    return PRODUCTION_BACKEND_URL;
  }
  
  return rawBackendUrl;
}

/**
 * The safe API URL to use throughout the app
 */
export const API_URL = getApiUrl();

/**
 * Log configuration on import (for debugging)
 */
if (__DEV__) {
  console.log('[API Config] Environment:', {
    raw: rawBackendUrl,
    safe: API_URL,
    isProduction: isProductionBuild(),
    isPreview: isPreviewUrl(rawBackendUrl),
  });
}

export default API_URL;
