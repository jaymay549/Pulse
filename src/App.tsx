import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { lazy, Suspense } from 'react';
import VendorsV2 from "./pages/VendorsV2";
import VendorProfile from "./pages/VendorProfile";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Vendor Portal (lazy loaded)
const VendorPortalLayout = lazy(() => import("./pages/vendor-portal/VendorPortalLayout"));
const VendorAuth = lazy(() => import("./pages/vendor-portal/VendorAuth"));
const VendorDashboard = lazy(() => import("./pages/vendor-portal/VendorDashboard"));
const VendorReviews = lazy(() => import("./pages/vendor-portal/VendorReviews"));
const VendorAlerts = lazy(() => import("./pages/vendor-portal/VendorAlerts"));
const VendorSettings = lazy(() => import("./pages/vendor-portal/VendorSettings"));

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
            <Routes>
              <Route path="/" element={<Navigate to="/vendors" replace />} />
              <Route path="/vendors" element={<VendorsV2 />} />
              <Route path="/vendors/:vendorSlug" element={<VendorProfile />} />
              {/* Redirect old URLs to new */}
              <Route path="/vendors/2" element={<Navigate to="/vendors" replace />} />
              <Route path="/wins-warnings" element={<Navigate to="/vendors" replace />} />
              <Route path="/auth" element={<Auth />} />

              {/* Vendor Portal */}
              <Route path="/vendor-portal/auth" element={<VendorAuth />} />
              <Route path="/vendor-portal" element={<VendorPortalLayout />}>
                <Route index element={<Navigate to="/vendor-portal/dashboard" replace />} />
                <Route path="dashboard" element={<VendorDashboard />} />
                <Route path="reviews" element={<VendorReviews />} />
                <Route path="responses" element={<Navigate to="/vendor-portal/reviews" replace />} />
                <Route path="alerts" element={<VendorAlerts />} />
                <Route path="settings" element={<VendorSettings />} />
              </Route>
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
