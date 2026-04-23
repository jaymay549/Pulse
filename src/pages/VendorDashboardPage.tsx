import { useState } from "react";
import { Navigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { useClerkAuth } from "@/hooks/useClerkAuth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

import { VendorCommandCenter } from "@/components/vendor-dashboard/VendorCommandCenter";
import { DashboardOverview } from "@/components/vendor-dashboard/DashboardOverview";
import { DashboardMentions } from "@/components/vendor-dashboard/DashboardMentions";
import { DashboardEditProfile } from "@/components/vendor-dashboard/DashboardEditProfile";
import { DashboardIntel } from "@/components/vendor-dashboard/DashboardIntel";
import { DashboardDimensions } from "@/components/vendor-dashboard/DashboardDimensions";
import { DashboardAIChat } from "@/components/vendor-dashboard/DashboardAIChat";
import { DashboardSegments } from "@/components/vendor-dashboard/DashboardSegments";
import { DashboardDemoRequests } from "@/components/vendor-dashboard/DashboardDemoRequests";
import { DashboardScreenshots } from "@/components/vendor-dashboard/DashboardScreenshots";
import { DashboardCategories } from "@/components/vendor-dashboard/DashboardCategories";
import { DashboardDealerSignals } from "@/components/vendor-dashboard/DashboardDealerSignals";
import { VendorDashboardLayout, type DashboardSection } from "@/components/vendor-dashboard/VendorDashboardLayout";
import { useVendorIntelligenceDashboard } from "@/hooks/useVendorIntelligenceDashboard";

interface VendorProfileRow {
  id: string;
  vendor_name: string;
  is_approved: boolean;
}

export default function VendorDashboardPage() {
  const supabase = useClerkSupabase();
  const { user, isAuthenticated, isAdmin, isLoading: authLoading, getToken } = useClerkAuth();
  const [activeSection, setActiveSection] = useState<DashboardSection>("intelligence");
  const [searchParams] = useSearchParams();

  // Admin can manage any vendor via ?vendor=VendorName
  const adminVendorParam = searchParams.get("vendor");
  const isAdminMode = isAdmin && !!adminVendorParam;

  // Fetch or create vendor profile for admin mode (via edge function with service role)
  const {
    data: adminVendorProfile,
    isLoading: adminLoading,
    isError: adminError,
    error: adminErrorObj,
  } = useQuery({
    queryKey: ["admin-vendor-profile", adminVendorParam],
    queryFn: async (): Promise<VendorProfileRow | null> => {
      const token = await getToken();
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/admin-ensure-vendor-profile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ vendor_name: adminVendorParam, _auth_token: token }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Edge function failed (${res.status})`);
      }
      return (await res.json()) as VendorProfileRow;
    },
    enabled: isAdminMode,
    retry: false,
  });

  // Fetch own vendor profile (current behavior)
  const { data: ownVendorProfile, isLoading: ownLoading } = useQuery({
    queryKey: ["my-vendor-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_profiles")
        .select("id, vendor_name, is_approved")
        .eq("user_id", user!.id)
        .eq("is_approved", true)
        .maybeSingle();
      if (error) throw error;
      return data as VendorProfileRow | null;
    },
    enabled: isAuthenticated && !!user?.id && !isAdminMode,
  });

  const isLoading = isAdminMode ? adminLoading : ownLoading;
  const vendorProfile = isAdminMode ? adminVendorProfile : ownVendorProfile;
  const vendorName = vendorProfile?.vendor_name ?? "";

  // Must be called before any early returns to satisfy React's rules of hooks.
  // React Query cache shares data with VendorCommandCenter (same queryKey).
  const { data: dashboardIntel } = useVendorIntelligenceDashboard(vendorName);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Show error UI for admin mode instead of silently redirecting
  if (isAdminMode && adminError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="mx-4 max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
          <h2 className="mt-3 text-lg font-semibold text-red-900">
            Admin access failed
          </h2>
          <p className="mt-2 text-sm text-red-700">
            {adminErrorObj instanceof Error
              ? adminErrorObj.message
              : "Could not load vendor profile."}
          </p>
          <Link
            to="/vendors"
            className="mt-4 inline-block text-sm font-medium text-red-600 underline hover:no-underline"
          >
            Back to vendors
          </Link>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !vendorProfile) {
    return <Navigate to="/vendors" replace />;
  }

  return (
    <>
      <VendorDashboardLayout vendorName={vendorName} activeSection={activeSection} onNavigate={setActiveSection}>
        <div className="max-w-5xl">
          {isAdminMode && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              <ShieldCheck className="h-4 w-4 flex-shrink-0" />
              <span>
                Admin mode &mdash; editing <strong>{vendorName}</strong>.{" "}
                <Link to={`/vendors/${encodeURIComponent(vendorName)}`} className="underline hover:no-underline">
                  View public profile
                </Link>
              </span>
            </div>
          )}
          {activeSection === "intelligence" && <VendorCommandCenter vendorName={vendorName} />}
          {activeSection === "overview" && <DashboardOverview vendorName={vendorName} onNavigate={setActiveSection} />}
          {activeSection === "segments" && <DashboardSegments vendorName={vendorName} />}
          {activeSection === "mentions" && <DashboardMentions vendorName={vendorName} vendorProfileId={vendorProfile.id} />}
          {activeSection === "profile" && <DashboardEditProfile vendorProfileId={isAdminMode ? vendorProfile.id : undefined} />}
          {activeSection === "intel" && <DashboardIntel vendorName={vendorName} />}
          {activeSection === "dimensions" && <DashboardDimensions vendorName={vendorName} />}
          {activeSection === "demo-requests" && <DashboardDemoRequests vendorName={vendorName} supabase={supabase} />}
          {activeSection === "screenshots" && <DashboardScreenshots vendorName={vendorName} />}
          {activeSection === "categories" && <DashboardCategories vendorName={vendorName} />}
          {activeSection === "dealer-signals" && <DashboardDealerSignals vendorName={vendorName} />}
        </div>
      </VendorDashboardLayout>

      {/* Floating AI chat — persists across all tabs */}
      <DashboardAIChat vendorName={vendorName} dashboardIntel={dashboardIntel ?? null} />
    </>
  );
}
