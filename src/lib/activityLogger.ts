/**
 * activityLogger.ts - Admin Activity and Device Session Tracking
 * 
 * Provides logging utilities for tracking admin actions and user device sessions.
 * This module supports the Admin Activity Dashboard feature.
 * 
 * Two Main Functions:
 * 
 * 1. logAdminActivity - Records admin actions (approvals, rejections, etc.)
 *    - Stores in admin_activity_logs table
 *    - Links to target registration/application
 *    - Includes action details as JSON
 * 
 * 2. trackDeviceSession - Records device/browser information for login monitoring
 *    - Stores in user_device_sessions table
 *    - Uses upsert with unique constraint to prevent duplicates
 *    - Supports geolocation for location tracking
 * 
 * Security Note:
 * All logging is done server-side with authenticated users only.
 * Device tracking includes user agent parsing for detailed metadata.
 */

import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

/**
 * Types of admin actions that can be logged
 * Each action type represents a specific administrative operation
 */
export type AdminActionType = 
  | 'account_approval'      // Approved a user account/role
  | 'account_rejection'     // Rejected a user account/role
  | 'receipt_upload'        // Uploaded a payment receipt
  | 'registration_approval' // Approved a registration
  | 'registration_rejection'// Rejected a registration
  | 'resend_approval_email' // Resent approval notification email
  | 'bed_assignment'        // Assigned a bed to a registrant
  | 'bed_unassignment'      // Removed bed assignment
  | 'edit_mode_enabled'     // Superadmin enabled edit mode for a registration
  | 'edit_mode_proof_upload'// Accounts admin uploaded new proof in edit mode
  | 'edit_mode_final_approval'; // Admin final approval after edit mode changes

/**
 * Parameters for logging admin activity
 */
interface LogActivityParams {
  /** The type of action being performed */
  actionType: AdminActionType;
  /** UUID of the target registration (if applicable) */
  targetRegistrationId?: string;
  /** Application ID of the target (e.g., ALM-XXXXX-XXXX) */
  targetApplicationId?: string;
  /** Additional details about the action (stored as JSON) */
  details?: Record<string, unknown>;
}

/**
 * Logs an admin activity to the admin_activity_logs table
 * 
 * This function:
 * 1. Gets the current authenticated user
 * 2. Inserts a log entry with all relevant metadata
 * 3. Silently fails if no user or if insert fails (non-blocking)
 * 
 * @param params - The activity parameters to log
 * @example
 * ```ts
 * await logAdminActivity({
 *   actionType: 'registration_approval',
 *   targetApplicationId: 'ALM-ABC123-XYZ',
 *   details: { reason: 'Valid payment proof' }
 * });
 * ```
 */
export const logAdminActivity = async ({
  actionType,
  targetRegistrationId,
  targetApplicationId,
  details
}: LogActivityParams): Promise<void> => {
  try {
    // Get the current authenticated admin user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('Cannot log activity: No authenticated user');
      return;
    }

    // Insert the activity log entry
    const { error } = await supabase
      .from('admin_activity_logs')
      .insert({
        admin_user_id: user.id,
        admin_email: user.email || '',
        action_type: actionType,
        target_registration_id: targetRegistrationId || null,
        target_application_id: targetApplicationId || null,
        details: (details || {}) as Json
      });

    if (error) {
      console.error('Failed to log admin activity:', error);
    }
  } catch (err) {
    console.error('Error logging admin activity:', err);
  }
};

/**
 * Parses a user agent string to extract device information
 * 
 * Detects:
 * - Browser: Chrome, Firefox, Safari, Edge, Opera
 * - OS: Windows, macOS, Linux, Android, iOS
 * - Device Type: Desktop, Mobile, Tablet
 * 
 * @param userAgent - The browser's navigator.userAgent string
 * @returns Object with browser, os, and deviceType strings
 */
export const parseUserAgent = (userAgent: string): { browser: string; os: string; deviceType: string } => {
  let browser = 'Unknown';
  let os = 'Unknown';
  let deviceType = 'Desktop';

  // Detect browser - order matters (Chrome contains Safari, etc.)
  if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Edg')) {
    browser = 'Edge';
  } else if (userAgent.includes('Chrome')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Safari')) {
    browser = 'Safari';
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    browser = 'Opera';
  }

  // Detect operating system
  if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS')) {
    os = 'macOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
  }

  // Detect device type
  if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
    deviceType = 'Mobile';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    deviceType = 'Tablet';
  }

  return { browser, os, deviceType };
};

/**
 * Tracks a user's device session for the Activity Dashboard
 * 
 * This function records device metadata when an admin logs in.
 * It uses an atomic upsert operation to handle race conditions
 * and prevent duplicate session entries.
 * 
 * The unique constraint on (user_id, session_id) ensures that
 * concurrent requests don't create multiple entries for the same session.
 * 
 * @param userId - Optional user ID (fetched from session if not provided)
 * @param userEmail - Optional user email
 * @param latitude - Optional latitude for location tracking
 * @param longitude - Optional longitude for location tracking
 * 
 * @example
 * ```ts
 * // Basic usage - uses current authenticated user
 * await trackDeviceSession();
 * 
 * // With location
 * await trackDeviceSession(undefined, undefined, 13.1234, 77.5678);
 * ```
 */
export const trackDeviceSession = async (
  userId?: string,
  userEmail?: string,
  latitude?: number,
  longitude?: number
): Promise<void> => {
  try {
    let user: { id: string; email?: string | null } | null = null;
    let accessToken: string | null = null;

    // Get user and session - either from params or from current session
    if (userId && userEmail) {
      user = { id: userId, email: userEmail };
      // Still need access token for session ID
      const { data: { session } } = await supabase.auth.getSession();
      accessToken = session?.access_token || null;
    } else {
      // Get from current authenticated session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        return; // No authenticated user, nothing to track
      }
      user = session.user;
      accessToken = session.access_token;
    }

    if (!user) {
      return;
    }

    // Parse user agent for device metadata
    const userAgent = navigator.userAgent;
    const { browser, os, deviceType } = parseUserAgent(userAgent);

    // Generate session ID from access token (first 50 chars) or timestamp
    // This provides a unique identifier for each auth session
    const sessionId = accessToken ? accessToken.substring(0, 50) : `manual_${Date.now()}`;
    
    // Prepare upsert data
    // Use upsert to handle concurrent requests and prevent duplicates
    // The unique constraint on (user_id, session_id) ensures only one record per session
    const upsertData = {
      user_id: user.id,
      user_email: user.email || userEmail || '',
      user_agent: userAgent,
      browser,
      os,
      device_type: deviceType,
      session_id: sessionId,
      device_info: { browser, os, deviceType, userAgent } as Json,
      last_active_at: new Date().toISOString(),
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    };

    // Atomic upsert - inserts new record or updates existing
    // onConflict: specifies the unique constraint to check
    // ignoreDuplicates: false means update on conflict
    await supabase
      .from('user_device_sessions')
      .upsert(upsertData, { 
        onConflict: 'user_id,session_id',
        ignoreDuplicates: false 
      });
  } catch (err) {
    console.error('Error tracking device session:', err);
  }
};
