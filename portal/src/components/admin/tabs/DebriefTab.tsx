'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Download, FileText, BarChart3, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { API_URL } from '@/lib/admin-api';

interface DebriefTabProps {
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

interface Summary {
  total: number;
  averages: Record<string, number | null>;
  distributions: Record<string, Record<string, number>>;
}

interface Submission {
  id: string;
  submitted_at: string;
  [key: string]: any;
}

const RATING_LABELS: Record<string, string> = {
  ease_of_navigation: 'Ease of Navigation',
  conversation_natural: 'Conversation Natural',
  ai_understood: 'AI Understood Me',
  ai_personality_fit: 'AI Personality Fit',
  felt_safe: 'Felt Safe',
  felt_private: 'Felt Private',
  would_open_up: 'Would Open Up',
  trust_with_sensitive: 'Trust with Sensitive Topics',
  resources_useful: 'Resources Useful',
  would_recommend: 'Would Recommend',
  net_promoter: 'Net Promoter (0-10)',
};

export default function DebriefTab({ token, onSuccess, onError }: DebriefTabProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'responses'>('dashboard');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, subRes] = await Promise.all([
        fetch(`${API_URL}/api/debrief/summary`).then(r => r.json()),
        fetch(`${API_URL}/api/debrief/submissions`).then(r => r.json()),
      ]);
      setSummary(sumRes);
      setSubmissions(subRes.submissions || []);
    } catch (err) {
      onError('Failed to load debrief data');
    }
    setLoading(false);
  }, [onError]);

  useEffect(() => { loadData(); }, [loadData]);

  const exportCSV = () => {
    window.open(`${API_URL}/api/debrief/export/csv`, '_blank');
  };

  const exportPDF = () => {
    window.open(`${API_URL}/api/debrief/export/pdf`, '_blank');
  };

  const npsScore = () => {
    if (!submissions.length) return 'N/A';
    const vals = submissions.filter(s => s.net_promoter != null).map(s => s.net_promoter);
    if (!vals.length) return 'N/A';
    const promoters = vals.filter(v => v >= 9).length / vals.length * 100;
    const detractors = vals.filter(v => v <= 6).length / vals.length * 100;
    return Math.round(promoters - detractors);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading debrief data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'dashboard' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            <BarChart3 className="w-4 h-4 inline mr-1" /> Dashboard
          </button>
          <button onClick={() => setView('responses')} className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'responses' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            <ClipboardList className="w-4 h-4 inline mr-1" /> Responses ({summary?.total || 0})
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-3 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm flex items-center gap-1">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={exportPDF} className="px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1">
            <FileText className="w-4 h-4" /> PDF Report
          </button>
          <button onClick={loadData} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === 'dashboard' ? (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total Responses" value={summary?.total || 0} />
            <StatCard label="Avg Safety Score" value={summary?.averages?.felt_safe ?? 'N/A'} suffix="/5" />
            <StatCard label="Avg Recommend" value={summary?.averages?.would_recommend ?? 'N/A'} suffix="/5" />
            <StatCard label="NPS Score" value={npsScore()} />
          </div>

          {/* Rating Averages */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Score Averages</h3>
            <div className="space-y-3">
              {Object.entries(RATING_LABELS).map(([key, label]) => {
                const val = summary?.averages?.[key];
                const max = key === 'net_promoter' ? 10 : 5;
                const pct = val != null ? (val / max) * 100 : 0;
                return (
                  <div key={key} className="flex items-center gap-4">
                    <span className="text-gray-300 text-sm w-48 shrink-0">{label}</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-4">
                      <div className="bg-red-600 h-4 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-white font-semibold text-sm w-16 text-right">{val != null ? `${val}/${max}` : 'N/A'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Distributions */}
          <div className="grid grid-cols-2 gap-4">
            <DistributionCard title="Would Use Again" data={summary?.distributions?.would_use_again} total={summary?.total || 0} />
            <DistributionCard title="Service Branch" data={summary?.distributions?.service_branch} total={summary?.total || 0} />
            <DistributionCard title="How Heard" data={summary?.distributions?.how_heard} total={summary?.total || 0} />
            <DistributionCard title="Device Used" data={summary?.distributions?.device_used} total={summary?.total || 0} />
          </div>

          {/* Persona Usage */}
          {summary?.distributions?.personas_used && Object.keys(summary.distributions.personas_used).length > 0 && (
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Persona Usage</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.distributions.personas_used)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => (
                    <span key={name} className="px-3 py-1 bg-gray-700 rounded-full text-sm text-gray-200">
                      {name} <span className="text-red-400 font-semibold ml-1">{count}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Free Text Highlights */}
          <FreeTextSection title="What Radio Check Did Well" submissions={submissions} field="what_done_well" />
          <FreeTextSection title="What Could Be Improved" submissions={submissions} field="what_improve" />
          <FreeTextSection title="How They Felt After Talking to AI" submissions={submissions} field="how_felt_after" />
          <FreeTextSection title="AI Responses That Felt Wrong" submissions={submissions} field="ai_response_wrong_detail" />
        </>
      ) : (
        /* Individual Responses */
        <div className="space-y-3">
          {submissions.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No responses yet</div>
          ) : submissions.map(sub => (
            <div key={sub.id} className="bg-gray-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-750"
              >
                <div className="flex items-center gap-4">
                  <span className="text-gray-400 text-sm font-mono">{sub.id}</span>
                  <span className="text-gray-500 text-sm">{new Date(sub.submitted_at).toLocaleString()}</span>
                  {sub.service_branch && <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">{sub.service_branch}</span>}
                </div>
                <div className="flex items-center gap-3">
                  {sub.felt_safe && <span className="text-xs text-gray-400">Safety: <span className="text-white font-semibold">{sub.felt_safe}/5</span></span>}
                  {sub.would_recommend && <span className="text-xs text-gray-400">Recommend: <span className="text-white font-semibold">{sub.would_recommend}/5</span></span>}
                  {expandedId === sub.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>
              {expandedId === sub.id && (
                <div className="px-6 pb-6 border-t border-gray-700 pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {Object.entries(sub).filter(([k]) => !['id', 'submitted_at', '_id'].includes(k) && sub[k] != null && sub[k] !== '').map(([key, val]) => (
                      <div key={key} className={typeof val === 'string' && val.length > 60 ? 'col-span-2' : ''}>
                        <span className="text-gray-500 text-xs">{key.replace(/_/g, ' ')}</span>
                        <p className="text-gray-200 mt-0.5">{Array.isArray(val) ? val.join(', ') : String(val)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: any; suffix?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 text-center">
      <div className="text-3xl font-bold text-red-500">{value}{suffix && <span className="text-lg text-gray-400">{suffix}</span>}</div>
      <div className="text-xs text-gray-400 mt-1 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function DistributionCard({ title, data, total }: { title: string; data?: Record<string, number>; total: number }) {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h4 className="text-sm font-semibold text-white mb-3">{title}</h4>
      <div className="space-y-2">
        {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([key, count]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-gray-400 text-xs w-32 truncate shrink-0">{key}</span>
            <div className="flex-1 bg-gray-700 rounded-full h-2">
              <div className="bg-red-600 h-2 rounded-full" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
            </div>
            <span className="text-gray-300 text-xs w-8 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FreeTextSection({ title, submissions, field }: { title: string; submissions: Submission[]; field: string }) {
  const responses = submissions.filter(s => s[field] && String(s[field]).trim()).map(s => String(s[field]));
  if (responses.length === 0) return null;
  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-3">{title} <span className="text-sm text-gray-400 font-normal">({responses.length})</span></h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {responses.map((r, i) => (
          <div key={i} className="bg-gray-750 bg-opacity-50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-300">&ldquo;{r}&rdquo;</div>
        ))}
      </div>
    </div>
  );
}
