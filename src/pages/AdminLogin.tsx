import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Clock, KeyRound, MapPin, Settings } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation } from '@/hooks/useGeolocation';
import { trackDeviceSession } from '@/lib/activityLogger';
import LocationHelperDialog from '@/components/admin/LocationHelperDialog';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});


const passwordResetSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [showLocationHelper, setShowLocationHelper] = useState(false);
  
  const { signIn, isAdmin, isApproved, isPendingApproval, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { getLocation, checkGeofence, checkUserIsSuperadmin, isGeofencingEnabled } = useGeolocation();
  // Check for recovery/invite token in URL hash (Supabase redirects with token in hash)
  useEffect(() => {
    const handleRecoveryToken = async () => {
      // Handle both hash params (#access_token=...) and query params (?token=...)
      const hashParams = new URLSearchParams(location.hash.substring(1));
      const searchParams = new URLSearchParams(location.search);

      const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token') || '';
      const type = (hashParams.get('type') || searchParams.get('type')) as
        | 'recovery'
        | 'invite'
        | 'magiclink'
        | null;

      const tokenHash = searchParams.get('token') || searchParams.get('token_hash');

      // If we get a raw token hash (common when email client doesn't complete the redirect-to step)
      if (!accessToken && type && tokenHash && (type === 'recovery' || type === 'invite' || type === 'magiclink')) {
        const { data, error } = await supabase.auth.verifyOtp({
          type,
          token_hash: tokenHash,
        });

        if (error) {
          console.error('OTP verification error:', error);
          toast({
            title: 'Link Expired',
            description: 'This password setup link has expired. Please request a new one.',
            variant: 'destructive',
          });
          return;
        }

        if (data.user) {
          setIsRecoveryMode(true);
          setRecoveryEmail(data.user.email || null);
          window.history.replaceState(null, '', location.pathname);
        }

        return;
      }

      // Normal case: verified redirect includes access_token in hash
      if (type && accessToken && (type === 'recovery' || type === 'invite' || type === 'magiclink')) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('Recovery session error:', error);
          toast({
            title: 'Link Expired',
            description: 'This password setup link has expired. Please request a new one.',
            variant: 'destructive',
          });
          return;
        }

        if (data.user) {
          setIsRecoveryMode(true);
          setRecoveryEmail(data.user.email || null);
          window.history.replaceState(null, '', location.pathname);
        }
      }
    };
    
    handleRecoveryToken();
  }, [location, toast]);

  // Redirect if already logged in as approved admin
  if (!isRecoveryMode && !isLoading && user && isAdmin && isApproved) {
    navigate('/admin', { replace: true });
    return null;
  }

  // Show pending approval message
  if (!isRecoveryMode && !isLoading && user && isPendingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md shadow-elevated">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
            <div>
              <CardTitle className="font-serif text-2xl">
                Pending Approval
              </CardTitle>
              <CardDescription className="mt-2">
                Your admin registration is awaiting approval from a superadmin. You will be able to access the dashboard once approved.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Registered as: <span className="font-medium text-foreground">{user?.email}</span>
            </p>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/admin/login', { replace: true });
              }}
            >
              Sign Out
            </Button>
            <div className="text-center">
              <a 
                href="/" 
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                ← Back to Home
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLocationError(null);
    
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Authenticate user FIRST
      const { error } = await signIn(email, password);
      
      if (error) {
        toast({
          title: 'Login Failed',
          description: 'Invalid email or password. Please try again.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Step 2: Get the current session to check user ID
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      if (!userId) {
        toast({
          title: 'Login Failed',
          description: 'Unable to retrieve session. Please try again.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Step 3: Check if user is superadmin BEFORE geofencing
      const isSuperadmin = await checkUserIsSuperadmin(userId);

      // Step 4: Only apply geofencing if NOT a superadmin
      if (!isSuperadmin) {
        const geofenceEnabled = await isGeofencingEnabled();

        if (geofenceEnabled) {
          setIsCheckingLocation(true);
          
          const userLocation = await getLocation();
          
          if (!userLocation) {
            // Sign out and block access
            await supabase.auth.signOut();
            setIsCheckingLocation(false);
            setIsSubmitting(false);
            setLocationError('Location access is required to log in. Please enable location services and try again.');
            toast({
              title: 'Location Required',
              description: 'Please enable location access in your browser settings to log in.',
              variant: 'destructive',
            });
            return;
          }

          // Verify geofence
          const geofenceResult = await checkGeofence(userLocation.latitude, userLocation.longitude);

          if (!geofenceResult.allowed) {
            // Sign out the user immediately
            await supabase.auth.signOut();
            setLocationError(
              `Access denied: You are ${geofenceResult.distance} km away from the authorized location. ` +
              `Access is restricted to within ${geofenceResult.settings?.radius_km} km of the base location.`
            );
            toast({
              title: 'Location Restricted',
              description: 'You are outside the authorized access zone.',
              variant: 'destructive',
            });
            setIsSubmitting(false);
            setIsCheckingLocation(false);
            return;
          }

          // Track device session with location for non-superadmins
          await trackDeviceSession(
            userId,
            sessionData?.session?.user?.email || email,
            userLocation.latitude,
            userLocation.longitude
          );
          
          setIsCheckingLocation(false);
        } else {
          // Geofencing disabled, track without location
          await trackDeviceSession(
            userId,
            sessionData?.session?.user?.email || email
          );
        }
      } else {
        // Superadmin - no geofencing, track session without location
        await trackDeviceSession(
          userId,
          sessionData?.session?.user?.email || email
        );
      }

      toast({
        title: 'Login Successful',
        description: 'Checking admin permissions...',
      });
      
      setTimeout(() => {
        navigate('/admin');
      }, 500);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setIsCheckingLocation(false);
    }
  };


  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const result = passwordResetSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const fieldErrors: { password?: string; confirmPassword?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'password') fieldErrors.password = err.message;
        if (err.path[0] === 'confirmPassword') fieldErrors.confirmPassword = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) {
        toast({
          title: 'Password Update Failed',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Password Set Successfully',
        description: 'You can now access the admin dashboard.',
      });
      
      setIsRecoveryMode(false);
      setPassword('');
      setConfirmPassword('');
      
      // Redirect to admin dashboard
      setTimeout(() => {
        navigate('/admin');
      }, 500);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Password reset mode
  if (isRecoveryMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md shadow-elevated">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <KeyRound className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="font-serif text-2xl">
                Set Your Password
              </CardTitle>
              <CardDescription className="mt-2">
                {recoveryEmail ? `Setting password for ${recoveryEmail}` : 'Create a secure password for your account'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className={errors.password ? 'border-destructive' : ''}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirm Password</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  className={errors.confirmPassword ? 'border-destructive' : ''}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting Password...
                  </>
                ) : (
                  'Set Password & Continue'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="font-serif text-2xl">
              Admin Portal
            </CardTitle>
            <CardDescription className="mt-2">
              Sign in to access the admin dashboard
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className={errors.password ? 'border-destructive' : ''}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            {locationError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-destructive">{locationError}</p>
                </div>
                {locationError.includes('Location access is required') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowLocationHelper(true)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    How to Enable Location
                  </Button>
                )}
              </div>
            )}

            <LocationHelperDialog
              open={showLocationHelper}
              onOpenChange={setShowLocationHelper}
              onRetry={() => {
                setShowLocationHelper(false);
                setLocationError(null);
              }}
            />

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isCheckingLocation ? 'Verifying location...' : 'Signing in...'}
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <a 
              href="/" 
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              ← Back to Home
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;