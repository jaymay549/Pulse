import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import Index from "./pages/Index";
import Upgrade from "./pages/Upgrade";
import FreeOnboarding from "./pages/FreeOnboarding";
import ProOnboarding from "./pages/ProOnboarding";
import ExecutiveOnboarding from "./pages/ExecutiveOnboarding";
import ViewerOnboarding from "./pages/ViewerOnboarding";
import VerifiedVendorOnboarding from "./pages/VerifiedVendorOnboarding";
import ExecutiveRetreat from "./pages/ExecutiveRetreat";
import VendorDashboard from "./pages/VendorDashboard";
import AdminVendorApprovals from "./pages/AdminVendorApprovals";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Pulse from "./pages/Pulse";
import AskCommunity from "./pages/AskCommunity";
import NotFound from "./pages/NotFound";
import Referral from "./pages/Referral";
import NADA from "./pages/NADA";
import VendorCollective from "./pages/VendorCollective";
import Vendors from "./pages/Vendors";
import VendorsV2 from "./pages/VendorsV2";
import VendorsUnderConstruction from "./pages/VendorsUnderConstruction";
const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/upgrade" element={<Upgrade />} />
            <Route path="/free-onboarding" element={<FreeOnboarding />} />
            <Route path="/pro-onboarding" element={<ProOnboarding />} />
            <Route path="/executive-onboarding" element={<ExecutiveOnboarding />} />
            <Route path="/viewer-onboarding" element={<ViewerOnboarding />} />
            <Route path="/verified-vendor-onboarding" element={<VerifiedVendorOnboarding />} />
            <Route path="/vendor-dashboard" element={<VendorDashboard />} />
            <Route path="/admin/vendor-approvals" element={<AdminVendorApprovals />} />
            <Route path="/executive-retreat" element={<ExecutiveRetreat />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pulse" element={<Pulse />} />
            <Route path="/ask" element={<AskCommunity />} />
            <Route path="/referral" element={<Referral />} />
            <Route path="/nada" element={<NADA />} />
            <Route path="/vendor-collective" element={<VendorCollective />} />
            <Route path="/vendors" element={<VendorsUnderConstruction />} />
            <Route path="/vendors/old" element={<Vendors />} />
            {/* Redirect old URLs to new */}
            <Route path="/vendors/2" element={<Navigate to="/vendors" replace />} />
            <Route path="/wins-warnings" element={<Navigate to="/vendors" replace />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
