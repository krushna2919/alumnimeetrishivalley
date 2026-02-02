/**
 * useGeolocation.ts - Geolocation and Geofencing Hook
 * 
 * Provides location-based functionality for the admin panel:
 * 1. Get user's current GPS coordinates
 * 2. Check if user is within allowed geofence radius
 * 3. Verify superadmin status for geofence bypass
 * 
 * Use Cases:
 * - Restricting admin access to specific geographic locations
 * - Location-based security for sensitive operations
 * - Tracking admin login locations
 * 
 * Geofencing Logic:
 * - Admin configures a center point (lat/lng) and radius
 * - Users must be within radius to access admin features
 * - Superadmins can bypass geofencing restrictions
 * 
 * @example
 * ```tsx
 * const { getLocation, checkGeofence } = useGeolocation();
 * 
 * const location = await getLocation();
 * if (location) {
 *   const { allowed, distance } = await checkGeofence(location.latitude, location.longitude);
 *   if (!allowed) {
 *     showError(`You are ${distance}km from the allowed area`);
 *   }
 * }
 * ```
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * State interface for geolocation
 */
interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  isLoading: boolean;
}

/**
 * Geofence settings from database
 */
interface GeofenceSettings {
  latitude: number;
  longitude: number;
  radius_km: number;
  is_enabled: boolean;
}

/**
 * Haversine formula implementation
 * Calculates the great-circle distance between two points on Earth
 * 
 * @param lat1 - Latitude of first point in degrees
 * @param lon1 - Longitude of first point in degrees
 * @param lat2 - Latitude of second point in degrees
 * @param lon2 - Longitude of second point in degrees
 * @returns Distance in kilometers
 */
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  
  // Convert degrees to radians
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  
  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
};

/**
 * useGeolocation Hook
 * 
 * Provides geolocation and geofencing functionality
 * 
 * @returns Object with:
 * - latitude, longitude: Current coordinates (or null)
 * - error: Error message (or null)
 * - isLoading: True while getting location
 * - getLocation: Function to request user's location
 * - checkGeofence: Function to verify against geofence settings
 * - checkUserIsSuperadmin: Function to check if user can bypass geofence
 * - isGeofencingEnabled: Function to check if geofencing is active
 * - calculateDistance: Utility function for distance calculations
 */
export const useGeolocation = () => {
  // State for current location
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    isLoading: false,
  });

  /**
   * Gets current position from browser Geolocation API
   * 
   * @param highAccuracy - Whether to use high accuracy mode (GPS vs network)
   * @returns Promise that resolves with GeolocationPosition
   */
  const getCurrentPosition = useCallback((highAccuracy: boolean = true): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      // Request position with options
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: highAccuracy,
        timeout: 30000, // 30 second timeout
        maximumAge: 60000, // Allow cached position up to 1 minute old
      });
    });
  }, []);

  /**
   * Gets the user's current location
   * Tries high accuracy first, falls back to lower accuracy on timeout
   * 
   * @returns Object with latitude/longitude, or null on error
   */
  const getLocation = useCallback(async (): Promise<{ latitude: number; longitude: number } | null> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      let position: GeolocationPosition;
      
      try {
        // First try with high accuracy (GPS)
        position = await getCurrentPosition(true);
      } catch (highAccuracyError: any) {
        // If high accuracy fails with timeout, try with lower accuracy (network)
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
      // Map error codes to user-friendly messages
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

  /**
   * Checks if user's location is within the configured geofence
   * 
   * @param userLat - User's latitude
   * @param userLon - User's longitude
   * @returns Object with allowed status, distance, and settings
   */
  const checkGeofence = useCallback(
    async (
      userLat: number,
      userLon: number
    ): Promise<{ allowed: boolean; distance: number; settings: GeofenceSettings | null }> => {
      try {
        // Get geofence settings using the security definer function
        // This bypasses RLS to allow checking before full authentication
        const { data, error } = await supabase.rpc('get_geofence_settings');

        if (error) {
          console.error('Error fetching geofence settings:', error);
          // On error, allow login to prevent blocking legitimate users
          return { allowed: true, distance: 0, settings: null };
        }

        if (!data || data.length === 0) {
          // No geofence configured, allow login
          return { allowed: true, distance: 0, settings: null };
        }

        const settings = data[0] as GeofenceSettings;

        if (!settings.is_enabled) {
          // Geofence disabled by admin, allow login
          return { allowed: true, distance: 0, settings };
        }

        // Calculate distance between user and geofence center
        const distance = calculateDistance(
          userLat,
          userLon,
          Number(settings.latitude),
          Number(settings.longitude)
        );

        return {
          allowed: distance <= Number(settings.radius_km),
          distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
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

  /**
   * Checks if a user has superadmin role
   * Superadmins can bypass geofencing restrictions
   * 
   * @param userId - User ID to check
   * @returns True if user is superadmin
   */
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

  /**
   * Checks if geofencing is enabled globally
   * 
   * @returns True if geofencing is enabled and configured
   */
  const isGeofencingEnabled = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('get_geofence_settings');
      
      if (error) {
        console.error('Error fetching geofence settings:', error);
        return false;
      }

      if (!data || data.length === 0) {
        return false;
      }

      return data[0].is_enabled === true;
    } catch (error) {
      console.error('Error checking geofence status:', error);
      return false;
    }
  }, []);

  return {
    ...state,
    getLocation,
    checkGeofence,
    checkUserIsSuperadmin,
    isGeofencingEnabled,
    calculateDistance,
  };
};
