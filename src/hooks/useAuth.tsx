/**
 * useAuth.tsx - Authentication Context and Hook
 * 
 * Provides centralized authentication state management for the entire application.
 * Handles user sessions, role-based access control, and authentication operations.
 * 
 * Key Features:
 * - Session persistence and auto-refresh via Supabase Auth
 * - Multi-role support (superadmin, admin, accounts_admin, reviewer)
 * - Role switching for users with multiple roles
 * - Approval workflow (users need admin approval to access admin features)
 * 
 * Role Hierarchy:
 * 1. superadmin - Full access to all features
 * 2. admin - Access to most admin features except user management
 * 3. accounts_admin - Limited to payment verification only
 * 4. reviewer - Read-only access to registrations
 * 
 * Usage:
 * ```tsx
 * const { user, isAdmin, userRole, signIn, signOut } = useAuth();
 * ```
 */

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * Available user roles in the system
 * null means no role assigned or not authenticated
 */
type UserRole = 'superadmin' | 'admin' | 'reviewer' | 'accounts_admin' | null;

/**
 * Authentication context interface
 * Defines all the values and functions available through the auth context
 */
interface AuthContextType {
  /** Current authenticated user object */
  user: User | null;
  /** Current session object with tokens */
  session: Session | null;
  /** True while initial auth check is in progress */
  isLoading: boolean;
  /** True if user has any admin role */
  isAdmin: boolean;
  /** True if user's role has been approved by a superadmin */
  isApproved: boolean;
  /** True if user has a pending role awaiting approval */
  isPendingApproval: boolean;
  /** Currently active role (for users with multiple roles) */
  userRole: UserRole;
  /** All approved roles the user has */
  allRoles: UserRole[];
  /** Function to switch between roles (for multi-role users) */
  switchRole: (role: UserRole) => void;
  /** Sign in with email and password */
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  /** Sign out the current user */
  signOut: () => Promise<void>;
}

// Create context with undefined default (will be provided by AuthProvider)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider Component
 * 
 * Wraps the application to provide authentication context to all children.
 * Manages auth state lifecycle and role checking.
 * 
 * @param children - Child components that need auth context access
 * @returns Provider component wrapping children
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Authentication state
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Role state
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [allRoles, setAllRoles] = useState<UserRole[]>([]);

  /**
   * Initialize auth state and set up listeners
   * This runs once on mount
   */
  useEffect(() => {
    // Set up auth state change listener FIRST
    // This ensures we catch all auth events (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role check with setTimeout to avoid potential deadlocks
        // with Supabase client during auth state changes
        if (session?.user) {
          setTimeout(() => {
            checkAdminRole(session.user.id);
          }, 0);
        } else {
          // Clear role state when user logs out
          setIsAdmin(false);
          setIsApproved(false);
          setIsPendingApproval(false);
          setUserRole(null);
          setAllRoles([]);
        }
      }
    );

    // THEN check for existing session (on page load/refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminRole(session.user.id);
      }
      setIsLoading(false);
    });

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe();
  }, []);

  /**
   * Checks the user's roles from the user_roles table
   * 
   * This function:
   * 1. Fetches all roles for the user from user_roles table
   * 2. Filters for approved roles
   * 3. Sets the highest priority role as default
   * 4. Updates state for role-based UI rendering
   * 
   * @param userId - The user's UUID from Supabase Auth
   */
  const checkAdminRole = async (userId: string) => {
    try {
      // Fetch all roles for this user
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
        setAllRoles([]);
        return;
      }

      // Collect all approved roles in priority order
      // Priority: superadmin > admin > accounts_admin > reviewer
      const approvedRoles: UserRole[] = [];
      if (userRoles?.find(r => (r.role as string) === 'superadmin' && r.is_approved)) {
        approvedRoles.push('superadmin');
      }
      if (userRoles?.find(r => (r.role as string) === 'admin' && r.is_approved)) {
        approvedRoles.push('admin');
      }
      if (userRoles?.find(r => (r.role as string) === 'accounts_admin' && r.is_approved)) {
        approvedRoles.push('accounts_admin');
      }
      if (userRoles?.find(r => (r.role as string) === 'reviewer' && r.is_approved)) {
        approvedRoles.push('reviewer');
      }

      setAllRoles(approvedRoles);

      // Check for any pending (unapproved) role
      const pendingRole = userRoles?.find(r => !r.is_approved);
      
      if (approvedRoles.length > 0) {
        // User has at least one approved role
        // Set highest priority role as default (first in the array)
        const defaultRole = approvedRoles[0];
        setUserRole(defaultRole);
        setIsAdmin(true);
        setIsApproved(true);
        setIsPendingApproval(false);
      } else if (pendingRole) {
        // User has a role awaiting approval
        setUserRole(null);
        setIsAdmin(false);
        setIsApproved(false);
        setIsPendingApproval(true);
      } else {
        // User has no roles at all
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
      setAllRoles([]);
    }
  };

  /**
   * Switches the active role for users with multiple roles
   * Only allows switching to roles the user actually has
   * 
   * @param role - The role to switch to
   */
  const switchRole = (role: UserRole) => {
    if (role && allRoles.includes(role)) {
      setUserRole(role);
    }
  };

  /**
   * Signs in a user with email and password
   * 
   * @param email - User's email address
   * @param password - User's password
   * @returns Object with error if sign in failed, null if successful
   */
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  /**
   * Signs out the current user and clears all auth state
   */
  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setIsApproved(false);
    setIsPendingApproval(false);
    setUserRole(null);
    setAllRoles([]);
  };

  // Provide auth context to children
  return (
    <AuthContext.Provider value={{ user, session, isLoading, isAdmin, isApproved, isPendingApproval, userRole, allRoles, switchRole, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * useAuth Hook
 * 
 * Custom hook to access the authentication context.
 * Must be used within an AuthProvider.
 * 
 * @throws Error if used outside of AuthProvider
 * @returns AuthContextType with all auth state and functions
 * 
 * @example
 * ```tsx
 * const { user, isAdmin, signOut } = useAuth();
 * 
 * if (!isAdmin) {
 *   return <Navigate to="/login" />;
 * }
 * ```
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
