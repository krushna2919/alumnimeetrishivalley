import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/install" element={<InstallApp />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/registrations" element={<AdminRegistrations />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/hostels" element={<AdminHostelManagement />} />
            <Route path="/admin/accounts-review" element={<AdminAccountsReview />} />
            <Route path="/admin/activity" element={<AdminActivityDashboard />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
