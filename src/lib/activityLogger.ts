import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

export type AdminActionType = 
  | 'account_approval'
  | 'account_rejection'
  | 'receipt_upload'
  | 'registration_approval'
  | 'registration_rejection'
  | 'bed_assignment'
  | 'bed_unassignment';

interface LogActivityParams {
  actionType: AdminActionType;
  targetRegistrationId?: string;
  targetApplicationId?: string;
  details?: Record<string, unknown>;
}

export const logAdminActivity = async ({
  actionType,
  targetRegistrationId,
  targetApplicationId,
  details
}: LogActivityParams): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('Cannot log activity: No authenticated user');
      return;
    }

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

// Parse user agent to extract device info
export const parseUserAgent = (userAgent: string): { browser: string; os: string; deviceType: string } => {
  let browser = 'Unknown';
  let os = 'Unknown';
  let deviceType = 'Desktop';

  // Detect browser
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

  // Detect OS
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

export const trackDeviceSession = async (): Promise<void> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return;
    }

    const user = session.user;
    const userAgent = navigator.userAgent;
    const { browser, os, deviceType } = parseUserAgent(userAgent);

    // Check if this session already exists
    const { data: existingSession } = await supabase
      .from('user_device_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('session_id', session.access_token.substring(0, 50))
      .single();

    if (existingSession) {
      // Update last active
      await supabase
        .from('user_device_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', existingSession.id);
    } else {
      // Insert new session
      await supabase
        .from('user_device_sessions')
        .insert({
          user_id: user.id,
          user_email: user.email || '',
          user_agent: userAgent,
          browser,
          os,
          device_type: deviceType,
          session_id: session.access_token.substring(0, 50),
          device_info: { browser, os, deviceType, userAgent }
        });
    }
  } catch (err) {
    console.error('Error tracking device session:', err);
  }
};
