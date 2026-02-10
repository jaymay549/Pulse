import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import VendorsV2 from "./pages/VendorsV2";
import VendorProfile from "./pages/VendorProfile";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Admin pages (lazy loaded)
const AdminGuard = lazy(() => import("./components/admin/AdminGuard"));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const VendorQueuePage = lazy(() => import("./pages/admin/VendorQueuePage"));
const TopicModerationPage = lazy(() => import("./pages/admin/TopicModerationPage"));
const GroupManagementPage = lazy(() => import("./pages/admin/GroupManagementPage"));
const TaskSchedulingPage = lazy(() => import("./pages/admin/TaskSchedulingPage"));
const CreateTaskPage = lazy(() => import("./pages/admin/CreateTaskPage"));
const PromptManagementPage = lazy(() => import("./pages/admin/PromptManagementPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AIChatPage = lazy(() => import("./pages/admin/AIChatPage"));
const SendMessagePage = lazy(() => import("./pages/admin/SendMessagePage"));
const MembersPage = lazy(() => import("./pages/admin/MembersPage"));
const TrendsPage = lazy(() => import("./pages/admin/TrendsPage"));
const DebugPage = lazy(() => import("./pages/admin/DebugPage"));

const queryClient = new QueryClient();

const AdminFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-zinc-950">
    <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
  </div>
);

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/vendors" replace />} />
            <Route path="/vendors" element={<VendorsV2 />} />
            <Route path="/vendors/:vendorSlug" element={<VendorProfile />} />
            {/* Redirect old URLs to new */}
            <Route path="/vendors/2" element={<Navigate to="/vendors" replace />} />
            <Route path="/wins-warnings" element={<Navigate to="/vendors" replace />} />
            <Route path="/auth" element={<Auth />} />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminGuard>
                    <AdminLayout />
                  </AdminGuard>
                </Suspense>
              }
            >
              <Route index element={<Suspense fallback={<AdminFallback />}><AdminDashboard /></Suspense>} />
              <Route path="queue" element={<Suspense fallback={<AdminFallback />}><VendorQueuePage /></Suspense>} />
              <Route path="topics" element={<Suspense fallback={<AdminFallback />}><TopicModerationPage /></Suspense>} />
              <Route path="groups" element={<Suspense fallback={<AdminFallback />}><GroupManagementPage /></Suspense>} />
              <Route path="tasks" element={<Suspense fallback={<AdminFallback />}><TaskSchedulingPage /></Suspense>} />
              <Route path="tasks/create" element={<Suspense fallback={<AdminFallback />}><CreateTaskPage /></Suspense>} />
              <Route path="prompts" element={<Suspense fallback={<AdminFallback />}><PromptManagementPage /></Suspense>} />
              <Route path="settings" element={<Suspense fallback={<AdminFallback />}><AdminSettingsPage /></Suspense>} />
              <Route path="chat" element={<Suspense fallback={<AdminFallback />}><AIChatPage /></Suspense>} />
              <Route path="send" element={<Suspense fallback={<AdminFallback />}><SendMessagePage /></Suspense>} />
              <Route path="members" element={<Suspense fallback={<AdminFallback />}><MembersPage /></Suspense>} />
              <Route path="trends" element={<Suspense fallback={<AdminFallback />}><TrendsPage /></Suspense>} />
              <Route path="debug" element={<Suspense fallback={<AdminFallback />}><DebugPage /></Suspense>} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
