'use client';

import { Trash2 } from 'lucide-react';
import { api } from '@/lib/admin-api';

interface PatternsSubTabProps {
  token: string;
  userId?: string;
  safetyPatterns: any[];
  patternCategoryFilter: string;
  patternSeverityFilter: string;
  setPatternCategoryFilter: (value: string) => void;
  setPatternSeverityFilter: (value: string) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onRefresh: () => void;
}

export default function PatternsSubTab({
  token,
  userId,
  safetyPatterns,
  patternCategoryFilter,
  patternSeverityFilter,
  setPatternCategoryFilter,
  setPatternSeverityFilter,
  onSuccess,
  onError,
  onRefresh,
}: PatternsSubTabProps) {
  const handleDeletePattern = async (patternId: string) => {
    if (!confirm('Delete this pattern?')) return;
    try {
      await api.deletePattern(token, patternId);
      onSuccess('Pattern deleted');
      onRefresh();
    } catch (err: any) {
      onError('Failed: ' + err.message);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex gap-4 mb-4">
        <select
          value={patternCategoryFilter}
          onChange={(e) => setPatternCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
        >
          <option value="">All Categories</option>
          <option value="crisis">Crisis</option>
          <option value="safety">Safety</option>
          <option value="clinical">Clinical</option>
          <option value="wellbeing">Wellbeing</option>
        </select>
        <select
          value={patternSeverityFilter}
          onChange={(e) => setPatternSeverityFilter(e.target.value)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button onClick={onRefresh} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg">
          Filter
        </button>
      </div>
      
      {safetyPatterns.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No patterns found. Click &quot;Seed Defaults&quot; to add standard patterns.</p>
      ) : (
        <div className="space-y-3">
          {safetyPatterns.map((pattern: any) => (
            <div key={pattern.id} className="bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-semibold text-lg">&quot;{pattern.pattern}&quot;</span>
                  <span className={`ml-3 px-2 py-1 rounded text-xs font-medium ${
                    pattern.severity === 'critical' ? 'bg-red-500 text-white' :
                    pattern.severity === 'high' ? 'bg-orange-500 text-white' :
                    pattern.severity === 'medium' ? 'bg-yellow-500 text-black' :
                    'bg-green-500 text-white'
                  }`}>
                    {pattern.severity?.toUpperCase()}
                  </span>
                </div>
                <button 
                  onClick={() => handleDeletePattern(pattern.id)}
                  className="p-1 bg-red-600 hover:bg-red-700 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 text-sm text-gray-400 flex gap-4">
                <span>Category: {pattern.category}</span>
                <span>Action: {pattern.response_action}</span>
                <span>Type: {pattern.pattern_type}</span>
              </div>
              {pattern.description && <p className="mt-2 text-sm text-gray-400">{pattern.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
