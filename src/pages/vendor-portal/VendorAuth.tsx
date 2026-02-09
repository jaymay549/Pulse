import { SignIn, useAuth } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";

export default function VendorAuth() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;

  if (isSignedIn) {
    return <Navigate to="/vendor-portal/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Vendor Portal</h1>
          <p className="mt-2 text-zinc-400">
            Sign in to access your vendor dashboard and see what dealers are saying about your brand.
          </p>
        </div>
        <SignIn
          routing="virtual"
          redirectUrl="/vendor-portal/dashboard"
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-zinc-900 border-zinc-800",
            },
          }}
        />
      </div>
    </div>
  );
}
