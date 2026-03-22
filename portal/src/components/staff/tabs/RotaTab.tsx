'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Plus, ChevronLeft, ChevronRight, ArrowLeftRight, Trash2, X
} from 'lucide-react';
import { staffApi, Shift, ShiftSwap } from '@/lib/api';

interface RotaTabProps {
  token: string;
  user: any;
}

export default function RotaTab({
  token,
  user,
}: RotaTabProps) {
  // Data state
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [swapRequests, setSwapRequests] = useState<ShiftSwap[]>([]);
  
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Modal state
  const [showAddShift, setShowAddShift] = useState(false);
  const [newShiftDate, setNewShiftDate] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('');
  const [newShiftEnd, setNewShiftEnd] = useState('');
  const [newShiftType, setNewShiftType] = useState('morning');

  // Load shifts
  const loadShifts = useCallback(async () => {
    if (!token) return;
    try {
      const data = await staffApi.getShifts(token);
      setShifts(data);
      const swaps = await staffApi.getSwapRequests(token);
      setSwapRequests(swaps);
    } catch (err) {
      console.error('Failed to load shifts:', err);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    if (token) {
      loadShifts();
    }
  }, [token, loadShifts]);

  // Handler functions
  const handleAddShift = async () => {
    if (!token || !user || !newShiftDate || !newShiftStart || !newShiftEnd) return;
    try {
      await staffApi.createShift(
        token, 
        {
          date: newShiftDate,
          start_time: newShiftStart,
          end_time: newShiftEnd,
        },
        user.id,
        user.name || '',
        user.email || ''
      );
      setShowAddShift(false);
      setNewShiftDate('');
      setNewShiftStart('');
      setNewShiftEnd('');
      loadShifts();
    } catch (err) {
      console.error('Failed to add shift:', err);
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!token || !confirm('Delete this shift?')) return;
    try {
      await staffApi.deleteShift(token, id);
      loadShifts();
    } catch (err) {
      console.error('Failed to delete shift:', err);
    }
  };

  const handleRequestSwap = async (shiftId: string) => {
    if (!token) return;
    const reason = prompt('Why do you need to swap this shift?');
    if (!reason) return;
    try {
      await staffApi.createSwapRequest(token, shiftId, reason);
      loadShifts();
      alert('Swap request submitted');
    } catch (err) {
      console.error('Failed to request swap:', err);
    }
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { daysInMonth, startingDay };
  };

  const getShiftsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return shifts.filter(s => s.date === dateStr || s.date?.startsWith(dateStr));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-6 h-6 text-secondary" />
          My Shifts
        </h1>
        <button
          onClick={() => setShowAddShift(true)}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-primary-dark rounded-lg hover:bg-secondary-light"
        >
          <Plus className="w-4 h-4" />
          Add Shift
        </button>
      </div>

      {/* Calendar */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <button onClick={prevMonth} className="p-2 hover:bg-white/5 rounded">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-lg font-semibold">
            {currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={nextMonth} className="p-2 hover:bg-white/5 rounded">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm text-gray-400 py-2">{day}</div>
          ))}
          {(() => {
            const { daysInMonth, startingDay } = getDaysInMonth(currentMonth);
            const days = [];
            for (let i = 0; i < startingDay; i++) {
              days.push(<div key={`empty-${i}`} className="p-2" />);
            }
            for (let day = 1; day <= daysInMonth; day++) {
              const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
              const dayShifts = getShiftsForDate(date);
              const isToday = new Date().toDateString() === date.toDateString();
              days.push(
                <div
                  key={day}
                  onClick={() => setSelectedDate(date)}
                  className={`p-2 text-center rounded cursor-pointer transition-colors ${
                    isToday ? 'bg-secondary/20 border border-secondary' :
                    selectedDate?.toDateString() === date.toDateString() ? 'bg-primary-light' :
                    'hover:bg-white/5'
                  }`}
                >
                  <span className="text-sm">{day}</span>
                  {dayShifts.length > 0 && (
                    <div className="mt-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full mx-auto" />
                    </div>
                  )}
                </div>
              );
            }
            return days;
          })()}
        </div>
      </div>

      {/* Shifts List */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold mb-4">
          {selectedDate ? `Shifts for ${selectedDate.toLocaleDateString('en-GB')}` : 'Upcoming Shifts'}
        </h3>
        <div className="space-y-3">
          {(selectedDate ? getShiftsForDate(selectedDate) : shifts.slice(0, 10)).map(shift => (
            <div key={shift._id} className="flex justify-between items-center p-4 bg-primary-dark/50 rounded-lg">
              <div>
                <p className="font-semibold">{new Date(shift.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                <p className="text-sm text-gray-400">
                  {shift.start_time} - {shift.end_time}
                  <span className="ml-2 px-2 py-0.5 bg-primary-light rounded text-xs">{shift.shift_type}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleRequestSwap(shift._id)} className="p-2 hover:bg-white/5 rounded" title="Request Swap">
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
                <button onClick={() => handleDeleteShift(shift._id)} className="p-2 hover:bg-red-500/20 rounded text-red-400" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {shifts.length === 0 && (
            <p className="text-gray-500 text-center py-4">No shifts scheduled</p>
          )}
        </div>
      </div>

      {/* Swap Requests */}
      {swapRequests.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 mt-6">
          <h3 className="font-semibold mb-4">Swap Requests</h3>
          <div className="space-y-3">
            {swapRequests.map(swap => (
              <div key={swap._id} className="flex justify-between items-center p-4 bg-primary-dark/50 rounded-lg">
                <div>
                  <p className="text-sm">{swap.reason}</p>
                  <p className="text-xs text-gray-400">Requested by: {swap.requested_by_name}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  swap.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  swap.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {swap.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Shift Modal */}
      {showAddShift && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowAddShift(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Plus className="w-5 h-5 text-secondary" />
                Add Shift
              </h2>
              <button onClick={() => setShowAddShift(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Date</label>
                <input
                  type="date"
                  value={newShiftDate}
                  onChange={(e) => setNewShiftDate(e.target.value)}
                  className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Start Time</label>
                  <input
                    type="time"
                    value={newShiftStart}
                    onChange={(e) => setNewShiftStart(e.target.value)}
                    className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">End Time</label>
                  <input
                    type="time"
                    value={newShiftEnd}
                    onChange={(e) => setNewShiftEnd(e.target.value)}
                    className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Shift Type</label>
                <select
                  value={newShiftType}
                  onChange={(e) => setNewShiftType(e.target.value)}
                  className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="night">Night</option>
                </select>
              </div>
              <button
                onClick={handleAddShift}
                disabled={!newShiftDate || !newShiftStart || !newShiftEnd}
                className="w-full py-3 bg-secondary text-primary-dark font-semibold rounded-lg disabled:opacity-50"
              >
                Add Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
