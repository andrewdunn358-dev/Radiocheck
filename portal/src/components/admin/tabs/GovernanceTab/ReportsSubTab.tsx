'use client';

import { useState } from 'react';
import { FileText, AlertTriangle, Check, Trash2 } from 'lucide-react';
import { api } from '@/lib/admin-api';

interface ReportsSubTabProps {
  token: string;
  governanceSummary: any;
  setGovernanceSummary: (summary: any) => void;
  scheduledReports: any[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onRefresh: () => void;
}

export default function ReportsSubTab({ 
  token, 
  governanceSummary, 
  setGovernanceSummary, 
  scheduledReports, 
  onSuccess, 
  onError, 
  onRefresh 
}: ReportsSubTabProps) {
  const [reportEmailInput, setReportEmailInput] = useState('');
  const [scheduleEmailInput, setScheduleEmailInput] = useState('');
  const [scheduleFrequency, setScheduleFrequency] = useState('weekly');

  const handleGenerateReport = async (period: 'weekly' | 'monthly') => {
    try {
      const report = await api.getGovernanceSummary(token, period);
      setGovernanceSummary(report);
      onSuccess(`${period.charAt(0).toUpperCase() + period.slice(1)} report generated`);
    } catch (err: any) {
      onError('Failed: ' + err.message);
    }
  };

  const handleEmailReport = async () => {
    if (!reportEmailInput) {
      onError('Please enter an email address');
      return;
    }
    try {
      await api.emailReport(token, reportEmailInput, 'weekly');
      onSuccess(`Report sent to ${reportEmailInput}`);
      setReportEmailInput('');
    } catch (err: any) {
      onError('Failed to send: ' + err.message);
    }
  };

  const handleAddSchedule = async () => {
    if (!scheduleEmailInput) {
      onError('Please enter an email');
      return;
    }
    try {
      await api.addScheduledReport(token, scheduleEmailInput, scheduleFrequency);
      onSuccess(`Scheduled ${scheduleFrequency} reports to ${scheduleEmailInput}`);
      setScheduleEmailInput('');
      onRefresh();
    } catch (err: any) {
      onError('Failed: ' + err.message);
    }
  };

  const handleDeleteSchedule = async (email: string) => {
    if (!confirm(`Remove scheduled reports for ${email}?`)) return;
    try {
      await api.deleteScheduledReport(token, email);
      onSuccess('Schedule removed');
      onRefresh();
    } catch (err: any) {
      onError('Failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-6" data-testid="reports-subtab">
      {/* Generate Report Section */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="font-semibold mb-4">Generate Report</h3>
        <div className="flex gap-4 flex-wrap">
          <button
            onClick={() => handleGenerateReport('weekly')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Generate Weekly
          </button>
          <button
            onClick={() => handleGenerateReport('monthly')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
          >
            Generate Monthly
          </button>
        </div>
      </div>

      {/* Report Display */}
      {governanceSummary && (
        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg border border-blue-700 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Report: {governanceSummary.period || 'N/A'}</h3>
            <span className="text-xs text-gray-400">
              {governanceSummary.period_start && governanceSummary.period_end 
                ? `${new Date(governanceSummary.period_start).toLocaleDateString()} - ${new Date(governanceSummary.period_end).toLocaleDateString()}`
                : ''}
            </span>
          </div>
          
          {/* Safeguarding Stats */}
          {governanceSummary.safeguarding && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-gray-800/50 rounded p-3 border-l-4 border-red-500">
                <p className="text-xs text-gray-400">Total Alerts</p>
                <p className="text-xl font-bold">{governanceSummary.safeguarding.total_alerts || 0}</p>
              </div>
              <div className="bg-gray-800/50 rounded p-3 border-l-4 border-red-600">
                <p className="text-xs text-gray-400">Imminent Risk</p>
                <p className="text-xl font-bold text-red-400">{governanceSummary.safeguarding.imminent_risk || 0}</p>
              </div>
              <div className="bg-gray-800/50 rounded p-3 border-l-4 border-orange-500">
                <p className="text-xs text-gray-400">High Risk</p>
                <p className="text-xl font-bold text-orange-400">{governanceSummary.safeguarding.high_risk || 0}</p>
              </div>
              <div className="bg-gray-800/50 rounded p-3 border-l-4 border-purple-500">
                <p className="text-xs text-gray-400">Panic Alerts</p>
                <p className="text-xl font-bold text-purple-400">{governanceSummary.safeguarding.panic_alerts || 0}</p>
              </div>
            </div>
          )}

          {/* Engagement Stats */}
          {governanceSummary.engagement && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-gray-800/50 rounded p-3 border-l-4 border-blue-500">
                <p className="text-xs text-gray-400">AI Chats</p>
                <p className="text-xl font-bold">{governanceSummary.engagement.ai_chat_sessions || 0}</p>
              </div>
              <div className="bg-gray-800/50 rounded p-3 border-l-4 border-blue-400">
                <p className="text-xs text-gray-400">Live Chats</p>
                <p className="text-xl font-bold">{governanceSummary.engagement.live_chats || 0}</p>
              </div>
              <div className="bg-gray-800/50 rounded p-3 border-l-4 border-blue-300">
                <p className="text-xs text-gray-400">Callbacks</p>
                <p className="text-xl font-bold">{governanceSummary.engagement.callbacks_requested || 0}</p>
              </div>
              <div className="bg-gray-800/50 rounded p-3 border-l-4 border-green-500">
                <p className="text-xs text-gray-400">Completion Rate</p>
                <p className="text-xl font-bold text-green-400">{governanceSummary.engagement.callback_completion_rate || 'N/A'}</p>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {governanceSummary.recommendations && governanceSummary.recommendations.length > 0 ? (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
              <h4 className="font-medium text-yellow-300 mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {governanceSummary.recommendations.map((rec: string, idx: number) => (
                  <li key={idx} className="text-sm text-yellow-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
              <p className="text-green-300 flex items-center gap-2">
                <Check className="w-5 h-5" />
                All systems operating within normal parameters
              </p>
            </div>
          )}

          {/* Report Actions */}
          <div className="flex gap-3 mt-4">
            <button 
              onClick={() => window.print()}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2"
            >
              <FileText className="w-4 h-4" /> Print
            </button>
          </div>
        </div>
      )}

      {/* Email Report */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="font-semibold mb-4">Email Report</h3>
        <div className="flex gap-2">
          <input
            type="email"
            value={reportEmailInput}
            onChange={(e) => setReportEmailInput(e.target.value)}
            placeholder="Enter email address"
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          />
          <button
            onClick={handleEmailReport}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Send
          </button>
        </div>
      </div>

      {/* Scheduled Reports */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="font-semibold mb-4">Scheduled Reports</h3>
        <div className="flex gap-2 mb-4">
          <input
            type="email"
            value={scheduleEmailInput}
            onChange={(e) => setScheduleEmailInput(e.target.value)}
            placeholder="Email address"
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          />
          <select
            value={scheduleFrequency}
            onChange={(e) => setScheduleFrequency(e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <button
            onClick={handleAddSchedule}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
          >
            Add
          </button>
        </div>
        
        {scheduledReports.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No scheduled reports configured</p>
        ) : (
          <div className="space-y-2">
            {scheduledReports.map((schedule: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                <div>
                  <span className="font-medium">{schedule.email}</span>
                  <span className="text-gray-400 ml-3">{schedule.frequency}</span>
                  {schedule.enabled ? (
                    <span className="ml-3 text-green-400 text-sm">Active</span>
                  ) : (
                    <span className="ml-3 text-yellow-400 text-sm">Paused</span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteSchedule(schedule.email)}
                  className="p-1 bg-red-600 hover:bg-red-700 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
