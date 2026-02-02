/**
 * App.tsx - Root Application Component
 * 
 * This is the main entry point of the Rishi Valley Alumni Meet registration application.
 * It sets up the global providers, routing configuration, and authentication context
 * needed for the entire application to function.
 * 
 * Architecture Overview:
 * - QueryClientProvider: Manages server state caching via React Query (TanStack Query)
 * - TooltipProvider: Enables tooltip components throughout the app
 * - BrowserRouter: Provides client-side routing via React Router
 * - AuthProvider: Manages user authentication state and role-based access control
 * - Toaster components: Display toast notifications (both shadcn and sonner)
 * 
 * Route Structure:
 * - "/" : Public registration form for alumni
 * - "/install" : PWA installation instructions page
 * - "/admin/*" : Protected admin routes (requires authentication)
 * - "*" : Catch-all 404 page for unknown routes
 */

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";

// Page Components
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminRegistrations from "./pages/admin/AdminRegistrations";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminHostelManagement from "./pages/admin/AdminHostelManagement";
import AdminAccountsReview from "./pages/admin/AdminAccountsReview";
import AdminActivityDashboard from "./pages/admin/AdminActivityDashboard";
import InstallApp from "./pages/InstallApp";

/**
 * QueryClient Configuration
 * 
 * Creates a new React Query client instance for managing server state.
 * Default configuration is used, which includes:
 * - Automatic background refetching
 * - Stale time management
 * - Cache persistence
 */
const queryClient = new QueryClient();

/**
 * App Component
 * 
 * The root component that wraps the entire application with necessary providers
 * and defines the routing structure.
 * 
 * Provider Hierarchy (outer to inner):
 * 1. QueryClientProvider - Server state management
 * 2. TooltipProvider - UI tooltip support
 * 3. BrowserRouter - Client-side routing
 * 4. AuthProvider - Authentication context
 * 
 * @returns The complete application wrapped in providers with routing
 */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          {/* Toast notification containers - both libraries for different use cases */}
          <Toaster />
          <Sonner />
          
          {/* Application Routes */}
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/install" element={<InstallApp />} />
            
            {/* Admin Authentication */}
            <Route path="/admin/login" element={<AdminLogin />} />
            
            {/* Protected Admin Routes - Auth checked in AdminLayout */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/registrations" element={<AdminRegistrations />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/hostels" element={<AdminHostelManagement />} />
            <Route path="/admin/accounts-review" element={<AdminAccountsReview />} />
            <Route path="/admin/activity" element={<AdminActivityDashboard />} />
            
            {/* 404 Catch-all - Must be last */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
