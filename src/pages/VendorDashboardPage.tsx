import { useState } from "react";
import { Navigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ShieldCheck, Eye, EyeOff, Lock } from "lucide-react";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { useVendorSupabaseAuth } from "@/hooks/useVendorSupabaseAuth";
import { vendorSupabase } from "@/integrations/supabase/vendorClient";

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
import { useTierConfigReadonly, getVisibility } from "@/hooks/useTierConfig";
import type { VendorTier, ComponentVisibility } from "@/types/tier-config";

interface VendorProfileRow {
  id: string;
  vendor_name: string;
  is_approved: boolean;
}

function getSectionVisibility(
  configs: ReturnType<typeof useTierConfigReadonly>["configs"],
  tier: string | undefined,
  sectionKey: string,
): ComponentVisibility {
  // Admin mode (no tier) or unknown tier: show everything
  if (!tier) return "full";
  return getVisibility(configs, tier as VendorTier, sectionKey);
}

export default function VendorDashboardPage() {
  const clerkSupabase = useClerkSupabase();
  const { user, isAuthenticated, isAdmin, isLoading: authLoading, getToken } = useClerkAuth();
  const { isAuthenticated: isVendorAuth, user: vendorUser, isLoading: vendorAuthLoading } = useVendorSupabaseAuth();
  const [activeSection, setActiveSection] = useState<DashboardSection>("intelligence");
  const [adminVendorView, setAdminVendorView] = useState(false);
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
      const { data, error } = await clerkSupabase
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

  // Vendor Supabase Auth: resolve vendor name from vendor_logins table
  const { data: vendorLoginProfile, isLoading: vendorLoginLoading } = useQuery({
    queryKey: ["vendor-login-profile", vendorUser?.id],
    queryFn: async () => {
      const { data, error } = await vendorSupabase
        .from("vendor_logins")
        .select("vendor_name, tier")
        .eq("user_id", vendorUser!.id)
        .maybeSingle();
      if (error) {
        console.error("[VendorAuth] vendor_logins lookup error:", error);
        throw error;
      }
      return data;
    },
    enabled: isVendorAuth && !!vendorUser?.id && !isAdminMode,
  });

  const isLoading = isAdminMode ? adminLoading : (isVendorAuth ? vendorLoginLoading : ownLoading);
  const vendorProfile = isAdminMode
    ? adminVendorProfile
    : (isVendorAuth && vendorLoginProfile)
      ? { id: "vendor-session", vendor_name: vendorLoginProfile.vendor_name, is_approved: true }
      : ownVendorProfile;
  const vendorName = vendorProfile?.vendor_name ?? "";

  // Admin mode: look up vendor's actual tier from vendor_logins via RPC
  const { data: adminVendorLogins = [] } = useQuery({
    queryKey: ["admin-vendor-logins-tiers"],
    queryFn: async () => {
      const { data, error: rpcErr } = await clerkSupabase.rpc("admin_list_vendor_logins" as never);
      if (rpcErr) throw rpcErr;
      return (data ?? []) as { vendor_name: string; tier: string }[];
    },
    enabled: isAdminMode,
    staleTime: 5 * 60 * 1000,
  });

  const adminResolvedTier = isAdminMode && adminVendorView
    ? (adminVendorLogins.find(
        (vl) => vl.vendor_name?.toLowerCase() === adminVendorParam?.toLowerCase()
      )?.tier || "tier_1")
    : undefined;

  // In admin vendor-view mode, use the vendor's actual tier.
  // In admin full-access mode, tier is undefined (sees everything).
  // In vendor session, use vendorLoginProfile tier.
  const vendorTier = adminResolvedTier || vendorLoginProfile?.tier;

  // Fetch tier component config via anon client (works for vendor magic-link sessions).
  const { configs: tierConfigs } = useTierConfigReadonly();

  // Must be called before any early returns to satisfy React's rules of hooks.
  // React Query cache shares data with VendorCommandCenter (same queryKey).
  const { data: dashboardIntel } = useVendorIntelligenceDashboard(vendorName);

  if (authLoading || vendorAuthLoading || isLoading) {
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

  // Wait for vendor login query to settle before redirecting
  const vendorQueryPending = isVendorAuth && !vendorLoginProfile && vendorLoginLoading;
  if (vendorQueryPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if ((!isAuthenticated && !isVendorAuth) || !vendorProfile) {
    return <Navigate to="/vendors" replace />;
  }

  const renderSection = (sectionKey: string, component: React.ReactNode) => {
    if (activeSection !== sectionKey) return null;
    const vis = getSectionVisibility(tierConfigs, vendorTier, sectionKey);
    if (vis === "hidden") return null;
    if (vis === "gated") {
      return (
        <div className="relative">
          <div className="pointer-events-none select-none blur-[6px] opacity-70">
            {component}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px] rounded-xl">
            <div className="flex flex-col items-center gap-3 text-center px-6 py-8 bg-white rounded-xl shadow-lg border border-slate-200 max-w-sm">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-amber-100">
                <Lock className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Premium Feature</h3>
              <p className="text-xs text-slate-500">
                Upgrade your plan to unlock this section and get full access to all insights.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return component;
  };

  return (
    <>
      <VendorDashboardLayout vendorName={vendorName} activeSection={activeSection} onNavigate={setActiveSection} tier={vendorTier}>
        <div>
          {isAdminMode && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              <ShieldCheck className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">
                Admin mode &mdash; editing <strong>{vendorName}</strong>.{" "}
                <Link to={`/vendors/${encodeURIComponent(vendorName)}`} className="underline hover:no-underline">
                  View public profile
                </Link>
              </span>
              <button
                onClick={() => setAdminVendorView(!adminVendorView)}
                className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  adminVendorView
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : "bg-white text-amber-700 border border-amber-300 hover:bg-amber-100"
                }`}
              >
                {adminVendorView ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {adminVendorView ? "Vendor View" : "Full Access"}
              </button>
            </div>
          )}
          {renderSection("intelligence", <VendorCommandCenter vendorName={vendorName} />)}
          {renderSection("overview", <DashboardOverview vendorName={vendorName} onNavigate={setActiveSection} />)}
          {renderSection("segments", <DashboardSegments vendorName={vendorName} />)}
          {renderSection("mentions", <DashboardMentions vendorName={vendorName} vendorProfileId={vendorProfile.id} />)}
          {renderSection("profile", <DashboardEditProfile vendorProfileId={isAdminMode ? vendorProfile.id : undefined} />)}
          {renderSection("intel", <DashboardIntel vendorName={vendorName} />)}
          {renderSection("dimensions", <DashboardDimensions vendorName={vendorName} />)}
          {renderSection("demo-requests", <DashboardDemoRequests vendorName={vendorName} />)}
          {renderSection("screenshots", <DashboardScreenshots vendorName={vendorName} />)}
          {renderSection("categories", <DashboardCategories vendorName={vendorName} />)}
          {renderSection("dealer-signals", <DashboardDealerSignals vendorName={vendorName} />)}
        </div>
      </VendorDashboardLayout>

      {/* Floating AI chat — persists across all tabs */}
      <DashboardAIChat vendorName={vendorName} dashboardIntel={dashboardIntel ?? null} />
    </>
  );
}
