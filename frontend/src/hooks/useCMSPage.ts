import { useState, useEffect } from 'react';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface CMSPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: string;
  linked_persona?: string;
  meta_title?: string;
  meta_description?: string;
}

export function useCMSPage(slug: string) {
  const [content, setContent] = useState<string>('');
  const [page, setPage] = useState<CMSPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchPage = async () => {
      try {
        const response = await fetch(`${API_URL}/api/cms/pages/${slug}`);
        if (!response.ok) throw new Error('Page not found');
        const data = await response.json();
        if (!cancelled && data.page) {
          setPage(data.page);
          setContent(data.page.content || '');
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message);
          console.log(`CMS page "${slug}" not available, using fallback`);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchPage();
    return () => { cancelled = true; };
  }, [slug]);

  return { content, page, isLoading, error };
}
