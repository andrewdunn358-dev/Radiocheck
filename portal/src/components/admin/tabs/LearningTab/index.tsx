'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '@/lib/admin-api';
import PatternsSubTab from './PatternsSubTab';
import QueueSubTab from './QueueSubTab';
import ApprovedSubTab from './ApprovedSubTab';
import FeedbackSubTab from './FeedbackSubTab';

interface LearningTabProps {
  token: string;
  userId?: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function LearningTab({ token, userId, onSuccess, onError }: LearningTabProps) {
  const [learningSubTab, setLearningSubTab] = useState<'patterns' | 'queue' | 'approved' | 'feedback'>('patterns');
  const [learningStats, setLearningStats] = useState<any>(null);
  const [moderationQueue, setModerationQueue] = useState<any[]>([]);
  const [safetyPatterns, setSafetyPatterns] = useState<any[]>([]);
  const [approvedLearnings, setApprovedLearnings] = useState<any[]>([]);
  const [responseFeedback, setResponseFeedback] = useState<any[]>([]);
  const [patternCategoryFilter, setPatternCategoryFilter] = useState('');
  const [patternSeverityFilter, setPatternSeverityFilter] = useState('');

  const loadLearning = useCallback(async () => {
    if (!token) return;
    try {
      const [statsData, queueData, patternsData, approvedData, feedbackData] = await Promise.all([
        api.getLearningStats(token).catch(() => null),
        api.getLearningQueue(token).catch(() => ({ learnings: [] })),
        api.getSafetyPatterns(token, patternCategoryFilter, patternSeverityFilter).catch(() => ({ patterns: [] })),
        api.getApprovedLearnings(token).catch(() => ({ learnings: [] })),
        api.getResponseFeedback(token).catch(() => ({ feedback: [] })),
      ]);
      setLearningStats(statsData);
      setModerationQueue(queueData?.learnings || queueData?.queue || []);
      setSafetyPatterns(patternsData?.patterns || []);
      setApprovedLearnings(approvedData?.learnings || []);
      setResponseFeedback(feedbackData?.feedback || feedbackData || []);
    } catch (err: any) {
      console.error('Learning data not available:', err);
    }
  }, [token, patternCategoryFilter, patternSeverityFilter]);

  useEffect(() => {
    loadLearning();
  }, [loadLearning]);

  const handleSeedDefaults = async () => {
    if (!token) return;
    try {
      await api.fetch(`/learning/patterns/seed-defaults?admin_id=${userId}`, { token, method: 'POST' });
      onSuccess('Default patterns seeded');
      loadLearning();
    } catch (err: any) {
      onError('Failed to seed patterns: ' + err.message);
    }
  };

  return (
    <div data-testid="learning-tab">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">AI Learning & Moderation</h2>
        <div className="flex gap-2">
          <button 
            onClick={handleSeedDefaults}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm"
          >
            Seed Defaults
          </button>
          <button onClick={loadLearning} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Active Patterns</p>
          <p className="text-2xl font-bold">{learningStats?.patterns?.active || 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Pending Review</p>
          <p className="text-2xl font-bold text-yellow-400">{learningStats?.learnings?.pending || moderationQueue.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Approved Learnings</p>
          <p className="text-2xl font-bold text-green-400">{learningStats?.learnings?.approved || 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Pending Feedback</p>
          <p className="text-2xl font-bold text-blue-400">{learningStats?.feedback?.pending || 0}</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'patterns', label: 'Safety Patterns', icon: 'shield' },
          { id: 'queue', label: 'Approval Queue', icon: 'clock', badge: moderationQueue.length },
          { id: 'approved', label: 'Approved', icon: 'check' },
          { id: 'feedback', label: 'Feedback', icon: 'message', badge: learningStats?.feedback?.pending },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setLearningSubTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
              learningSubTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {tab.label}
            {tab.badge && tab.badge > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Sub-tab Content */}
      {learningSubTab === 'patterns' && (
        <PatternsSubTab
          token={token}
          userId={userId}
          safetyPatterns={safetyPatterns}
          patternCategoryFilter={patternCategoryFilter}
          patternSeverityFilter={patternSeverityFilter}
          setPatternCategoryFilter={setPatternCategoryFilter}
          setPatternSeverityFilter={setPatternSeverityFilter}
          onSuccess={onSuccess}
          onError={onError}
          onRefresh={loadLearning}
        />
      )}

      {learningSubTab === 'queue' && (
        <QueueSubTab
          token={token}
          userId={userId}
          moderationQueue={moderationQueue}
          onSuccess={onSuccess}
          onError={onError}
          onRefresh={loadLearning}
        />
      )}

      {learningSubTab === 'approved' && (
        <ApprovedSubTab approvedLearnings={approvedLearnings} />
      )}

      {learningSubTab === 'feedback' && (
        <FeedbackSubTab
          token={token}
          responseFeedback={responseFeedback}
          onSuccess={onSuccess}
          onError={onError}
          onRefresh={loadLearning}
        />
      )}
    </div>
  );
}
