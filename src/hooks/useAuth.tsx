import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'superadmin' | 'admin' | 'reviewer' | 'accounts_admin' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  isApproved: boolean;
  isPendingApproval: boolean;
  userRole: UserRole;
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
  const [userRole, setUserRole] = useState<UserRole>(null);

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
          setUserRole(null);
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
      // Check for all roles: admin, superadmin, reviewer
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('is_approved, role')
        .eq('user_id', userId);
      
      if (rolesError) {
        console.error('Error checking roles:', rolesError);
        setIsAdmin(false);
        setIsApproved(false);
        setIsPendingApproval(false);
        setUserRole(null);
        return;
      }

      // Find the highest priority approved role (cast role to string for new enum value)
      const approvedSuperadmin = userRoles?.find(r => (r.role as string) === 'superadmin' && r.is_approved);
      const approvedAdmin = userRoles?.find(r => (r.role as string) === 'admin' && r.is_approved);
      const approvedReviewer = userRoles?.find(r => (r.role as string) === 'reviewer' && r.is_approved);
      const approvedAccountsAdmin = userRoles?.find(r => (r.role as string) === 'accounts_admin' && r.is_approved);
      
      // Find any pending role
      const pendingRole = userRoles?.find(r => !r.is_approved);
      
      // Determine the active role (priority: superadmin > admin > accounts_admin > reviewer)
      if (approvedSuperadmin) {
        setUserRole('superadmin');
        setIsAdmin(true);
        setIsApproved(true);
        setIsPendingApproval(false);
      } else if (approvedAdmin) {
        setUserRole('admin');
        setIsAdmin(true);
        setIsApproved(true);
        setIsPendingApproval(false);
      } else if (approvedAccountsAdmin) {
        setUserRole('accounts_admin');
        setIsAdmin(true); // Accounts admin can access admin panel
        setIsApproved(true);
        setIsPendingApproval(false);
      } else if (approvedReviewer) {
        setUserRole('reviewer');
        setIsAdmin(true); // Reviewer can access admin panel
        setIsApproved(true);
        setIsPendingApproval(false);
      } else if (pendingRole) {
        setUserRole(null);
        setIsAdmin(false);
        setIsApproved(false);
        setIsPendingApproval(true);
      } else {
        setUserRole(null);
        setIsAdmin(false);
        setIsApproved(false);
        setIsPendingApproval(false);
      }
    } catch (err) {
      console.error('Error checking admin role:', err);
      setIsAdmin(false);
      setIsApproved(false);
      setIsPendingApproval(false);
      setUserRole(null);
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
    setUserRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isAdmin, isApproved, isPendingApproval, userRole, signIn, signOut }}>
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
