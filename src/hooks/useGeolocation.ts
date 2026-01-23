import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  isLoading: boolean;
}

interface GeofenceSettings {
  latitude: number;
  longitude: number;
  radius_km: number;
  is_enabled: boolean;
}

// Haversine formula to calculate distance between two points
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const useGeolocation = () => {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    isLoading: false,
  });

  const getCurrentPosition = useCallback((highAccuracy: boolean = true): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: highAccuracy,
        timeout: 30000, // Increased timeout to 30 seconds
        maximumAge: 60000, // Allow cached position up to 1 minute old
      });
    });
  }, []);

  const getLocation = useCallback(async (): Promise<{ latitude: number; longitude: number } | null> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // First try with high accuracy
      let position: GeolocationPosition;
      try {
        position = await getCurrentPosition(true);
      } catch (highAccuracyError: any) {
        // If high accuracy fails with timeout, try with lower accuracy
        if (highAccuracyError.code === 3) {
          console.log('High accuracy timed out, trying lower accuracy...');
          position = await getCurrentPosition(false);
        } else {
          throw highAccuracyError;
        }
      }
      
      const { latitude, longitude } = position.coords;
      setState({
        latitude,
        longitude,
        error: null,
        isLoading: false,
      });
      return { latitude, longitude };
    } catch (error: any) {
      let errorMessage = 'Unable to get your location';
      if (error.code === 1) {
        errorMessage = 'Location access denied. Please enable location services in your browser and system settings.';
      } else if (error.code === 2) {
        errorMessage = 'Location unavailable. Please check your device location settings and try again.';
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out. Please check your connection and try again.';
      }
      console.error('Geolocation error:', error.code, error.message);
      setState({
        latitude: null,
        longitude: null,
        error: errorMessage,
        isLoading: false,
      });
      return null;
    }
  }, [getCurrentPosition]);

  const checkGeofence = useCallback(
    async (
      userLat: number,
      userLon: number
    ): Promise<{ allowed: boolean; distance: number; settings: GeofenceSettings | null }> => {
      try {
        // Get geofence settings using the security definer function
        const { data, error } = await supabase.rpc('get_geofence_settings');

        if (error) {
          console.error('Error fetching geofence settings:', error);
          // If no settings, allow login (geofence not configured)
          return { allowed: true, distance: 0, settings: null };
        }

        if (!data || data.length === 0) {
          // No geofence configured, allow login
          return { allowed: true, distance: 0, settings: null };
        }

        const settings = data[0] as GeofenceSettings;

        if (!settings.is_enabled) {
          // Geofence disabled, allow login
          return { allowed: true, distance: 0, settings };
        }

        const distance = calculateDistance(
          userLat,
          userLon,
          Number(settings.latitude),
          Number(settings.longitude)
        );

        return {
          allowed: distance <= Number(settings.radius_km),
          distance: Math.round(distance * 100) / 100,
          settings,
        };
      } catch (error) {
        console.error('Error checking geofence:', error);
        // On error, allow login to prevent blocking legitimate users
        return { allowed: true, distance: 0, settings: null };
      }
    },
    []
  );

  const checkUserIsSuperadmin = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('is_user_superadmin', { _user_id: userId });
      if (error) {
        console.error('Error checking superadmin status:', error);
        return false;
      }
      return data === true;
    } catch (error) {
      console.error('Error checking superadmin status:', error);
      return false;
    }
  }, []);

  return {
    ...state,
    getLocation,
    checkGeofence,
    checkUserIsSuperadmin,
    calculateDistance,
  };
};
