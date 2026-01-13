import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  isApproved: boolean;
  isPendingApproval: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role check with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            checkAdminRole(session.user.id);
          }, 0);
        } else {
          setIsAdmin(false);
          setIsApproved(false);
          setIsPendingApproval(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminRole(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminRole = async (userId: string) => {
    try {
      // First check if user has an admin/superadmin role
      const { data: roleData, error: roleError } = await supabase.rpc('is_admin_or_superadmin', {
        _user_id: userId
      });
      
      if (roleError) {
        console.error('Error checking admin role:', roleError);
        setIsAdmin(false);
        setIsApproved(false);
        setIsPendingApproval(false);
        return;
      }
      
      const hasAdminRole = roleData === true;
      setIsAdmin(hasAdminRole);
      
      if (hasAdminRole) {
        // Check if the role is approved
        const { data: userRoles, error: approvalError } = await supabase
          .from('user_roles')
          .select('is_approved, role')
          .eq('user_id', userId)
          .in('role', ['admin', 'superadmin']);
        
        if (approvalError) {
          console.error('Error checking approval status:', approvalError);
          setIsApproved(false);
          setIsPendingApproval(false);
          return;
        }
        
        // Check if any role is approved
        const approvedRole = userRoles?.find(r => r.is_approved === true);
        const pendingRole = userRoles?.find(r => r.is_approved === false);
        
        setIsApproved(!!approvedRole);
        setIsPendingApproval(!approvedRole && !!pendingRole);
      } else {
        // Check if user has a pending admin request
        const { data: pendingRoles, error: pendingError } = await supabase
          .from('user_roles')
          .select('is_approved')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .eq('is_approved', false);
        
        if (!pendingError && pendingRoles && pendingRoles.length > 0) {
          setIsPendingApproval(true);
        } else {
          setIsPendingApproval(false);
        }
        setIsApproved(false);
      }
    } catch (err) {
      console.error('Error checking admin role:', err);
      setIsAdmin(false);
      setIsApproved(false);
      setIsPendingApproval(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setIsApproved(false);
    setIsPendingApproval(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isAdmin, isApproved, isPendingApproval, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
