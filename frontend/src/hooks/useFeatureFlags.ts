import { useState, useEffect } from 'react';
import { API_URL } from '../config/api';

export interface FeatureFlags {
  peer_to_peer_enabled: boolean;
  counsellor_enabled: boolean;
  front_page_crisis_cta_enabled: boolean;
  safeguarding_response_mode: string; // "escalate" | "signpost"
}

/**
 * Safe defaults: gated features start OFF (hidden) until the config confirms
 * they're enabled. A slow or failed fetch therefore leaves the app hiding
 * features rather than offering peer / counsellor / callback paths that may be
 * switched off and have no one to respond. In go-to-market (off) mode this also
 * means there is no flash — the surfaces simply stay hidden.
 */
const SAFE_DEFAULTS: FeatureFlags = {
  peer_to_peer_enabled: false,
  counsellor_enabled: false,
  front_page_crisis_cta_enabled: false,
  safeguarding_response_mode: 'escalate',
};

// Module-level cache so the config is fetched once and shared across screens.
let _cache: FeatureFlags | null = null;
let _inflight: Promise<FeatureFlags> | null = null;

async function loadFeatures(): Promise<FeatureFlags> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/tenant/config`);
      if (!res.ok) throw new Error('tenant config fetch failed');
      const data = await res.json();
      const f = (data && data.features) || {};
      _cache = {
        peer_to_peer_enabled: f.peer_to_peer_enabled !== false,
        counsellor_enabled: f.counsellor_enabled !== false,
        front_page_crisis_cta_enabled: f.front_page_crisis_cta_enabled !== false,
        safeguarding_response_mode: f.safeguarding_response_mode || 'escalate',
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
  const [features, setFeatures] = useState<FeatureFlags>(_cache || SAFE_DEFAULTS);
  const [loaded, setLoaded] = useState<boolean>(_cache != null);

  useEffect(() => {
    let cancelled = false;
    loadFeatures().then((f) => {
      if (!cancelled) {
        setFeatures(f);
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return { features, loaded };
}
