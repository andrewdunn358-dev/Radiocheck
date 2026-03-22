'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, X, Calendar, Clock } from 'lucide-react';
import { api } from '@/lib/admin-api';

interface EventsTabProps {
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function EventsTab({ token, onSuccess, onError }: EventsTabProps) {
  // Data state
  const [events, setEvents] = useState<any[]>([]);
  
  // Modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [showViewAttendanceModal, setShowViewAttendanceModal] = useState(false);
  const [eventAttendance, setEventAttendance] = useState<any[]>([]);
  const [attendanceEventTitle, setAttendanceEventTitle] = useState('');
  
  // Form state
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_date: new Date().toISOString().split('T')[0],
    event_time: '14:00',
    duration_minutes: 60,
    host_name: '',
    max_participants: 20,
  });

  const loadEvents = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getEvents(token).catch(() => []);
      setEvents(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Events not available:', err);
    }
  }, [token]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const eventData = {
        title: newEvent.title,
        description: newEvent.description,
        event_date: `${newEvent.event_date}T${newEvent.event_time}:00`,
        duration_minutes: newEvent.duration_minutes,
        host_name: newEvent.host_name,
        max_participants: newEvent.max_participants,
      };
      if (editingEvent) {
        await api.updateEvent(token, editingEvent.id, eventData);
        onSuccess('Event updated successfully');
      } else {
        await api.createEvent(token, eventData);
        onSuccess('Event created successfully');
      }
      setShowEventModal(false);
      setEditingEvent(null);
      setNewEvent({ title: '', description: '', event_date: new Date().toISOString().split('T')[0], event_time: '14:00', duration_minutes: 60, host_name: '', max_participants: 20 });
      loadEvents();
    } catch (err: any) {
      onError('Failed to ' + (editingEvent ? 'update' : 'create') + ' event: ' + err.message);
    }
  };

  const handleViewAttendance = async (event: any) => {
    try {
      const attendance = await api.getEventAttendance(token, event.id);
      setEventAttendance(attendance || []);
      setAttendanceEventTitle(event.title);
      setShowViewAttendanceModal(true);
    } catch (err: any) {
      onError('Failed to load attendance: ' + err.message);
    }
  };

  const handleEditEvent = (event: any) => {
    const eventDate = new Date(event.scheduled_for || event.event_date);
    setNewEvent({
      title: event.title || '',
      description: event.description || '',
      event_date: eventDate.toISOString().split('T')[0],
      event_time: eventDate.toTimeString().slice(0, 5),
      duration_minutes: event.duration_minutes || 60,
      host_name: event.host_name || '',
      max_participants: event.max_participants || 20,
    });
    setEditingEvent(event);
    setShowEventModal(true);
  };

  const handleDeleteEvent = async (event: any) => {
    if (!token || !confirm('Cancel this event?')) return;
    try {
      await api.deleteEvent(token, event.id);
      onSuccess('Event cancelled');
      loadEvents();
    } catch (err: any) {
      onError('Failed to cancel: ' + err.message);
    }
  };

  return (
    <div data-testid="events-tab">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Events Management</h2>
        <div className="flex gap-2">
          <button onClick={loadEvents} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
            <RefreshCw className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowEventModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Event
          </button>
        </div>
      </div>

      {/* Create/Edit Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editingEvent ? 'Edit Event' : 'Create New Event'}</h3>
              <button onClick={() => { setShowEventModal(false); setEditingEvent(null); }} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitEvent}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Title</label>
                  <input
                    type="text"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white h-20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Date</label>
                    <input
                      type="date"
                      value={newEvent.event_date}
                      onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Time</label>
                    <input
                      type="time"
                      value={newEvent.event_time}
                      onChange={(e) => setNewEvent({ ...newEvent, event_time: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Duration (mins)</label>
                    <input
                      type="number"
                      value={newEvent.duration_minutes}
                      onChange={(e) => setNewEvent({ ...newEvent, duration_minutes: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Max Participants</label>
                    <input
                      type="number"
                      value={newEvent.max_participants}
                      onChange={(e) => setNewEvent({ ...newEvent, max_participants: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Host Name</label>
                  <input
                    type="text"
                    value={newEvent.host_name}
                    onChange={(e) => setNewEvent({ ...newEvent, host_name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => { setShowEventModal(false); setEditingEvent(null); }} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg">
                  {editingEvent ? 'Save Changes' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Upcoming Events
          </h3>
          {events.filter(e => new Date(e.scheduled_for || e.event_date) > new Date()).length === 0 ? (
            <p className="text-gray-400 text-center py-8">No upcoming events scheduled</p>
          ) : (
            <div className="space-y-3">
              {events
                .filter(e => new Date(e.scheduled_for || e.event_date) > new Date())
                .sort((a, b) => new Date(a.scheduled_for || a.event_date).getTime() - new Date(b.scheduled_for || b.event_date).getTime())
                .slice(0, 5)
                .map((event) => (
                  <div key={event.id} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium">{event.title}</h4>
                      <span className={`px-2 py-1 rounded text-xs ${
                        event.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                        event.status === 'live' ? 'bg-green-500/20 text-green-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {event.status || 'scheduled'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{event.description?.substring(0, 60)}...</p>
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-gray-400">
                        {new Date(event.scheduled_for || event.event_date).toLocaleDateString()} at {new Date(event.scheduled_for || event.event_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-blue-400">{event.participant_count || 0}/{event.max_participants || '∞'}</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button 
                        onClick={() => handleEditEvent(event)}
                        className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded text-xs"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleViewAttendance(event)}
                        className="px-2 py-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded text-xs"
                      >
                        Attendance
                      </button>
                      <button 
                        onClick={() => handleDeleteEvent(event)}
                        className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Past Events */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            Recent Events
          </h3>
          {events.filter(e => new Date(e.scheduled_for || e.event_date) <= new Date()).length === 0 ? (
            <p className="text-gray-400 text-center py-8">No past events</p>
          ) : (
            <div className="space-y-3">
              {events
                .filter(e => new Date(e.scheduled_for || e.event_date) <= new Date())
                .sort((a, b) => new Date(b.scheduled_for || b.event_date).getTime() - new Date(a.scheduled_for || a.event_date).getTime())
                .slice(0, 5)
                .map((event) => (
                  <div key={event.id} className="bg-gray-700 rounded-lg p-4 opacity-75">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium">{event.title}</h4>
                      <span className="text-xs text-gray-400">{event.participant_count || 0} attended</span>
                    </div>
                    <p className="text-sm text-gray-400">
                      {new Date(event.scheduled_for || event.event_date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* View Attendance Modal */}
      {showViewAttendanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Attendance: {attendanceEventTitle}</h3>
              <button 
                onClick={() => { setShowViewAttendanceModal(false); setEventAttendance([]); setAttendanceEventTitle(''); }} 
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {eventAttendance.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No attendees registered yet</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-gray-800">
                    <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Email</th>
                      <th className="py-2 px-3">Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventAttendance.map((attendee: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-700 text-sm">
                        <td className="py-2 px-3">{attendee.name || attendee.user_name || 'Anonymous'}</td>
                        <td className="py-2 px-3 text-gray-400">{attendee.email || '-'}</td>
                        <td className="py-2 px-3 text-gray-400">
                          {attendee.registered_at ? new Date(attendee.registered_at).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button 
                onClick={() => { setShowViewAttendanceModal(false); setEventAttendance([]); setAttendanceEventTitle(''); }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
