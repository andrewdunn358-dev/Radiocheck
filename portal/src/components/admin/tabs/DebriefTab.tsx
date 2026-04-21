'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, Download, FileText, BarChart3, RefreshCw, ChevronDown, ChevronUp, Target, Users, Filter, AlertTriangle, TrendingUp, Star } from 'lucide-react';
import { API_URL } from '@/lib/admin-api';

interface DebriefTabProps { token: string; onSuccess: (msg: string) => void; onError: (msg: string) => void; }
interface Summary { total: number; averages: Record<string, number | null>; distributions: Record<string, Record<string, number>>; }
interface Submission { id: string; submitted_at: string; [key: string]: any; }

const RATING_LABELS: Record<string, string> = {
  ease_of_navigation: 'Ease of Navigation', conversation_natural: 'Conversation Natural',
  ai_understood: 'AI Understood Me', ai_personality_fit: 'AI Personality Fit',
  felt_safe: 'Felt Safe', felt_private: 'Felt Private', would_open_up: 'Would Open Up',
  trust_with_sensitive: 'Trust with Sensitive Topics', resources_useful: 'Resources Useful',
  would_recommend: 'Would Recommend',
};

const PERSONAS = ['Tommy','Grace','Bob','Frankie','Margie','Megan','Rachel','Finch','Penny','Jack','Rita','Sam','Helen','Alex','Kofi','James','Catherine','Dave','Baz','Mo','Reg'];

type ViewType = 'dashboard' | 'insights' | 'personas' | 'cohorts' | 'responses';

export default function DebriefTab({ token, onSuccess, onError }: DebriefTabProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewType>('dashboard');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cohortFilter, setCohortFilter] = useState<string>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, subRes] = await Promise.all([
        fetch(`${API_URL}/api/debrief/summary`).then(r => r.json()),
        fetch(`${API_URL}/api/debrief/submissions`).then(r => r.json()),
      ]);
      setSummary(sumRes);
      setSubmissions(subRes.submissions || []);
    } catch { onError('Failed to load debrief data'); }
    setLoading(false);
  }, [onError]);

  useEffect(() => { loadData(); }, [loadData]);

  // NPS calculation
  const npsData = useMemo(() => {
    const vals = submissions.filter(s => s.net_promoter != null).map(s => s.net_promoter);
    if (!vals.length) return { score: 'N/A', promoters: 0, passives: 0, detractors: 0, total: 0 };
    const promoters = vals.filter(v => v >= 9).length;
    const passives = vals.filter(v => v >= 7 && v <= 8).length;
    const detractors = vals.filter(v => v <= 6).length;
    return { score: Math.round((promoters / vals.length - detractors / vals.length) * 100), promoters, passives, detractors, total: vals.length };
  }, [submissions]);

  // Priority matrix: low score + high response count = high priority
  const priorities = useMemo(() => {
    if (!summary?.averages) return [];
    return Object.entries(RATING_LABELS).map(([key, label]) => {
      const avg = summary.averages[key];
      const responses = submissions.filter(s => s[key] != null).length;
      const max = 5;
      const gap = avg != null ? max - avg : 0;
      const priority = gap * Math.log2(responses + 1);
      return { key, label, avg, responses, gap: Math.round(gap * 10) / 10, priority: Math.round(priority * 10) / 10, max };
    }).filter(p => p.avg != null && p.avg < 4.5).sort((a, b) => b.priority - a.priority);
  }, [summary, submissions]);

  // Persona performance
  const personaPerformance = useMemo(() => {
    const results: Record<string, { count: number; scores: Record<string, number[]> }> = {};
    submissions.forEach(s => {
      (s.personas_used || []).forEach((p: string) => {
        if (!results[p]) results[p] = { count: 0, scores: {} };
        results[p].count++;
        ['conversation_natural', 'ai_understood', 'ai_personality_fit'].forEach(field => {
          if (s[field] != null) {
            if (!results[p].scores[field]) results[p].scores[field] = [];
            results[p].scores[field].push(s[field]);
          }
        });
      });
    });
    return Object.entries(results).map(([name, data]) => ({
      name, count: data.count,
      natural: avg(data.scores.conversation_natural),
      understood: avg(data.scores.ai_understood),
      fit: avg(data.scores.ai_personality_fit),
      overall: avg([...(data.scores.conversation_natural || []), ...(data.scores.ai_understood || []), ...(data.scores.ai_personality_fit || [])]),
    })).sort((a, b) => b.count - a.count);
  }, [submissions]);

  // Cohort filtering
  const cohortOptions = useMemo(() => {
    const branches = new Set<string>();
    const lengths = new Set<string>();
    const times = new Set<string>();
    submissions.forEach(s => {
      if (s.service_branch) branches.add(s.service_branch);
      if (s.service_length) lengths.add(s.service_length);
      if (s.time_since_service) times.add(s.time_since_service);
    });
    return { branches: Array.from(branches), lengths: Array.from(lengths), times: Array.from(times) };
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    if (cohortFilter === 'all') return submissions;
    return submissions.filter(s => s.service_branch === cohortFilter || s.service_length === cohortFilter || s.time_since_service === cohortFilter);
  }, [submissions, cohortFilter]);

  const filteredAverages = useMemo(() => {
    const avgs: Record<string, number | null> = {};
    Object.keys(RATING_LABELS).forEach(key => {
      const vals = filteredSubmissions.filter(s => s[key] != null).map(s => s[key]);
      avgs[key] = vals.length ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length * 10) / 10 : null;
    });
    return avgs;
  }, [filteredSubmissions]);

  // Word frequency from free text
  const wordCloud = useMemo(() => {
    const textFields = ['what_done_well', 'what_improve', 'how_felt_after', 'first_impression', 'missing_feature', 'anything_else'];
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'it', 'is', 'was', 'are', 'be', 'has', 'had', 'have', 'do', 'did', 'not', 'no', 'yes', 'that', 'this', 'i', 'me', 'my', 'you', 'your', 'we', 'they', 'them', 'its', 'just', 'like', 'really', 'very', 'about', 'would', 'could', 'more', 'some', 'than', 'been', 'from', 'also', 'what', 'when', 'how', 'all', 'there', 'their', 'which', 'will', 'if', 'so', 'up', 'out', 'as', 'into', 'can', 'one']);
    const counts: Record<string, number> = {};
    submissions.forEach(s => {
      textFields.forEach(f => {
        if (s[f]) {
          String(s[f]).toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).forEach(w => {
            if (w.length > 2 && !stopWords.has(w)) counts[w] = (counts[w] || 0) + 1;
          });
        }
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 40);
  }, [submissions]);

  // Sentiment analysis (simple keyword-based)
  const sentiments = useMemo(() => {
    const pos = ['good', 'great', 'helpful', 'safe', 'comfortable', 'natural', 'easy', 'excellent', 'amazing', 'love', 'brilliant', 'fantastic', 'useful', 'friendly', 'supportive', 'better', 'reassuring', 'calming'];
    const neg = ['bad', 'wrong', 'confusing', 'difficult', 'uncomfortable', 'robotic', 'awkward', 'scary', 'worried', 'frustrated', 'annoying', 'worse', 'intrusive', 'clinical', 'cold', 'unhelpful', 'creepy'];
    const fields = ['what_done_well', 'what_improve', 'how_felt_after', 'first_impression'];
    let positive = 0, negative = 0, neutral = 0;
    submissions.forEach(s => {
      fields.forEach(f => {
        if (!s[f]) return;
        const text = String(s[f]).toLowerCase();
        const pCount = pos.filter(w => text.includes(w)).length;
        const nCount = neg.filter(w => text.includes(w)).length;
        if (pCount > nCount) positive++;
        else if (nCount > pCount) negative++;
        else if (text.trim()) neutral++;
      });
    });
    return { positive, negative, neutral, total: positive + negative + neutral };
  }, [submissions]);

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading debrief data...</div>;

  const tabs: { id: ViewType; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'insights', label: 'Insights', icon: Target },
    { id: 'personas', label: 'Personas', icon: Users },
    { id: 'cohorts', label: 'Cohorts', icon: Filter },
    { id: 'responses', label: `Responses (${summary?.total || 0})`, icon: ClipboardList },
  ];

  return (
    <div className="space-y-6">
      {/* Nav */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setView(t.id)} className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 ${view === t.id ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.open(`${API_URL}/api/debrief/export/csv`, '_blank')} className="px-3 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-xs flex items-center gap-1"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => window.open(`${API_URL}/api/debrief/export/pdf`, '_blank')} className="px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-xs flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={loadData} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* ===== DASHBOARD ===== */}
      {view === 'dashboard' && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Responses" value={summary?.total || 0} />
            <StatCard label="Avg Safety" value={summary?.averages?.felt_safe ?? 'N/A'} suffix="/5" />
            <StatCard label="Would Recommend" value={summary?.averages?.would_recommend ?? 'N/A'} suffix="/5" />
            <StatCard label="NPS Score" value={npsData.score} color={typeof npsData.score === 'number' ? (npsData.score >= 50 ? 'text-green-400' : npsData.score >= 0 ? 'text-yellow-400' : 'text-red-400') : undefined} />
          </div>

          {/* NPS Breakdown */}
          {npsData.total > 0 && (
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Net Promoter Score Breakdown</h3>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 flex rounded-full overflow-hidden h-6">
                  {npsData.promoters > 0 && <div className="bg-green-600 flex items-center justify-center text-xs text-white font-semibold" style={{ width: `${(npsData.promoters / npsData.total) * 100}%` }}>{npsData.promoters}</div>}
                  {npsData.passives > 0 && <div className="bg-yellow-600 flex items-center justify-center text-xs text-white font-semibold" style={{ width: `${(npsData.passives / npsData.total) * 100}%` }}>{npsData.passives}</div>}
                  {npsData.detractors > 0 && <div className="bg-red-600 flex items-center justify-center text-xs text-white font-semibold" style={{ width: `${(npsData.detractors / npsData.total) * 100}%` }}>{npsData.detractors}</div>}
                </div>
              </div>
              <div className="flex gap-6 text-xs text-gray-400">
                <span><span className="inline-block w-2 h-2 rounded-full bg-green-600 mr-1"></span>Promoters (9-10): {npsData.promoters}</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-600 mr-1"></span>Passives (7-8): {npsData.passives}</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-red-600 mr-1"></span>Detractors (0-6): {npsData.detractors}</span>
              </div>
            </div>
          )}

          {/* Radar Chart (CSS) */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Score Overview</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(RATING_LABELS).map(([key, label]) => {
                const val = summary?.averages?.[key];
                const max = key === 'net_promoter' ? 10 : 5;
                const pct = val != null ? (val / max) * 100 : 0;
                const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : pct >= 40 ? 'bg-orange-500' : 'bg-red-500';
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-gray-400 text-xs w-40 shrink-0 truncate">{label}</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-3">
                      <div className={`${color} h-3 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-white font-semibold text-xs w-12 text-right">{val != null ? `${val}/${max}` : '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sentiment */}
          {sentiments.total > 0 && (
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Response Sentiment</h3>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 flex rounded-full overflow-hidden h-6">
                  {sentiments.positive > 0 && <div className="bg-green-600 flex items-center justify-center text-xs text-white font-semibold" style={{ width: `${(sentiments.positive / sentiments.total) * 100}%` }}>{sentiments.positive}</div>}
                  {sentiments.neutral > 0 && <div className="bg-gray-500 flex items-center justify-center text-xs text-white font-semibold" style={{ width: `${(sentiments.neutral / sentiments.total) * 100}%` }}>{sentiments.neutral}</div>}
                  {sentiments.negative > 0 && <div className="bg-red-600 flex items-center justify-center text-xs text-white font-semibold" style={{ width: `${(sentiments.negative / sentiments.total) * 100}%` }}>{sentiments.negative}</div>}
                </div>
              </div>
              <div className="flex gap-6 text-xs text-gray-400">
                <span><span className="inline-block w-2 h-2 rounded-full bg-green-600 mr-1"></span>Positive: {sentiments.positive}</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-gray-500 mr-1"></span>Neutral: {sentiments.neutral}</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-red-600 mr-1"></span>Negative: {sentiments.negative}</span>
              </div>
            </div>
          )}

          {/* Word Cloud */}
          {wordCloud.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Common Words</h3>
              <div className="flex flex-wrap gap-2">
                {wordCloud.map(([word, count], i) => {
                  const size = i < 5 ? 'text-lg font-bold' : i < 15 ? 'text-sm font-semibold' : 'text-xs';
                  const opacity = Math.max(0.4, 1 - i * 0.02);
                  return <span key={word} className={`${size} px-2 py-1 rounded bg-gray-700 text-gray-200`} style={{ opacity }}>{word} <span className="text-red-400 text-xs">{count}</span></span>;
                })}
              </div>
            </div>
          )}

          {/* Distributions */}
          <div className="grid grid-cols-2 gap-4">
            <DistCard title="Would Use Again" data={summary?.distributions?.would_use_again} total={summary?.total || 0} />
            <DistCard title="Service Branch" data={summary?.distributions?.service_branch} total={summary?.total || 0} />
            <DistCard title="How Heard" data={summary?.distributions?.how_heard} total={summary?.total || 0} />
            <DistCard title="Device Used" data={summary?.distributions?.device_used} total={summary?.total || 0} />
          </div>

          {/* Free Text */}
          <TextSection title="What Radio Check Did Well" submissions={submissions} field="what_done_well" />
          <TextSection title="What Could Be Improved" submissions={submissions} field="what_improve" />
          <TextSection title="How They Felt After" submissions={submissions} field="how_felt_after" />
          <TextSection title="AI Responses That Felt Wrong" submissions={submissions} field="ai_response_wrong_detail" />
          <TextSection title="Missing Features" submissions={submissions} field="missing_feature" />
        </>
      )}

      {/* ===== INSIGHTS (Priority Matrix) ===== */}
      {view === 'insights' && (
        <>
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-400" /> Priority Fix List</h3>
            <p className="text-xs text-gray-400 mb-4">Ranked by: gap from ideal (5/5) x response volume. Higher = fix first.</p>
            {priorities.length === 0 ? (
              <p className="text-gray-500 text-sm">All scores are above 4.5/5 — no urgent priorities.</p>
            ) : (
              <div className="space-y-3">
                {priorities.map((p, i) => (
                  <div key={p.key} className="flex items-center gap-4 bg-gray-750 rounded-lg p-4 border border-gray-700">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-red-600 text-white' : i < 3 ? 'bg-orange-600 text-white' : 'bg-gray-600 text-gray-200'}`}>{i + 1}</div>
                    <div className="flex-1">
                      <div className="text-white font-semibold text-sm">{p.label}</div>
                      <div className="text-gray-400 text-xs mt-0.5">Avg: {p.avg}/{p.max} | Gap: {p.gap} | Responses: {p.responses}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-red-400 font-bold text-lg">{p.priority}</div>
                      <div className="text-gray-500 text-xs">priority</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actionable Recommendations */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-400" /> What's Working</h3>
            <div className="space-y-2">
              {Object.entries(RATING_LABELS).filter(([key]) => {
                const val = summary?.averages?.[key];
                return val != null && val >= 4;
              }).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <Star className="w-4 h-4 text-green-400 shrink-0" />
                  <span className="text-gray-200">{label}: <span className="text-green-400 font-semibold">{summary?.averages?.[key]}/5</span></span>
                </div>
              ))}
              {Object.entries(RATING_LABELS).filter(([key]) => {
                const val = summary?.averages?.[key];
                return val != null && val >= 4;
              }).length === 0 && <p className="text-gray-500 text-sm">Not enough data yet.</p>}
            </div>
          </div>
        </>
      )}

      {/* ===== PERSONAS ===== */}
      {view === 'personas' && (
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Persona Performance</h3>
            {personaPerformance.length === 0 ? (
              <p className="text-gray-500 text-sm">No persona data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 text-xs uppercase border-b border-gray-700">
                      <th className="pb-3 pr-4">Persona</th>
                      <th className="pb-3 pr-4 text-center">Users</th>
                      <th className="pb-3 pr-4 text-center">Natural</th>
                      <th className="pb-3 pr-4 text-center">Understood</th>
                      <th className="pb-3 pr-4 text-center">Fit</th>
                      <th className="pb-3 text-center">Overall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personaPerformance.map(p => (
                      <tr key={p.name} className="border-b border-gray-700/50">
                        <td className="py-3 pr-4 font-semibold text-white">{p.name}</td>
                        <td className="py-3 pr-4 text-center text-gray-300">{p.count}</td>
                        <td className="py-3 pr-4 text-center"><ScoreBadge value={p.natural} /></td>
                        <td className="py-3 pr-4 text-center"><ScoreBadge value={p.understood} /></td>
                        <td className="py-3 pr-4 text-center"><ScoreBadge value={p.fit} /></td>
                        <td className="py-3 text-center"><ScoreBadge value={p.overall} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Persona Usage Chart */}
          {summary?.distributions?.personas_used && Object.keys(summary.distributions.personas_used).length > 0 && (
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Who Gets Talked To</h3>
              <div className="space-y-2">
                {Object.entries(summary.distributions.personas_used).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-gray-300 text-sm w-24 shrink-0">{name}</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-4">
                      <div className="bg-red-600 h-4 rounded-full" style={{ width: `${(count / Math.max(...Object.values(summary.distributions.personas_used))) * 100}%` }} />
                    </div>
                    <span className="text-white font-semibold text-sm w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== COHORTS ===== */}
      {view === 'cohorts' && (
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Cohort Comparison</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => setCohortFilter('all')} className={`px-3 py-1 rounded-full text-xs ${cohortFilter === 'all' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>All ({submissions.length})</button>
              {cohortOptions.branches.map(b => (
                <button key={b} onClick={() => setCohortFilter(b)} className={`px-3 py-1 rounded-full text-xs ${cohortFilter === b ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {b} ({submissions.filter(s => s.service_branch === b).length})
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mb-4">Showing {filteredSubmissions.length} responses{cohortFilter !== 'all' ? ` for ${cohortFilter}` : ''}</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(RATING_LABELS).map(([key, label]) => {
                const val = filteredAverages[key];
                const allVal = summary?.averages?.[key];
                const max = key === 'net_promoter' ? 10 : 5;
                const diff = val != null && allVal != null ? Math.round((val - allVal) * 10) / 10 : null;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs w-36 shrink-0 truncate">{label}</span>
                    <span className="text-white font-semibold text-xs">{val != null ? `${val}/${max}` : '—'}</span>
                    {diff != null && diff !== 0 && (
                      <span className={`text-xs ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>{diff > 0 ? '+' : ''}{diff}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Service Length Filter */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h4 className="text-sm font-semibold text-white mb-3">By Service Length</h4>
            <div className="flex flex-wrap gap-2">
              {cohortOptions.lengths.map(l => (
                <button key={l} onClick={() => setCohortFilter(l)} className={`px-3 py-1 rounded-full text-xs ${cohortFilter === l ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {l} ({submissions.filter(s => s.service_length === l).length})
                </button>
              ))}
            </div>
          </div>

          {/* Time Since Service Filter */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h4 className="text-sm font-semibold text-white mb-3">By Time Since Service</h4>
            <div className="flex flex-wrap gap-2">
              {cohortOptions.times.map(t => (
                <button key={t} onClick={() => setCohortFilter(t)} className={`px-3 py-1 rounded-full text-xs ${cohortFilter === t ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {t} ({submissions.filter(s => s.time_since_service === t).length})
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== RESPONSES ===== */}
      {view === 'responses' && (
        <div className="space-y-3">
          {submissions.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No responses yet</div>
          ) : submissions.map(sub => (
            <div key={sub.id} className="bg-gray-800 rounded-xl overflow-hidden">
              <button onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-750">
                <div className="flex items-center gap-4">
                  <span className="text-gray-400 text-sm font-mono">{sub.id}</span>
                  <span className="text-gray-500 text-sm">{new Date(sub.submitted_at).toLocaleString()}</span>
                  {sub.service_branch && <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">{sub.service_branch}</span>}
                </div>
                <div className="flex items-center gap-3">
                  {sub.felt_safe && <span className="text-xs text-gray-400">Safety: <span className="text-white font-semibold">{sub.felt_safe}/5</span></span>}
                  {sub.would_recommend && <span className="text-xs text-gray-400">Rec: <span className="text-white font-semibold">{sub.would_recommend}/5</span></span>}
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

// Helpers
function avg(arr?: number[]): number | null {
  if (!arr || arr.length === 0) return null;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10;
}

function StatCard({ label, value, suffix, color }: { label: string; value: any; suffix?: string; color?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 text-center">
      <div className={`text-3xl font-bold ${color || 'text-red-500'}`}>{value}{suffix && <span className="text-lg text-gray-400">{suffix}</span>}</div>
      <div className="text-xs text-gray-400 mt-1 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function ScoreBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-gray-600">—</span>;
  const color = value >= 4 ? 'bg-green-600' : value >= 3 ? 'bg-yellow-600' : 'bg-red-600';
  return <span className={`${color} text-white text-xs font-semibold px-2 py-0.5 rounded`}>{value}</span>;
}

function DistCard({ title, data, total }: { title: string; data?: Record<string, number>; total: number }) {
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

function TextSection({ title, submissions, field }: { title: string; submissions: Submission[]; field: string }) {
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
