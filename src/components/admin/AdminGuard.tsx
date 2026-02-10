import { Navigate } from "react-router-dom";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { Loader2 } from "lucide-react";

interface AdminGuardProps {
  children: React.ReactNode;
}

const AdminGuard = ({ children }: AdminGuardProps) => {
  const { isLoading, isAuthenticated, isAdmin } = useClerkAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/vendors" replace />;
  }

  return <>{children}</>;
};

export default AdminGuard;
