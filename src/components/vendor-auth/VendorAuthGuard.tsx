import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { useVendorSupabaseAuth } from "@/hooks/useVendorSupabaseAuth";

interface VendorAuthGuardProps {
  children: React.ReactNode;
}

const VendorAuthGuard = ({ children }: VendorAuthGuardProps) => {
  const { isLoading: clerkLoading, isAdmin } = useClerkAuth();
  const { isLoading: vendorLoading, isAuthenticated: isVendorAuth } = useVendorSupabaseAuth();

  // Show loading while either auth system is initializing
  if (clerkLoading || vendorLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading..." />
      </div>
    );
  }

  // AUTH-05: Admin bypass — Clerk admin can always access vendor dashboard
  if (isAdmin) return <>{children}</>;

  // AUTH-04: Vendor auth — valid vendor Supabase session passes
  if (isVendorAuth) return <>{children}</>;

  // Neither: redirect to vendor login
  return <Navigate to="/vendor-login" replace />;
};

export default VendorAuthGuard;
