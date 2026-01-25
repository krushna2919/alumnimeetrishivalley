import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut, 
  Loader2,
  Menu,
  X,
  UserCog,
  Building2,
  Receipt,
  RefreshCw,
  Activity,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackDeviceSession } from '@/lib/activityLogger';

interface AdminLayoutProps {
  children: ReactNode;
}

// Screen key mapping for permission checking
const SCREEN_KEY_MAP: Record<string, string> = {
  '/admin': 'dashboard',
  '/admin/registrations': 'registrations',
  '/admin/hostels': 'hostels',
  '/admin/accounts-review': 'accounts_review',
  '/admin/settings': 'settings',
};

interface AdminLayoutProps {
  children: ReactNode;
}

const getNavItems = (userRole: string | null) => {
  // Accounts admin only sees payment verification - no other menus
  if (userRole === 'accounts_admin') {
    return [
      { href: '/admin/accounts-review', label: 'Payment Verification', icon: Receipt },
    ];
  }
  
  const items = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/registrations', label: 'Registrations', icon: Users },
    { href: '/admin/hostels', label: 'Hostel Management', icon: Building2 },
  ];
  
  // Superadmin can access Payment Verification (same as accounts admin)
  if (userRole === 'superadmin') {
    items.push({ href: '/admin/accounts-review', label: 'Payment Verification', icon: Receipt });
  }
  
  // Only superadmin can access User Management
  if (userRole === 'superadmin') {
    items.push({ href: '/admin/users', label: 'User Management', icon: UserCog });
  }
  
  // Only superadmin can access Activity Dashboard
  if (userRole === 'superadmin') {
    items.push({ href: '/admin/activity', label: 'Activity Logs', icon: Activity });
  }
  
  // Admin and superadmin can access Settings
  if (userRole === 'admin' || userRole === 'superadmin') {
    items.push({ href: '/admin/settings', label: 'Settings', icon: Settings });
  }
  
  return items;
};

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { user, isAdmin, isApproved, isLoading, signOut, userRole, allRoles, switchRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [screenPermissions, setScreenPermissions] = useState<string[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  
  // Fetch user's screen permissions
  useEffect(() => {
    const fetchScreenPermissions = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('user_screen_permissions')
          .select('screen_key')
          .eq('user_id', user.id);
        
        if (error) {
          console.error('Error fetching screen permissions:', error);
        } else {
          setScreenPermissions(data?.map(p => p.screen_key) || []);
        }
      } catch (err) {
        console.error('Error fetching screen permissions:', err);
      } finally {
        setPermissionsLoaded(true);
      }
    };
    
    fetchScreenPermissions();
  }, [user]);

  // Filter nav items based on screen permissions (only applies to non-superadmin)
  const getFilteredNavItems = () => {
    const baseItems = getNavItems(userRole);
    
    // Superadmins always see all items, or if no permissions configured use role defaults
    if (userRole === 'superadmin' || screenPermissions.length === 0) {
      return baseItems;
    }
    
    // Filter based on configured screen permissions
    return baseItems.filter(item => {
      const screenKey = SCREEN_KEY_MAP[item.href];
      // If no screen key mapping exists (like user management), keep it based on role
      if (!screenKey) return true;
      return screenPermissions.includes(screenKey);
    });
  };
  
  const navItems = getFilteredNavItems();

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'superadmin': return 'Super Admin';
      case 'admin': return 'Admin';
      case 'accounts_admin': return 'Accounts Admin';
      case 'reviewer': return 'Reviewer';
      default: return 'User';
    }
  };

  useEffect(() => {
    // Only redirect if we're definitely not loading AND auth state is confirmed invalid
    // Use a small delay to prevent flash during route transitions
    if (!isLoading && (!user || !isAdmin || !isApproved)) {
      const timeoutId = setTimeout(() => {
        // Double-check the condition after the delay
        if (!user || !isAdmin || !isApproved) {
          navigate('/admin/login', { replace: true });
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [user, isAdmin, isApproved, isLoading, navigate]);

  // Track device session when admin logs in
  useEffect(() => {
    if (user && isAdmin && isApproved) {
      trackDeviceSession();
    }
  }, [user, isAdmin, isApproved]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login', { replace: true });
  };

  if (isLoading || !permissionsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin || !isApproved) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b px-4 py-3 flex items-center justify-between">
        <Link to="/admin" className="font-serif text-lg font-semibold text-foreground">
          Admin Panel
        </Link>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-40 h-screen bg-card border-r transition-all duration-300 lg:translate-x-0",
        sidebarCollapsed ? "w-16" : "w-64",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Chevron collapse toggle - desktop only */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={cn(
            "hidden lg:flex absolute -right-3 top-8 z-50 h-6 w-6 items-center justify-center rounded-full border bg-card shadow-sm hover:bg-muted transition-colors"
          )}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <div className="flex flex-col h-full">
          <div className={cn("border-b flex items-center", sidebarCollapsed ? "p-3 justify-center" : "p-6")}>
            {sidebarCollapsed ? (
              <Link to="/admin" className="font-serif text-lg font-bold text-foreground">
                A
              </Link>
            ) : (
              <div>
                <Link to="/admin" className="font-serif text-xl font-semibold text-foreground">
                  Admin Panel
                </Link>
                <p className="text-sm text-muted-foreground mt-1">
                  Alumni Meet 2026
                </p>
              </div>
            )}
          </div>

          <nav className={cn("flex-1 space-y-1", sidebarCollapsed ? "p-2" : "p-4")}>
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              
              if (sidebarCollapsed) {
                return (
                  <Tooltip key={item.href} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center justify-center p-3 rounded-lg transition-colors",
                          isActive 
                            ? "bg-primary text-primary-foreground" 
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className={cn("border-t space-y-3", sidebarCollapsed ? "p-2" : "p-4")}>
            {sidebarCollapsed ? (
              <>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="w-full text-muted-foreground hover:text-foreground"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Sign Out
                  </TooltipContent>
                </Tooltip>
              </>
            ) : (
              <>
                <div className="px-4 py-2">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user.email}
                  </p>
                  {allRoles.length > 1 ? (
                    <div className="mt-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <RefreshCw className="h-3 w-3" />
                        Switch Role
                      </div>
                      <Select value={userRole || undefined} onValueChange={(v) => switchRole(v as any)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {allRoles.map((role) => (
                            <SelectItem key={role} value={role!}>
                              {getRoleLabel(role)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground capitalize">
                      {getRoleLabel(userRole)}
                    </p>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-foreground"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-3 h-5 w-5" />
                  Sign Out
                </Button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={cn(
        "pt-16 lg:pt-0 min-h-screen transition-all duration-300",
        sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
      )}>
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
