import { useState, useEffect } from 'react';
import { API_URL } from '../config/api';

export interface FeatureFlags {
  peer_to_peer_enabled: boolean;
  counsellor_enabled: boolean;
  front_page_crisis_cta_enabled: boolean;
  safeguarding_response_mode: string; // "escalate" | "signpost"
}

export interface CrisisResource { name: string; phone?: string; description?: string; }
export interface SupportOrg { name: string; url?: string; description?: string; }
export interface OverlayContent { title: string; signpost_text: string; escalate_text: string; }

interface TenantConfigData {
  features: FeatureFlags;
  crisisResources: CrisisResource[];
  supportOrgs: SupportOrg[];
  overlay: OverlayContent;
}

/**
 * Safe defaults: gated features start OFF (hidden) until the config confirms
 * they're enabled, so a slow/failed fetch never offers a switched-off service.
 * safeguarding_response_mode defaults to "escalate" — so if the fetch fails the
 * overlay shows the normal staff view, NOT an empty signpost view.
 */
const SAFE_DEFAULTS: TenantConfigData = {
  features: {
    peer_to_peer_enabled: false,
    counsellor_enabled: false,
    front_page_crisis_cta_enabled: false,
    safeguarding_response_mode: 'escalate',
  },
  crisisResources: [],
  supportOrgs: [],
};

// Module-level cache so the config is fetched once and shared across screens.
let _cache: TenantConfigData | null = null;
let _inflight: Promise<TenantConfigData> | null = null;

async function loadConfig(): Promise<TenantConfigData> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/tenant/config`);
      if (!res.ok) throw new Error('tenant config fetch failed');
      const data = await res.json();
      const f = (data && data.features) || {};
      _cache = {
        features: {
          peer_to_peer_enabled: f.peer_to_peer_enabled !== false,
          counsellor_enabled: f.counsellor_enabled !== false,
          front_page_crisis_cta_enabled: f.front_page_crisis_cta_enabled !== false,
          safeguarding_response_mode: f.safeguarding_response_mode || 'escalate',
        },
        crisisResources: Array.isArray(data?.crisis_resources) ? data.crisis_resources : [],
        supportOrgs: Array.isArray(data?.support_organisations) ? data.support_organisations : [],
      };
      return _cache;
    } catch (err) {
      console.warn('[useFeatureFlags] Failed to load tenant config:', err);
      // Leave uncached so a later screen can retry; return safe defaults for now.
      return SAFE_DEFAULTS;
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

export function useFeatureFlags() {
  const [data, setData] = useState<TenantConfigData>(_cache || SAFE_DEFAULTS);
  const [loaded, setLoaded] = useState<boolean>(_cache != null);

  useEffect(() => {
    let cancelled = false;
    loadConfig().then((d) => {
      if (!cancelled) {
        setData(d);
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return {
    features: data.features,
    crisisResources: data.crisisResources,
    supportOrgs: data.supportOrgs,
    loaded,
  };
}
