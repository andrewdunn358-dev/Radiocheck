/**
 * Location Permission Context
 * 
 * Provides location permission state and a requestLocation function.
 * Location permission is requested during the initial app permission flow (index.tsx).
 * This context provides the ability to request and use location for safeguarding alerts.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LocationPermissionContextType {
  hasLocationPermission: boolean;
  locationCoords: { lat: number; lon: number; accuracy: number } | null;
  requestLocation: () => Promise<{ lat: number; lon: number; accuracy: number } | null>;
  permissionStatus: 'unknown' | 'granted' | 'denied' | 'prompt';
}

const LocationPermissionContext = createContext<LocationPermissionContextType>({
  hasLocationPermission: false,
  locationCoords: null,
  requestLocation: async () => null,
  permissionStatus: 'unknown',
});

export const useLocationPermission = () => useContext(LocationPermissionContext);

const LOCATION_PERMISSION_KEY = 'location_permission_asked';
const LOCATION_COORDS_KEY = 'last_known_location';

interface LocationPermissionProviderProps {
  children: ReactNode;
}

export function LocationPermissionProvider({ children }: LocationPermissionProviderProps) {
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number; accuracy: number } | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');

  // Check if we've already asked for permission
  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = async () => {
    // Only works on web
    if (Platform.OS !== 'web') {
      setPermissionStatus('unknown');
      return;
    }

    try {
      // Check if we've asked before
      const hasAsked = await AsyncStorage.getItem(LOCATION_PERMISSION_KEY);
      
      // Check actual browser permission status
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        
        if (result.state === 'granted') {
          setPermissionStatus('granted');
          setHasLocationPermission(true);
          // Get current location silently
          getCurrentLocation();
        } else if (result.state === 'denied') {
          setPermissionStatus('denied');
          setHasLocationPermission(false);
        } else {
          // Permission is in 'prompt' state - don't show modal automatically
          // Location will be requested when user triggers a safeguarding alert
          setPermissionStatus('prompt');
        }
        
        // Listen for permission changes
        result.addEventListener('change', () => {
          if (result.state === 'granted') {
            setPermissionStatus('granted');
            setHasLocationPermission(true);
            getCurrentLocation();
          } else if (result.state === 'denied') {
            setPermissionStatus('denied');
            setHasLocationPermission(false);
          }
        });
      }
    } catch (error) {
      console.log('Error checking location permission:', error);
    }
  };

  const getCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLocationCoords(coords);
        setHasLocationPermission(true);
        // Cache the location
        await AsyncStorage.setItem(LOCATION_COORDS_KEY, JSON.stringify(coords));
      },
      (error) => {
        console.log('Geolocation error:', error.message);
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionStatus('denied');
          setHasLocationPermission(false);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  const requestLocation = async (): Promise<{ lat: number; lon: number; accuracy: number } | null> => {
    if (Platform.OS !== 'web') return null;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setLocationCoords(coords);
          setHasLocationPermission(true);
          setPermissionStatus('granted');
          await AsyncStorage.setItem(LOCATION_COORDS_KEY, JSON.stringify(coords));
          resolve(coords);
        },
        (error) => {
          console.log('Geolocation request error:', error.message);
          if (error.code === error.PERMISSION_DENIED) {
            setPermissionStatus('denied');
            setHasLocationPermission(false);
          }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  return (
    <LocationPermissionContext.Provider
      value={{
        hasLocationPermission,
        locationCoords,
        requestLocation,
        permissionStatus,
      }}
    >
      {children}
    </LocationPermissionContext.Provider>
  );
}

export default LocationPermissionProvider;
