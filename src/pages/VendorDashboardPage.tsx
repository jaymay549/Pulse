import { useState } from "react";
import { Navigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { useVendorSupabaseAuth } from "@/hooks/useVendorSupabaseAuth";
import { vendorSupabase } from "@/integrations/supabase/vendorClient";
import { supabase } from "@/integrations/supabase/client";
import { ActiveProductLineProvider, useActiveProductLine } from "@/hooks/useActiveProductLine";

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
import { VendorTierProvider } from "@/components/vendor-dashboard/GatedCard";
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

// ── Inner component: consumes ActiveProductLineContext ──────────────────────
// Must be rendered inside ActiveProductLineProvider so useActiveProductLine() works.

interface VendorDashboardInnerProps {
  vendorName: string;
  vendorProfile: VendorProfileRow;
  vendorLoginProfile: { vendor_name: string; tier: string } | null | undefined;
  resolvedTier: string | null | undefined;
  tierConfigs: ReturnType<typeof useTierConfigReadonly>["configs"];
  isAdminMode: boolean;
  adminVendorView: boolean;
  setAdminVendorView: (v: boolean) => void;
  activeSection: DashboardSection;
  setActiveSection: (s: DashboardSection) => void;
  dashboardIntel: any;
  isVendorAuth: boolean;
}

function VendorDashboardInner({
  vendorName,
  vendorProfile,
  vendorLoginProfile,
  resolvedTier,
  tierConfigs,
  isAdminMode,
  adminVendorView,
  setAdminVendorView,
  activeSection,
  setActiveSection,
  dashboardIntel,
}: VendorDashboardInnerProps) {
  const { activeProductLine } = useActiveProductLine();

  // Tier resolution priority (per D-02, D-12):
  // 1. Admin full-access mode: undefined (sees everything)
  // 2. Product-specific tier (when product line is active) — per D-12
  // 3. Account-level tier from vendor_logins.tier — per D-02 fallback
  // 4. Resolved tier from RPC lookup
  const vendorTier = (isAdminMode && !adminVendorView)
    ? undefined
    : activeProductLine?.tier
      || vendorLoginProfile?.tier
      || resolvedTier
      || undefined;

  const renderSection = (sectionKey: string, component: React.ReactNode) => {
    if (activeSection !== sectionKey) return null;
    const vis = getSectionVisibility(tierConfigs, vendorTier, sectionKey);
    if (vis === "hidden") return null;
    return component;
  };

  return (
    <>
      <VendorTierProvider value={vendorTier}>
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
      </VendorTierProvider>

      {/* Floating AI chat — persists across all tabs */}
      <DashboardAIChat vendorName={vendorName} dashboardIntel={dashboardIntel ?? null} />
    </>
  );
}

// ── Main page component ─────────────────────────────────────────────────────

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

  // Resolve vendor tier via fuzzy-match RPC (handles name mismatches between tables).
  // Enabled for: admin vendor-view mode, and Clerk-authenticated vendor owners.
  // Magic-link sessions already have the tier from vendorLoginProfile.
  const needsTierLookup = (isAdminMode && adminVendorView && !!vendorName)
    || (!isAdminMode && !isVendorAuth && !!vendorName);
  const { data: resolvedTier } = useQuery({
    queryKey: ["vendor-tier-lookup", vendorName],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_vendor_tier", {
        p_vendor_name: vendorName,
      });
      if (error) {
        console.error("[VendorDashboard] tier lookup error:", error);
        return null;
      }
      return data as string | null;
    },
    enabled: needsTierLookup,
    staleTime: 5 * 60 * 1000,
  });

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

  return (
    <ActiveProductLineProvider isVendorAuth={isVendorAuth} vendorUserId={vendorUser?.id}>
      <VendorDashboardInner
        vendorName={vendorName}
        vendorProfile={vendorProfile!}
        vendorLoginProfile={vendorLoginProfile}
        resolvedTier={resolvedTier}
        tierConfigs={tierConfigs}
        isAdminMode={isAdminMode}
        adminVendorView={adminVendorView}
        setAdminVendorView={setAdminVendorView}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        dashboardIntel={dashboardIntel}
        isVendorAuth={isVendorAuth}
      />
    </ActiveProductLineProvider>
  );
}
