'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, X, Calendar, ChevronDown, Check } from 'lucide-react';
import { api } from '@/lib/admin-api';
import type { StaffMember } from '@/types/admin';

interface RotaTabProps {
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function RotaTab({ token, onSuccess, onError }: RotaTabProps) {
  // Data state
  const [shifts, setShifts] = useState<any[]>([]);
  const [pendingSwaps, setPendingSwaps] = useState<any[]>([]);
  const [rotaStaffList, setRotaStaffList] = useState<StaffMember[]>([]);
  const [allSwapRequests, setAllSwapRequests] = useState<any[]>([]);
  
  // UI state
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [swapTabView, setSwapTabView] = useState<'pending' | 'all'>('pending');
  const [rotaCalendarMonth, setRotaCalendarMonth] = useState(new Date());
  const [selectedRotaDate, setSelectedRotaDate] = useState<string | null>(null);
  
  // Form state
  const [newShiftData, setNewShiftData] = useState({
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '17:00',
    user_id: '',
    user_name: '',
    user_email: '',
  });

  const loadRota = useCallback(async () => {
    if (!token) return;
    try {
      const [shiftsData, swapsData, staffData] = await Promise.all([
        api.getShifts(token).catch(() => []),
        api.getPendingSwaps(token).catch(() => []),
        api.getStaff(token).catch(() => []),
      ]);
      setShifts(Array.isArray(shiftsData) ? shiftsData : []);
      setPendingSwaps(Array.isArray(swapsData) ? swapsData : []);
      setRotaStaffList(Array.isArray(staffData) ? staffData : []);
    } catch (err: any) {
      console.error('Rota data not available:', err);
    }
  }, [token]);

  useEffect(() => {
    loadRota();
  }, [loadRota]);

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newShiftData.user_id) return;
    try {
      const selectedStaff = rotaStaffList.find((s: StaffMember) => s.id === newShiftData.user_id);
      await api.createShift(
        token,
        { date: newShiftData.date, start_time: newShiftData.start_time, end_time: newShiftData.end_time },
        newShiftData.user_id,
        selectedStaff?.name || '',
        selectedStaff?.email || ''
      );
      setShowAddShiftModal(false);
      setNewShiftData({ date: new Date().toISOString().split('T')[0], start_time: '09:00', end_time: '17:00', user_id: '', user_name: '', user_email: '' });
      loadRota();
      onSuccess('Shift created successfully');
    } catch (err: any) {
      onError('Failed to create shift: ' + err.message);
    }
  };

  const handleApproveSwap = async (swapId: string, approve: boolean) => {
    try {
      await api.approveSwap(token, swapId, approve);
      onSuccess(approve ? 'Swap request approved' : 'Swap request rejected');
      loadRota();
      if (swapTabView === 'all') {
        const all = await api.getSwapRequests(token);
        setAllSwapRequests(all || []);
      }
    } catch (err: any) {
      onError('Failed: ' + err.message);
    }
  };

  // Calculate coverage gaps
  const calculateCoverageGaps = () => {
    let gaps = 0;
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayShifts = shifts.filter(s => s.date === dateStr);
      if (dayShifts.length === 0) gaps++;
    }
    return gaps;
  };

  const coverageGaps = calculateCoverageGaps();

  return (
    <div data-testid="rota-tab">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Staff Rota & Scheduling</h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAddShiftModal(true)} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Shift
          </button>
          <button onClick={loadRota} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Add Shift Modal */}
      {showAddShiftModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Add New Shift</h3>
              <button onClick={() => setShowAddShiftModal(false)} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateShift}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Staff Member</label>
                  <select
                    value={newShiftData.user_id}
                    onChange={(e) => setNewShiftData({ ...newShiftData, user_id: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    required
                  >
                    <option value="">Select staff member...</option>
                    {rotaStaffList.map((staffMember: StaffMember) => (
                      <option key={staffMember.id} value={staffMember.id}>{staffMember.name} ({staffMember.role})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={newShiftData.date}
                    onChange={(e) => setNewShiftData({ ...newShiftData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={newShiftData.start_time}
                      onChange={(e) => setNewShiftData({ ...newShiftData, start_time: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">End Time</label>
                    <input
                      type="time"
                      value={newShiftData.end_time}
                      onChange={(e) => setNewShiftData({ ...newShiftData, end_time: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddShiftModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Create Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Coverage Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-4">
          <p className="text-green-200 text-sm">Counsellors Today</p>
          <p className="text-2xl font-bold">
            {shifts.filter(s => {
              if (s.date !== new Date().toISOString().split('T')[0]) return false;
              const staffMember = rotaStaffList.find((st: StaffMember) => st.id === s.user_id);
              return staffMember?.role === 'counsellor';
            }).length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4">
          <p className="text-blue-200 text-sm">Peers Today</p>
          <p className="text-2xl font-bold">
            {shifts.filter(s => {
              if (s.date !== new Date().toISOString().split('T')[0]) return false;
              const staffMember = rotaStaffList.find((st: StaffMember) => st.id === s.user_id);
              return staffMember?.role === 'peer';
            }).length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-4">
          <p className="text-purple-200 text-sm">Shifts This Week</p>
          <p className="text-2xl font-bold">
            {shifts.filter(s => {
              const shiftDate = new Date(s.date);
              const today = new Date();
              const weekEnd = new Date();
              weekEnd.setDate(today.getDate() + 7);
              return shiftDate >= today && shiftDate < weekEnd;
            }).length}
          </p>
        </div>
        {coverageGaps > 0 ? (
          <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-lg p-4">
            <p className="text-red-200 text-sm">Coverage Gaps</p>
            <p className="text-2xl font-bold">{coverageGaps} days</p>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg p-4">
            <p className="text-gray-300 text-sm">Coverage Status</p>
            <p className="text-lg font-bold text-green-400">✓ Full Coverage</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Full Month Calendar */}
        <div className="lg:col-span-2 bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex justify-between items-center mb-4">
            <button 
              onClick={() => setRotaCalendarMonth(new Date(rotaCalendarMonth.getFullYear(), rotaCalendarMonth.getMonth() - 1))}
              className="p-2 hover:bg-gray-700 rounded"
            >
              <ChevronDown className="w-5 h-5 rotate-90" />
            </button>
            <h3 className="font-semibold text-lg">
              {rotaCalendarMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </h3>
            <button 
              onClick={() => setRotaCalendarMonth(new Date(rotaCalendarMonth.getFullYear(), rotaCalendarMonth.getMonth() + 1))}
              className="p-2 hover:bg-gray-700 rounded"
            >
              <ChevronDown className="w-5 h-5 -rotate-90" />
            </button>
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day Headers */}
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="text-center text-xs text-gray-400 py-2 font-medium">
                {day}
              </div>
            ))}
            
            {/* Calendar Days */}
            {(() => {
              const year = rotaCalendarMonth.getFullYear();
              const month = rotaCalendarMonth.getMonth();
              const firstDay = new Date(year, month, 1);
              const lastDay = new Date(year, month + 1, 0);
              const daysInMonth = lastDay.getDate();
              
              let startDay = firstDay.getDay() - 1;
              if (startDay < 0) startDay = 6;
              
              const days = [];
              const today = new Date().toISOString().split('T')[0];
              
              for (let i = 0; i < startDay; i++) {
                days.push(<div key={`empty-${i}`} className="h-20 bg-gray-900/50 rounded" />);
              }
              
              for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayShifts = shifts.filter(s => s.date === dateStr);
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedRotaDate;
                
                days.push(
                  <div 
                    key={day}
                    onClick={() => setSelectedRotaDate(dateStr)}
                    className={`h-20 p-1 rounded cursor-pointer transition-colors ${
                      isToday ? 'bg-blue-600/30 border border-blue-500' :
                      isSelected ? 'bg-purple-600/30 border border-purple-500' :
                      dayShifts.length > 0 ? 'bg-green-600/20 hover:bg-green-600/30' :
                      'bg-gray-700/50 hover:bg-gray-700'
                    }`}
                  >
                    <div className="text-xs font-medium mb-1">{day}</div>
                    {dayShifts.length > 0 && (
                      <div className="space-y-0.5">
                        {dayShifts.slice(0, 2).map((s, i) => (
                          <div key={i} className={`text-[10px] px-1 py-0.5 rounded truncate ${
                            rotaStaffList.find((st: StaffMember) => st.id === s.user_id)?.role === 'counsellor' 
                              ? 'bg-green-500/40 text-green-200'
                              : 'bg-blue-500/40 text-blue-200'
                          }`}>
                            {s.user_name?.split(' ')[0] || 'Shift'}
                          </div>
                        ))}
                        {dayShifts.length > 2 && (
                          <div className="text-[10px] text-gray-400">+{dayShifts.length - 2} more</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
              
              return days;
            })()}
          </div>
          
          {/* Legend */}
          <div className="flex gap-4 mt-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500/40 rounded"></div>
              <span className="text-gray-400">Counsellor</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500/40 rounded"></div>
              <span className="text-gray-400">Peer</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-600/30 border border-blue-500 rounded"></div>
              <span className="text-gray-400">Today</span>
            </div>
          </div>
        </div>

        {/* Selected Day / Today's Shifts Panel */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            {selectedRotaDate 
              ? new Date(selectedRotaDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
              : "Today's Shifts"}
          </h3>
          
          {(() => {
            const dateToShow = selectedRotaDate || new Date().toISOString().split('T')[0];
            const dayShifts = shifts.filter(s => s.date === dateToShow);
            
            if (dayShifts.length === 0) {
              return (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-400">No shifts scheduled</p>
                  <button 
                    onClick={() => {
                      setNewShiftData({ ...newShiftData, date: dateToShow });
                      setShowAddShiftModal(true);
                    }}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                  >
                    Add Shift
                  </button>
                </div>
              );
            }
            
            return (
              <div className="space-y-3">
                {dayShifts.map((shift) => {
                  const staffMember = rotaStaffList.find((st: StaffMember) => st.id === shift.user_id);
                  return (
                    <div key={shift.id} className="bg-gray-700 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{shift.user_name || 'Unassigned'}</p>
                          <p className="text-sm text-gray-400">{shift.start_time} - {shift.end_time}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${
                          staffMember?.role === 'counsellor' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {staffMember?.role || 'staff'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          shift.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {shift.status || 'pending'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                
                <button 
                  onClick={() => {
                    setNewShiftData({ ...newShiftData, date: dateToShow });
                    setShowAddShiftModal(true);
                  }}
                  className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Shift
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Swap Requests with Pending/All Tabs */}
      <div className="mt-6 bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-yellow-400" />
            Swap Requests
          </h3>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                setSwapTabView('pending');
                if (token) {
                  try {
                    const pending = await api.getPendingSwaps(token);
                    setPendingSwaps(pending || []);
                  } catch (err) {
                    console.error('Failed to load pending swaps');
                  }
                }
              }}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                swapTabView === 'pending' 
                  ? 'bg-yellow-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Pending ({pendingSwaps.length})
            </button>
            <button
              onClick={async () => {
                setSwapTabView('all');
                if (token) {
                  try {
                    const all = await api.getSwapRequests(token);
                    setAllSwapRequests(all || []);
                  } catch (err) {
                    console.error('Failed to load all swaps');
                  }
                }
              }}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                swapTabView === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All
            </button>
          </div>
        </div>
        
        {/* Pending Swaps Tab */}
        {swapTabView === 'pending' && (
          pendingSwaps.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No pending swap requests</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingSwaps.map((swap) => (
                <div key={swap.id} className="bg-gray-700 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{swap.requester_name}</p>
                      <p className="text-sm text-gray-400">{swap.shift_date} • {swap.shift_start} - {swap.shift_end}</p>
                    </div>
                    <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-400">
                      {swap.status}
                    </span>
                  </div>
                  {swap.responder_name && (
                    <p className="text-sm text-gray-400 mb-2">Cover: {swap.responder_name}</p>
                  )}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleApproveSwap(swap.id, true)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleApproveSwap(swap.id, false)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        
        {/* All Swaps Tab */}
        {swapTabView === 'all' && (
          allSwapRequests.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No swap requests found</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allSwapRequests.map((swap) => (
                <div key={swap.id} className="bg-gray-700 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{swap.requester_name}</p>
                      <p className="text-sm text-gray-400">{swap.shift_date} • {swap.shift_start} - {swap.shift_end}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      swap.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                      swap.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {swap.status}
                    </span>
                  </div>
                  {swap.responder_name && (
                    <p className="text-sm text-gray-400 mb-2">Cover: {swap.responder_name}</p>
                  )}
                  {swap.status === 'pending' && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleApproveSwap(swap.id, true)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => handleApproveSwap(swap.id, false)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
