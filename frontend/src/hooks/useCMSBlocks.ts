import { useState, useEffect } from 'react';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface CMSBlock {
  type: string;
  props: Record<string, any>;
}

export function useCMSBlocks(slug: string) {
  const [blocks, setBlocks] = useState<CMSBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!slug || failed) return;
    let cancelled = false;
    async function fetchBlocks() {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/cms/pages/${slug}`);
        if (res.status === 404) {
          // Page not in CMS — stop. Do not retry.
          if (!cancelled) { setBlocks([]); setIsLoading(false); setFailed(true); }
          return;
        }
        if (!res.ok) throw new Error('CMS fetch failed');
        const data = await res.json();
        if (!cancelled && data?.page?.blocks) {
          setBlocks(data.page.blocks);
        }
      } catch (err) {
        console.warn(`[useCMSBlocks] Failed to load "${slug}":`, err);
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchBlocks();
    return () => { cancelled = true; };
  }, [slug, failed]);

  return { blocks, isLoading };
}
