import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Suspense } from "react";
import VendorsV2 from "./pages/VendorsV2";
import VendorProfile from "./pages/VendorProfile";
import VendorBeta from "./pages/VendorBeta";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

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
              <Route
                path="/vendors/2"
                element={<Navigate to="/vendors" replace />}
              />
              <Route
                path="/wins-warnings"
                element={<Navigate to="/vendors" replace />}
              />
              <Route path="/auth" element={<Auth />} />
              <Route path="/vendor-beta" element={<VendorBeta />} />

              <Route
                path="/vendor-portal/*"
                element={<Navigate to="/vendors" replace />}
              />

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
