'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Video, MapPin, Users, RefreshCw } from 'lucide-react';
import { staffApi } from '@/lib/api';
import dynamic from 'next/dynamic';

// Dynamically import AgoraRoom to avoid SSR issues
const AgoraRoom = dynamic(() => import('@/components/shared/AgoraRoom'), { ssr: false });

interface EventsTabProps {
  token: string;
  userName?: string;
}

type EventType = 'in-person' | 'virtual' | 'hybrid';

export default function EventsTab({ token, userName }: EventsTabProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [activeVideoEvent, setActiveVideoEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Use staff API to get events - may need to add this endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://veterans-support-api.onrender.com'}/api/events`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setEvents(Array.isArray(data) ? data : data.events || []);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Check if event is currently live
  const isEventLive = (event: any) => {
    const eventDate = new Date(event.scheduled_for || event.event_date);
    const now = new Date();
    const endTime = new Date(eventDate.getTime() + (event.duration_minutes || 60) * 60000);
    return now >= eventDate && now <= endTime;
  };

  // Check if event supports virtual attendance
  const isVirtualEvent = (event: any) => {
    const eventType = event.event_type || 'in-person';
    return eventType === 'virtual' || eventType === 'hybrid';
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

  const handleJoinEvent = (event: any) => {
    setActiveVideoEvent(event);
  };

  // Filter to upcoming and live events
  const upcomingEvents = events.filter(e => {
    const eventDate = new Date(e.scheduled_for || e.event_date);
    const endTime = new Date(eventDate.getTime() + (e.duration_minutes || 60) * 60000);
    return new Date() <= endTime;
  }).sort((a, b) => new Date(a.scheduled_for || a.event_date).getTime() - new Date(b.scheduled_for || b.event_date).getTime());

  return (
    <div data-testid="staff-events-tab">
      {/* Agora Room Modal */}
      {activeVideoEvent && (
        <AgoraRoom
          roomName={`event_${activeVideoEvent.id}`}
          displayName={userName || 'Staff'}
          eventTitle={activeVideoEvent.title}
          onClose={() => setActiveVideoEvent(null)}
        />
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-6 h-6 text-secondary" />
          Community Events
        </h1>
        <button onClick={loadEvents} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-white/5">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-secondary mx-auto"></div>
        </div>
      ) : upcomingEvents.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No upcoming events</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {upcomingEvents.map((event) => {
            const eventType = event.event_type || 'in-person';
            const isLive = isEventLive(event);
            const canJoinVirtually = isVirtualEvent(event);
            const eventDate = new Date(event.scheduled_for || event.event_date);

            return (
              <div 
                key={event.id} 
                className={`bg-card border rounded-xl p-5 ${isLive ? 'border-green-500 ring-1 ring-green-500/30' : 'border-border'}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold">{event.title}</h3>
                  <div className="flex items-center gap-2">
                    {isLive && (
                      <span className="px-2 py-0.5 rounded text-xs bg-green-500 text-white animate-pulse flex items-center gap-1">
                        <span className="w-2 h-2 bg-white rounded-full"></span>
                        LIVE
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  {getEventTypeBadge(eventType)}
                </div>

                {event.description && (
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">{event.description}</p>
                )}

                <div className="space-y-2 text-sm text-gray-400 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>
                      {eventDate.toLocaleDateString()} at {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  {event.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{event.location}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{event.participant_count || 0} / {event.max_participants || '∞'} participants</span>
                  </div>

                  {event.host_name && (
                    <div className="text-xs">
                      Hosted by: {event.host_name}
                    </div>
                  )}
                </div>

                {/* Join button for virtual events */}
                {canJoinVirtually && (
                  <button 
                    onClick={() => handleJoinEvent(event)}
                    className={`w-full px-4 py-2.5 ${isLive ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'} text-white rounded-lg font-medium flex items-center justify-center gap-2 transition`}
                    data-testid={`staff-join-event-${event.id}`}
                  >
                    <Video className="w-4 h-4" />
                    {isLive ? 'Join Now' : 'Join Event'}
                  </button>
                )}

                {/* Info for non-virtual events */}
                {!isVirtualEvent(event) && !isLive && (
                  <div className="w-full px-4 py-2.5 bg-gray-600/20 text-gray-400 rounded-lg text-sm text-center">
                    In-person event
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
