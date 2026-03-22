'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import { api } from '@/lib/admin-api';
import type { AIUsageSummary } from '@/types/admin';

interface AIUsageTabProps {
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function AIUsageTab({ token, onSuccess, onError }: AIUsageTabProps) {
  const [aiUsage, setAIUsage] = useState<AIUsageSummary | null>(null);
  const [aiDailyUsage, setAiDailyUsage] = useState<any[]>([]);
  const [aiUsagePeriod, setAiUsagePeriod] = useState(30);

  const loadAIUsage = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getAIUsageSummary(token);
      setAIUsage(data);
      try {
        const daily = await api.getAIUsageDaily(token, aiUsagePeriod);
        setAiDailyUsage(daily || []);
      } catch (dailyErr) {
        console.error('Daily AI usage not available:', dailyErr);
      }
    } catch (err: any) {
      console.error('AI Usage not available:', err);
    }
  }, [token, aiUsagePeriod]);

  useEffect(() => {
    loadAIUsage();
  }, [loadAIUsage]);

  return (
    <div data-testid="ai-usage-tab">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">AI Usage & Costs</h2>
        <button onClick={loadAIUsage} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>
      {aiUsage ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6">
              <h3 className="text-blue-200 text-sm mb-2">Total Requests</h3>
              <p className="text-3xl font-bold">{(aiUsage.total_requests || 0).toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-6">
              <h3 className="text-purple-200 text-sm mb-2">Total Tokens</h3>
              <p className="text-3xl font-bold">{(aiUsage.total_tokens || 0).toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-6">
              <h3 className="text-green-200 text-sm mb-2">Total Cost</h3>
              <p className="text-3xl font-bold">£{Number(aiUsage.total_cost_gbp || aiUsage.total_cost || 0).toFixed(4)}</p>
            </div>
          </div>

          {/* Provider Cards with Budget Bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* OpenAI Card */}
            {aiUsage.providers?.openai && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center text-white font-bold text-sm">AI</div>
                  <h3 className="font-semibold">OpenAI</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Cost</span>
                    <span className="text-green-400">£{Number(aiUsage.providers.openai.cost_gbp || 0).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Requests</span>
                    <span>{(aiUsage.providers.openai.request_count || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Tokens</span>
                    <span>{(aiUsage.providers.openai.total_tokens || 0).toLocaleString()}</span>
                  </div>
                  {aiUsage.providers.openai.budget_limit_gbp && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Budget Used</span>
                        <span>{Number(aiUsage.providers.openai.budget_percentage_used || 0).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${
                            Number(aiUsage.providers.openai.budget_percentage_used || 0) > 80 ? 'bg-red-500' :
                            Number(aiUsage.providers.openai.budget_percentage_used || 0) > 50 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(Number(aiUsage.providers.openai.budget_percentage_used || 0), 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">£{Number(aiUsage.providers.openai.budget_remaining_gbp || 0).toFixed(4)} remaining of £{Number(aiUsage.providers.openai.budget_limit_gbp || 0).toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Gemini Card */}
            {aiUsage.providers?.gemini && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center text-white font-bold text-sm">G</div>
                  <h3 className="font-semibold">Gemini</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Cost</span>
                    <span className="text-green-400">£{Number(aiUsage.providers.gemini.cost_gbp || 0).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Requests</span>
                    <span>{(aiUsage.providers.gemini.request_count || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Tokens</span>
                    <span>{(aiUsage.providers.gemini.total_tokens || 0).toLocaleString()}</span>
                  </div>
                  {aiUsage.providers.gemini.budget_limit_gbp && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Budget Used</span>
                        <span>{Number(aiUsage.providers.gemini.budget_percentage_used || 0).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${
                            Number(aiUsage.providers.gemini.budget_percentage_used || 0) > 80 ? 'bg-red-500' :
                            Number(aiUsage.providers.gemini.budget_percentage_used || 0) > 50 ? 'bg-yellow-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(Number(aiUsage.providers.gemini.budget_percentage_used || 0), 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">£{Number(aiUsage.providers.gemini.budget_remaining_gbp || 0).toFixed(4)} remaining of £{Number(aiUsage.providers.gemini.budget_limit_gbp || 0).toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Usage Charts */}
          {aiDailyUsage.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Daily Requests Chart */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Daily Requests</h3>
                  <select
                    value={aiUsagePeriod}
                    onChange={(e) => setAiUsagePeriod(Number(e.target.value))}
                    className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                  >
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>
                <div style={{ height: '250px' }}>
                  <Line
                    data={{
                      labels: aiDailyUsage.map((d: any) => d.date || d._id),
                      datasets: [{
                        label: 'Requests',
                        data: aiDailyUsage.map((d: any) => d.requests || d.request_count || 0),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        fill: true,
                        tension: 0.3
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af' } },
                        x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Daily Cost Chart */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h3 className="font-semibold mb-4">Daily Cost (£)</h3>
                <div style={{ height: '250px' }}>
                  <Bar
                    data={{
                      labels: aiDailyUsage.map((d: any) => d.date || d._id),
                      datasets: [{
                        label: 'Cost £',
                        data: aiDailyUsage.map((d: any) => Number(d.cost_gbp || d.cost || 0)),
                        backgroundColor: '#10b981'
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af' } },
                        x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Usage Table */}
          {aiUsage.recent_usage && aiUsage.recent_usage.length > 0 && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="font-semibold mb-4">Recent Usage</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Provider</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Model</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Requests</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Tokens</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {aiUsage.recent_usage.map((usage: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-sm">{usage.date || new Date(usage.timestamp).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm capitalize">{usage.provider}</td>
                        <td className="px-4 py-3 text-sm">{usage.model || '-'}</td>
                        <td className="px-4 py-3 text-sm">{(usage.requests || usage.request_count || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm">{(usage.tokens || usage.total_tokens || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-green-400">£{Number(usage.cost_gbp || usage.cost || 0).toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-gray-400 py-8">
          AI Usage data not available
        </div>
      )}
    </div>
  );
}
