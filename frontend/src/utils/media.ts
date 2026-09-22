import { Platform } from 'react-native';

/**
 * Site that serves the web build's /public folder (e.g. /images/james.png).
 * On the web a path like "/images/james.png" resolves against the current
 * site. In the native app there is no "current site", so we prefix it.
 */
export const WEB_ASSET_BASE = 'https://app.radiocheck.me';

/**
 * Turn a site-relative media path into something the native app can load.
 * Absolute URLs (http/https/data/file) and web builds are left untouched.
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (Platform.OS === 'web') return url;
  if (/^(https?:|data:|file:|blob:)/i.test(url)) return url;
  if (url.startsWith('/')) return `${WEB_ASSET_BASE}${url}`;
  return url;
}
