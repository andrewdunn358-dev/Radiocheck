'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Activity, MessageSquare, RefreshCw } from 'lucide-react';
import { api, API_URL } from '@/lib/admin-api';

interface BetaTestingTabProps {
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function BetaTestingTab({ token, onSuccess, onError }: BetaTestingTabProps) {
  const [betaEnabled, setBetaEnabled] = useState(false);
  const [betaStats, setBetaStats] = useState<any>(null);
  const [betaResponses, setBetaResponses] = useState<any[]>([]);

  const loadBetaTesting = useCallback(async () => {
    if (!token) return;
    try {
      const [statusData, statsData, responsesData] = await Promise.all([
        api.getBetaStatus(token).catch(() => ({ beta_enabled: false })),
        api.getBetaStats(token).catch(() => null),
        api.getBetaResponses(token).catch(() => ({ responses: [] })),
      ]);
      setBetaEnabled(statusData?.beta_enabled || false);
      setBetaStats(statsData);
      setBetaResponses(responsesData?.responses || []);
    } catch (err: any) {
      console.error('Beta testing data not available:', err);
    }
  }, [token]);

  useEffect(() => {
    loadBetaTesting();
  }, [loadBetaTesting]);

  const handleToggleBeta = async () => {
    if (!token) return;
    try {
      await api.setBetaStatus(token, !betaEnabled);
      setBetaEnabled(!betaEnabled);
    } catch (err) {
      console.error('Failed to toggle beta:', err);
    }
  };

  return (
    <div data-testid="beta-tab">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Beta Testing & Feedback</h2>
        <div className="flex gap-2 items-center">
          <button 
            onClick={handleToggleBeta}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${betaEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {betaEnabled ? 'Disable Beta' : 'Enable Beta'}
          </button>
          <span className={`px-3 py-1 rounded-full text-sm ${betaEnabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
            {betaEnabled ? 'Active' : 'Inactive'}
          </span>
          <button onClick={loadBetaTesting} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Pre-Surveys</p>
          <p className="text-2xl font-bold text-green-400">{betaStats?.total_pre_surveys || 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Post-Surveys</p>
          <p className="text-2xl font-bold text-blue-400">{betaStats?.total_post_surveys || 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Completion Rate</p>
          <p className="text-2xl font-bold text-yellow-400">{betaStats?.completion_rate || 0}%</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">NPS Score</p>
          <p className="text-2xl font-bold text-purple-400">{betaStats?.nps_score || '--'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pre-Survey Averages */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Pre-Survey Averages
          </h3>
          {betaStats?.pre_averages ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-gray-700 p-3 rounded">
                <span>Wellbeing Score</span>
                <span className="text-green-400 font-bold">{typeof betaStats.pre_averages.avg_wellbeing === 'number' ? betaStats.pre_averages.avg_wellbeing.toFixed(1) : (betaStats.pre_averages.avg_wellbeing || '--')}/10</span>
              </div>
              <div className="flex justify-between items-center bg-gray-700 p-3 rounded">
                <span>Anxiety Level</span>
                <span className="text-yellow-400 font-bold">{typeof betaStats.pre_averages.avg_anxiety === 'number' ? betaStats.pre_averages.avg_anxiety.toFixed(1) : (betaStats.pre_averages.avg_anxiety || '--')}/10</span>
              </div>
              <div className="flex justify-between items-center bg-gray-700 p-3 rounded">
                <span>Mood Score</span>
                <span className="text-blue-400 font-bold">{typeof betaStats.pre_averages.avg_mood === 'number' ? betaStats.pre_averages.avg_mood.toFixed(1) : (betaStats.pre_averages.avg_mood || '--')}/10</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No pre-survey data yet</p>
          )}
        </div>

        {/* Post-Survey Improvement */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-400" />
            Post-Survey Improvement
          </h3>
          {betaStats?.improvement && Object.keys(betaStats.improvement).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(betaStats.improvement).map(([key, value]: [string, any]) => (
                <div key={key} className="flex justify-between items-center bg-gray-700 p-3 rounded">
                  <span className="capitalize">{key.replace('_', ' ')}</span>
                  <span className={`font-bold ${value > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {typeof value === 'number' ? (value > 0 ? '+' : '') + value.toFixed(1) : (value || 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No post-survey data yet</p>
          )}
        </div>
      </div>

      {/* Survey Responses */}
      <div className="mt-6 bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            Recent Survey Responses ({betaResponses.length})
          </h3>
          <a
            href={`${API_URL}/api/surveys/export`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
          >
            Export CSV
          </a>
        </div>
        {betaResponses.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No survey responses yet</p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {betaResponses.map((response: any, idx: number) => (
              <div key={response.id || idx} className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    response.survey_type === 'pre' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                  }`}>
                    {response.survey_type === 'pre' ? 'Pre-Survey' : 'Post-Survey'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {response.created_at ? new Date(response.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm mt-2">
                  <div>
                    <span className="text-gray-400">Wellbeing:</span>
                    <span className="ml-2 font-medium">{response.wellbeing_score || response.wellbeing || '--'}/10</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Anxiety:</span>
                    <span className="ml-2 font-medium">{response.anxiety_level || response.anxiety || '--'}/3</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Mood:</span>
                    <span className="ml-2 font-medium">{response.mood_level || response.mood || '--'}/3</span>
                  </div>
                </div>
                {response.survey_type === 'post' && (
                  <div className="grid grid-cols-2 gap-4 text-sm mt-2 pt-2 border-t border-gray-600">
                    <div>
                      <span className="text-gray-400">App Helped:</span>
                      <span className="ml-2 font-medium">{response.app_helped || '--'}/5</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Would Recommend:</span>
                      <span className="ml-2 font-medium">{response.would_recommend || '--'}/10</span>
                    </div>
                  </div>
                )}
                {(response.hopes || response.improvements || response.comments) && (
                  <div className="mt-2 pt-2 border-t border-gray-600 text-sm">
                    {response.hopes && <p className="text-gray-300"><span className="text-gray-400">Hopes:</span> {response.hopes}</p>}
                    {response.improvements && <p className="text-gray-300"><span className="text-gray-400">Improvements:</span> {response.improvements}</p>}
                    {response.comments && <p className="text-gray-300"><span className="text-gray-400">Comments:</span> {response.comments}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
