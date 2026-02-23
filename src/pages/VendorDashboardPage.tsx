import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { useClerkAuth } from "@/hooks/useClerkAuth";
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
        {activeSection === "overview" && <p className="text-slate-500">Overview coming next...</p>}
        {activeSection === "mentions" && <p className="text-slate-500">Mentions coming next...</p>}
        {activeSection === "profile" && <p className="text-slate-500">Profile editor coming next...</p>}
        {activeSection === "intel" && <p className="text-slate-500">Market intel coming next...</p>}
      </div>
    </VendorDashboardLayout>
  );
}
