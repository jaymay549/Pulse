import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { DashboardOverview } from "@/components/vendor-dashboard/DashboardOverview";
import { DashboardMentions } from "@/components/vendor-dashboard/DashboardMentions";
import { DashboardEditProfile } from "@/components/vendor-dashboard/DashboardEditProfile";
import { DashboardIntel } from "@/components/vendor-dashboard/DashboardIntel";
import { DashboardDimensions } from "@/components/vendor-dashboard/DashboardDimensions";
import { VendorDashboardLayout, type DashboardSection } from "@/components/vendor-dashboard/VendorDashboardLayout";

export default function VendorDashboardPage() {
  const supabase = useClerkSupabase();
  const { user, isAuthenticated, isLoading: authLoading } = useClerkAuth();
  const [activeSection, setActiveSection] = useState<DashboardSection>("overview");

  const { data: vendorProfile, isLoading } = useQuery({
    queryKey: ["my-vendor-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_profiles")
        .select("id, vendor_name, is_approved")
        .eq("user_id", user!.id)
        .eq("is_approved", true)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; vendor_name: string; is_approved: boolean } | null;
    },
    enabled: isAuthenticated && !!user?.id,
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isAuthenticated || !vendorProfile) {
    return <Navigate to="/vendors" replace />;
  }

  const vendorName = vendorProfile.vendor_name;

  return (
    <VendorDashboardLayout vendorName={vendorName} activeSection={activeSection} onNavigate={setActiveSection}>
      <div className="max-w-5xl">
        {activeSection === "overview" && <DashboardOverview vendorName={vendorName} onNavigate={setActiveSection} />}
        {activeSection === "mentions" && <DashboardMentions vendorName={vendorName} />}
        {activeSection === "profile" && <DashboardEditProfile />}
        {activeSection === "intel" && <DashboardIntel vendorName={vendorName} />}
        {activeSection === "dimensions" && <DashboardDimensions vendorName={vendorName} />}
      </div>
    </VendorDashboardLayout>
  );
}
