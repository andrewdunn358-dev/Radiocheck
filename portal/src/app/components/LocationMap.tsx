'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LocationData {
  recent_locations?: Array<{
    lat: number;
    lon: number;
    city?: string;
    country?: string;
    visits: number;
  }>;
  active_users_with_location?: Array<{
    geo_lat: number;
    geo_lon: number;
    geo_city?: string;
    geo_country?: string;
    device?: string;
  }>;
  active_count?: number;
  countries?: Array<{
    country: string;
    visits: number;
  }>;
  cities?: Array<{
    city: string;
    country: string;
    visits: number;
  }>;
  uk_regions?: Record<string, number>;
}

interface LocationMapProps {
  data: LocationData | null;
}

export default function LocationMap({ data }: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map if not already done
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        center: [54.5, -2], // Center on UK
        zoom: 6,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(mapInstanceRef.current);

      // Force resize after init
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 250);
    }

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current?.removeLayer(marker);
    });
    markersRef.current = [];

    if (!data) return;

    // Add blue markers for recent locations
    if (data.recent_locations && data.recent_locations.length > 0) {
      data.recent_locations.forEach(loc => {
        if (loc.lat && loc.lon) {
          const marker = L.circleMarker([loc.lat, loc.lon], {
            radius: Math.min(5 + loc.visits * 2, 20),
            fillColor: '#3b82f6',
            color: '#1d4ed8',
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.5,
          }).addTo(mapInstanceRef.current!);

          marker.bindPopup(
            `<strong>${loc.city || 'Unknown'}</strong>${loc.country ? ', ' + loc.country : ''}<br><span style="color: #666;">${loc.visits} visits (24h)</span>`
          );
          markersRef.current.push(marker);
        }
      });
    }

    // Add green markers for active users
    if (data.active_users_with_location && data.active_users_with_location.length > 0) {
      data.active_users_with_location.forEach(user => {
        if (user.geo_lat && user.geo_lon) {
          const marker = L.circleMarker([user.geo_lat, user.geo_lon], {
            radius: 10,
            fillColor: '#22c55e',
            color: '#15803d',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.8,
          }).addTo(mapInstanceRef.current!);

          marker.bindPopup(
            `<strong style="color: #22c55e;">Active Now</strong><br>${user.geo_city || 'Unknown'}${user.geo_country ? ', ' + user.geo_country : ''}<br><span style="color: #666;">${user.device || 'Unknown device'}</span>`
          );
          markersRef.current.push(marker);
        }
      });
    }

    // Fit bounds if we have markers
    if (markersRef.current.length > 0) {
      const group = L.featureGroup(markersRef.current);
      mapInstanceRef.current?.fitBounds(group.getBounds().pad(0.1));
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [data]);

  const flagEmoji: Record<string, string> = {
    'United Kingdom': '🇬🇧',
    'United States': '🇺🇸',
    'Ireland': '🇮🇪',
    'Germany': '🇩🇪',
    'France': '🇫🇷',
    'Canada': '🇨🇦',
    'Australia': '🇦🇺',
    'Netherlands': '🇳🇱',
    'Spain': '🇪🇸',
    'Italy': '🇮🇹',
  };

  const regionIcons: Record<string, string> = {
    england: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    wales: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
    northern_ireland: '☘️',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Map */}
      <div className="lg:col-span-2 bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-medium text-blue-400">📍 Visitor Locations</h4>
          <span className="text-green-400 text-sm font-medium">
            {data?.active_count || 0} active
          </span>
        </div>
        <div 
          ref={mapRef} 
          className="h-64 rounded-lg overflow-hidden"
          style={{ background: '#1f2937' }}
        />
        <div className="flex gap-4 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span> Recent (24h)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500"></span> Active Now
          </span>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="space-y-4">
        {/* Country Breakdown */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h4 className="font-medium text-purple-400 mb-3">🌍 By Country</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {data?.countries && data.countries.length > 0 ? (
              data.countries.slice(0, 5).map((c) => (
                <div key={c.country} className="flex justify-between items-center bg-gray-700 p-2 rounded text-sm">
                  <span>{flagEmoji[c.country] || '🌍'} {c.country}</span>
                  <strong>{c.visits}</strong>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No country data</p>
            )}
          </div>
        </div>

        {/* UK Regions */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h4 className="font-medium text-red-400 mb-3">🇬🇧 UK Regions</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {data?.uk_regions && Object.keys(data.uk_regions).length > 0 ? (
              (Array.isArray(data.uk_regions)
                ? data.uk_regions
                : Object.entries(data.uk_regions).map(([region, val]: [string, any]) => ({
                    region,
                    visits: typeof val === 'number' ? val : (val?.visits || val?.count || 0)
                  }))
              ).map((item: any, idx: number) => {
                const regionName = String(item.region || item.name || '');
                const visitCount = Number(item.visits || item.unique || item.count || 0);
                return (
                  <div key={idx} className="flex justify-between items-center bg-gray-700 p-2 rounded text-sm">
                    <span>{regionIcons[regionName] || '📍'} {regionName.replace('_', ' ')}</span>
                    <strong>{visitCount}</strong>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500 text-sm">No UK region data</p>
            )}
          </div>
        </div>

        {/* Top Cities */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h4 className="font-medium text-cyan-400 mb-3">🏙️ Top Cities</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {data?.cities && data.cities.length > 0 ? (
              data.cities.slice(0, 5).map((c) => (
                <div key={`${c.city}-${c.country}`} className="flex justify-between items-center bg-gray-700 p-2 rounded text-sm">
                  <span>{c.city}</span>
                  <strong>{c.visits}</strong>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No city data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
