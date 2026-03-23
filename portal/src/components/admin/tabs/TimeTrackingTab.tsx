'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Plus, Trash2, RefreshCw, BarChart3 } from 'lucide-react';
import { api } from '@/lib/admin-api';

interface TimeTrackingTabProps {
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function TimeTrackingTab({ token, onSuccess, onError }: TimeTrackingTabProps) {
  const [timeTrackingSummary, setTimeTrackingSummary] = useState<any>(null);
  const [timeTrackingEntries, setTimeTrackingEntries] = useState<any[]>([]);
  const [timeTrackingCategories, setTimeTrackingCategories] = useState<string[]>([]);
  const [showAddTimeEntryModal, setShowAddTimeEntryModal] = useState(false);
  const [selectedTimeTrackingMonth, setSelectedTimeTrackingMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // Format: YYYY-MM
  );
  const [newTimeEntry, setNewTimeEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: 0,
    minutes: 0,
    category: 'Development',
    description: '',
  });

  const loadTimeTracking = useCallback(async (month?: string) => {
    if (!token) return;
    const monthToUse = month || selectedTimeTrackingMonth;
    try {
      const [summaryData, entriesData, categoriesData] = await Promise.all([
        api.getTimeTrackingSummary(token, monthToUse).catch(() => null),
        api.getTimeTrackingEntries(token, 50).catch(() => ({ entries: [] })),
        api.getTimeTrackingCategories(token).catch(() => ({ categories: [] })),
      ]);
      setTimeTrackingSummary(summaryData);
      // Filter entries by selected month
      const filteredEntries = entriesData?.entries?.filter((entry: any) => {
        if (!entry.date) return true;
        return entry.date.startsWith(monthToUse);
      }) || [];
      setTimeTrackingEntries(filteredEntries);
      setTimeTrackingCategories(categoriesData?.categories || []);
    } catch (err: any) {
      console.error('Time tracking data not available:', err);
    }
  }, [token, selectedTimeTrackingMonth]);

  useEffect(() => {
    loadTimeTracking();
  }, [loadTimeTracking]);

  const handleAddTimeEntry = async () => {
    if (!token) return;
    try {
      await api.createTimeEntry(token, newTimeEntry);
      setShowAddTimeEntryModal(false);
      setNewTimeEntry({
        date: new Date().toISOString().split('T')[0],
        hours: 0,
        minutes: 0,
        category: 'Development',
        description: '',
      });
      loadTimeTracking();
      onSuccess('Time entry added');
    } catch (err: any) {
      onError('Failed to add time entry: ' + err.message);
    }
  };

  const handleDeleteTimeEntry = async (id: string) => {
    if (!token || !confirm('Delete this time entry?')) return;
    try {
      await api.deleteTimeEntry(token, id);
      loadTimeTracking();
      onSuccess('Time entry deleted');
    } catch (err: any) {
      onError('Failed to delete entry');
    }
  };

  const handleMonthChange = (month: string) => {
    setSelectedTimeTrackingMonth(month);
    loadTimeTracking(month);
  };

  return (
    <div data-testid="timetracking-tab">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Time Tracking</h2>
        <div className="flex gap-2 items-center">
          <input
            type="month"
            value={selectedTimeTrackingMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          />
          <button onClick={() => setShowAddTimeEntryModal(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Log Time
          </button>
          <button onClick={() => loadTimeTracking()} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6">
          <Clock className="w-8 h-8 mb-2 opacity-80" />
          <p className="text-blue-200 text-sm mb-1">Total Hours</p>
          <p className="text-3xl font-bold">{timeTrackingSummary?.total?.hours || 0}h {timeTrackingSummary?.total?.minutes || 0}m</p>
        </div>
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-6">
          <p className="text-green-200 text-sm mb-1">Total Cost</p>
          <p className="text-3xl font-bold">£{timeTrackingSummary?.total?.total_cost?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-6">
          <p className="text-purple-200 text-sm mb-1">Entries</p>
          <p className="text-3xl font-bold">{timeTrackingSummary?.total?.entry_count || timeTrackingEntries.length}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-lg p-6">
          <p className="text-yellow-200 text-sm mb-1">Avg Daily</p>
          <p className="text-3xl font-bold">{timeTrackingSummary?.avg_daily_hours?.toFixed(1) || 0}h</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Entries */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            Recent Entries
          </h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {timeTrackingEntries.length > 0 ? (
              timeTrackingEntries.map((entry: any) => (
                <div key={entry.id} className="bg-gray-700 rounded-lg p-4 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{entry.hours}h {entry.minutes}m</span>
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">{entry.category}</span>
                    </div>
                    <p className="text-sm text-gray-400">{entry.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{entry.date}</p>
                  </div>
                  <button 
                    onClick={() => handleDeleteTimeEntry(entry.id)}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center py-8">No time entries logged</p>
            )}
          </div>
        </div>

        {/* By Category Breakdown */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-yellow-400" />
            By Category
          </h3>
          <div className="space-y-3">
            {timeTrackingSummary?.by_category && Object.keys(timeTrackingSummary.by_category).length > 0 ? (
              Object.entries(timeTrackingSummary.by_category).map(([category, data]: [string, any]) => (
                <div key={category} className="bg-gray-700 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium">{category}</span>
                    <span className="text-green-400">£{data.cost?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>{data.hours}h {data.minutes}m ({data.entry_count} entries)</span>
                    <span>@ £{data.hourly_rate}/hr</span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-2 mt-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (data.total_minutes / (timeTrackingSummary.total?.total_minutes || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center py-8">No category data</p>
            )}
          </div>
        </div>
      </div>

      {/* Daily Breakdown */}
      {timeTrackingSummary?.daily_breakdown && timeTrackingSummary.daily_breakdown.length > 0 && (
        <div className="mt-6 bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="font-semibold mb-4">Daily Summary</h3>
          <div className="grid grid-cols-7 gap-2">
            {timeTrackingSummary.daily_breakdown.slice(-14).map((day: any, i: number) => (
              <div key={day.date || i} className="text-center p-3 bg-gray-700 rounded-lg">
                <p className="text-xs text-gray-400">{day.date?.slice(-5) || `Day ${i+1}`}</p>
                <p className="font-bold">{day.hours}h</p>
                {day.minutes > 0 && <p className="text-xs text-gray-500">{day.minutes}m</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Time Entry Modal */}
      {showAddTimeEntryModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowAddTimeEntryModal(false)}>
          <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold">Log Time Entry</h2>
              <button onClick={() => setShowAddTimeEntryModal(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Date</label>
                <input
                  type="date"
                  value={newTimeEntry.date}
                  onChange={(e) => setNewTimeEntry({ ...newTimeEntry, date: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Hours</label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={newTimeEntry.hours}
                    onChange={(e) => setNewTimeEntry({ ...newTimeEntry, hours: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Minutes</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={newTimeEntry.minutes}
                    onChange={(e) => setNewTimeEntry({ ...newTimeEntry, minutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <select
                  value={newTimeEntry.category}
                  onChange={(e) => setNewTimeEntry({ ...newTimeEntry, category: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  {(timeTrackingCategories.length > 0 ? timeTrackingCategories : ['Development', 'Support', 'App Testing', 'Admin Portal', 'Staff Portal', 'Meetings', 'Other']).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={newTimeEntry.description}
                  onChange={(e) => setNewTimeEntry({ ...newTimeEntry, description: e.target.value })}
                  placeholder="What did you work on?"
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white resize-none"
                />
              </div>
              <button
                onClick={handleAddTimeEntry}
                disabled={!newTimeEntry.description || (newTimeEntry.hours === 0 && newTimeEntry.minutes === 0)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold disabled:opacity-50"
              >
                Save Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
