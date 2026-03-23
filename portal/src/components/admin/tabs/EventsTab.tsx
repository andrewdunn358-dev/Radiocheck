'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, X, Calendar, Clock, Video, MapPin, Users } from 'lucide-react';
import { api } from '@/lib/admin-api';
import dynamic from 'next/dynamic';

// Dynamically import AgoraRoom to avoid SSR issues
const AgoraRoom = dynamic(() => import('@/components/shared/AgoraRoom'), { ssr: false });

interface EventsTabProps {
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  userName?: string;
}

type EventType = 'in-person' | 'virtual' | 'hybrid';

export default function EventsTab({ token, onSuccess, onError, userName }: EventsTabProps) {
  // Data state
  const [events, setEvents] = useState<any[]>([]);
  
  // Modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [showViewAttendanceModal, setShowViewAttendanceModal] = useState(false);
  const [eventAttendance, setEventAttendance] = useState<any[]>([]);
  const [attendanceEventTitle, setAttendanceEventTitle] = useState('');
  
  // Jitsi state
  const [activeJitsiEvent, setActiveJitsiEvent] = useState<any>(null);
  
  // Form state
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_date: new Date().toISOString().split('T')[0],
    event_time: '14:00',
    duration_minutes: 60,
    host_name: '',
    max_participants: 20,
    event_type: 'in-person' as EventType,
    location: '',
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

  // Check if event is currently live (within its scheduled time + duration)
  const isEventLive = (event: any) => {
    const eventDate = new Date(event.scheduled_for || event.event_date);
    const now = new Date();
    const endTime = new Date(eventDate.getTime() + (event.duration_minutes || 60) * 60000);
    return now >= eventDate && now <= endTime;
  };

  // Check if event is upcoming (not started yet)
  const isEventUpcoming = (event: any) => {
    const eventDate = new Date(event.scheduled_for || event.event_date);
    return new Date() < eventDate;
  };

  // Check if event supports virtual attendance
  const isVirtualEvent = (event: any) => {
    const eventType = event.event_type || 'in-person';
    return eventType === 'virtual' || eventType === 'hybrid';
  };

  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    // Validate required fields
    if (!newEvent.title.trim()) {
      onError('Title is required');
      return;
    }
    if (!newEvent.host_name.trim()) {
      onError('Host name is required');
      return;
    }
    
    try {
      // Create ISO date string with timezone
      const dateTimeString = `${newEvent.event_date}T${newEvent.event_time}:00`;
      const eventDateTime = new Date(dateTimeString);
      
      const eventData = {
        title: newEvent.title.trim(),
        description: newEvent.description?.trim() || null,
        event_date: eventDateTime.toISOString(),
        duration_minutes: newEvent.duration_minutes,
        host_name: newEvent.host_name.trim(),
        max_participants: newEvent.max_participants || null,
        event_type: newEvent.event_type,
        location: newEvent.location?.trim() || null,
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
      setNewEvent({ 
        title: '', description: '', 
        event_date: new Date().toISOString().split('T')[0], 
        event_time: '14:00', duration_minutes: 60, 
        host_name: '', max_participants: 20,
        event_type: 'in-person',
        location: '',
      });
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
      event_type: event.event_type || 'in-person',
      location: event.location || '',
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

  const handleJoinEvent = (event: any) => {
    setActiveJitsiEvent(event);
  };

  const getEventTypeBadge = (eventType: EventType) => {
    switch (eventType) {
      case 'virtual':
        return <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400 flex items-center gap-1"><Video className="w-3 h-3" /> Virtual</span>;
      case 'hybrid':
        return <span className="px-2 py-0.5 rounded text-xs bg-indigo-500/20 text-indigo-400 flex items-center gap-1"><Video className="w-3 h-3" /> Hybrid</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> In-Person</span>;
    }
  };

  // Render event card
  const renderEventCard = (event: any, isPast: boolean = false) => {
    const eventType = event.event_type || 'in-person';
    const isLive = isEventLive(event);
    const isUpcoming = isEventUpcoming(event);
    const canJoinVirtually = isVirtualEvent(event) && isLive;

    return (
      <div key={event.id} className={`bg-gray-700 rounded-lg p-4 ${isPast ? 'opacity-75' : ''} ${isLive ? 'ring-2 ring-green-500' : ''}`}>
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-medium">{event.title}</h4>
          <div className="flex items-center gap-2">
            {getEventTypeBadge(eventType)}
            {isLive && (
              <span className="px-2 py-0.5 rounded text-xs bg-green-500 text-white animate-pulse flex items-center gap-1">
                <span className="w-2 h-2 bg-white rounded-full"></span>
                LIVE
              </span>
            )}
            {!isLive && !isPast && (
              <span className={`px-2 py-1 rounded text-xs ${
                event.status === 'cancelled' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
              }`}>
                {event.status || 'scheduled'}
              </span>
            )}
          </div>
        </div>
        
        <p className="text-sm text-gray-400 mb-2">{event.description?.substring(0, 60)}{event.description?.length > 60 ? '...' : ''}</p>
        
        {event.location && (
          <div className="flex items-center gap-1 text-sm text-gray-400 mb-2">
            <MapPin className="w-3 h-3" />
            <span>{event.location}</span>
          </div>
        )}
        
        <div className="flex justify-between items-center text-sm mb-2">
          <span className="text-gray-400">
            {new Date(event.scheduled_for || event.event_date).toLocaleDateString()} at {new Date(event.scheduled_for || event.event_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-blue-400 flex items-center gap-1">
            <Users className="w-3 h-3" />
            {event.participant_count || 0}/{event.max_participants || '∞'}
          </span>
        </div>
        
        <div className="flex gap-2 mt-3 flex-wrap">
          {/* Join button for live virtual/hybrid events */}
          {canJoinVirtually && (
            <button 
              onClick={() => handleJoinEvent(event)}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium flex items-center gap-1"
            >
              <Video className="w-3 h-3" />
              Join Now
            </button>
          )}
          
          {/* Show reminder for upcoming virtual events */}
          {isVirtualEvent(event) && isUpcoming && (
            <span className="px-3 py-1.5 bg-purple-600/20 text-purple-400 rounded text-xs flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Starting {new Date(event.scheduled_for || event.event_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          
          {!isPast && (
            <>
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
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div data-testid="events-tab">
      {/* Agora Room Modal */}
      {activeJitsiEvent && (
        <AgoraRoom
          roomName={`event_${activeJitsiEvent.id}`}
          displayName={userName || 'Admin'}
          eventTitle={activeJitsiEvent.title}
          onClose={() => setActiveJitsiEvent(null)}
        />
      )}

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
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto">
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

                {/* Event Type Selector */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Event Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'in-person', label: 'In-Person', icon: MapPin },
                      { value: 'virtual', label: 'Virtual', icon: Video },
                      { value: 'hybrid', label: 'Hybrid', icon: Users },
                    ].map((type) => {
                      const Icon = type.icon;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setNewEvent({ ...newEvent, event_type: type.value as EventType })}
                          className={`p-3 rounded-lg border transition flex flex-col items-center gap-1 ${
                            newEvent.event_type === type.value
                              ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                              : 'border-gray-600 bg-gray-700 text-gray-400 hover:border-gray-500'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-xs">{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Location field - shown for in-person and hybrid events */}
                {(newEvent.event_type === 'in-person' || newEvent.event_type === 'hybrid') && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Location</label>
                    <input
                      type="text"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      placeholder="Enter venue address"
                    />
                  </div>
                )}

                {/* Virtual event info */}
                {(newEvent.event_type === 'virtual' || newEvent.event_type === 'hybrid') && (
                  <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-purple-400 text-sm">
                      <Video className="w-4 h-4" />
                      <span>Virtual access via Jitsi Meet - no account needed</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Participants can join instantly when the event goes live.
                    </p>
                  </div>
                )}

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
          {events.filter(e => new Date(e.scheduled_for || e.event_date) > new Date() || isEventLive(e)).length === 0 ? (
            <p className="text-gray-400 text-center py-8">No upcoming events scheduled</p>
          ) : (
            <div className="space-y-3">
              {events
                .filter(e => new Date(e.scheduled_for || e.event_date) > new Date() || isEventLive(e))
                .sort((a, b) => new Date(a.scheduled_for || a.event_date).getTime() - new Date(b.scheduled_for || b.event_date).getTime())
                .slice(0, 5)
                .map((event) => renderEventCard(event, false))}
            </div>
          )}
        </div>

        {/* Past Events */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            Recent Events
          </h3>
          {events.filter(e => new Date(e.scheduled_for || e.event_date) <= new Date() && !isEventLive(e)).length === 0 ? (
            <p className="text-gray-400 text-center py-8">No past events</p>
          ) : (
            <div className="space-y-3">
              {events
                .filter(e => new Date(e.scheduled_for || e.event_date) <= new Date() && !isEventLive(e))
                .sort((a, b) => new Date(b.scheduled_for || b.event_date).getTime() - new Date(a.scheduled_for || a.event_date).getTime())
                .slice(0, 5)
                .map((event) => (
                  <div key={event.id} className="bg-gray-700 rounded-lg p-4 opacity-75">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium">{event.title}</h4>
                      <div className="flex items-center gap-2">
                        {getEventTypeBadge(event.event_type || 'in-person')}
                        <span className="text-xs text-gray-400">{event.participant_count || 0} attended</span>
                      </div>
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
