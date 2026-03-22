'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, RefreshCw } from 'lucide-react';
import { api } from '@/lib/admin-api';

interface CMSTabProps {
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function CMSTab({ token, onSuccess, onError }: CMSTabProps) {
  const [cmsPages, setCmsPages] = useState<any[]>([]);
  const [selectedCmsPage, setSelectedCmsPage] = useState<any>(null);

  const loadCMS = useCallback(async () => {
    if (!token) return;
    try {
      const pages = await api.getCMSPages(token).catch(() => []);
      setCmsPages(Array.isArray(pages) ? pages : []);
    } catch (err: any) {
      console.error('CMS data not available:', err);
    }
  }, [token]);

  useEffect(() => {
    loadCMS();
  }, [loadCMS]);

  const handleLoadDefaults = async () => {
    if (!token) return;
    try {
      await api.seedCMSDefaults(token);
      onSuccess('Default CMS content loaded');
      loadCMS();
    } catch (err: any) {
      onError('Failed to load defaults: ' + err.message);
    }
  };

  return (
    <div data-testid="cms-tab">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Content Management System</h2>
        <div className="flex gap-2">
          <button 
            onClick={handleLoadDefaults}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Load Defaults
          </button>
          <button onClick={loadCMS} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Page List */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Pages ({cmsPages.length})
          </h3>
          {cmsPages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">No CMS pages found</p>
              <p className="text-sm text-gray-500">Click &quot;Load Defaults&quot; to add default pages</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cmsPages.map((page) => (
                <button
                  key={page.slug}
                  onClick={() => setSelectedCmsPage(page.slug)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedCmsPage === page.slug ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <p className="font-medium">{page.title}</p>
                  <p className="text-xs text-gray-400">/{page.slug}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Page Content */}
        <div className="lg:col-span-2 bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="font-semibold mb-4">Page Content</h3>
          {selectedCmsPage ? (
            <div className="space-y-4">
              {(() => {
                const page = cmsPages.find(p => p.slug === selectedCmsPage);
                if (!page) return <p className="text-gray-400">Page not found</p>;
                return (
                  <>
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h4 className="font-medium text-lg">{page.title}</h4>
                      <p className="text-sm text-gray-400 mt-1">{page.description || 'No description'}</p>
                    </div>
                    {page.sections && page.sections.length > 0 ? (
                      <div className="space-y-3">
                        <h5 className="text-sm font-medium text-gray-400">Sections:</h5>
                        {page.sections.map((section: any, idx: number) => (
                          <div key={idx} className="bg-gray-700 rounded-lg p-3">
                            <p className="font-medium">{section.title || `Section ${idx + 1}`}</p>
                            <p className="text-sm text-gray-400">{section.description || section.content || 'No content'}</p>
                          </div>
                        ))}
                      </div>
                    ) : page.cards && page.cards.length > 0 ? (
                      <div className="space-y-3">
                        <h5 className="text-sm font-medium text-gray-400">Cards:</h5>
                        {page.cards.map((card: any, idx: number) => (
                          <div key={idx} className="bg-gray-700 rounded-lg p-3 flex items-start gap-3">
                            {card.icon && <span className="text-2xl">{card.icon}</span>}
                            <div>
                              <p className="font-medium">{card.title}</p>
                              <p className="text-sm text-gray-400">{card.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-center py-4">No sections or cards in this page</p>
                    )}
                    <p className="text-xs text-gray-500 mt-4">Note: Full visual editor available in legacy admin portal</p>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="bg-gray-700 rounded-lg p-6 min-h-[300px] flex items-center justify-center">
              <p className="text-gray-400">Select a page to view content</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
