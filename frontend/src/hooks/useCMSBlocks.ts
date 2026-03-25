import { useState, useEffect } from 'react';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface CMSBlock {
  type: string;
  props: Record<string, any>;
}

export function useCMSBlocks(slug: string) {
  const [blocks, setBlocks] = useState<CMSBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchBlocks() {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/cms/pages/${slug}`);
        if (!res.ok) throw new Error('Page not found');
        const data = await res.json();
        if (!cancelled && data?.page?.blocks) {
          setBlocks(data.page.blocks);
        }
      } catch (err) {
        console.warn(`[useCMSBlocks] Failed to load blocks for "${slug}":`, err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchBlocks();
    return () => { cancelled = true; };
  }, [slug]);

  return { blocks, isLoading };
}
