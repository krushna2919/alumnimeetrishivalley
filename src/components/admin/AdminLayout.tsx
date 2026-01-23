import { ReactNode, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Activity
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { trackDeviceSession } from '@/lib/activityLogger';

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
  
  const navItems = getNavItems(userRole);

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
    if (!isLoading && (!user || !isAdmin || !isApproved)) {
      navigate('/admin/login', { replace: true });
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

  if (isLoading) {
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
        "fixed top-0 left-0 z-40 h-screen w-64 bg-card border-r transition-transform lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b">
            <Link to="/admin" className="font-serif text-xl font-semibold text-foreground">
              Admin Panel
            </Link>
            <p className="text-sm text-muted-foreground mt-1">
              Alumni Meet 2026
            </p>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
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

          <div className="p-4 border-t space-y-3">
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
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
