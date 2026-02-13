import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SignIn } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import cdgPulseLogo from "@/assets/cdg-pulse-logo.png";
import VendorPricingTiers from "@/components/vendors/VendorPricingTiers";
import { WAM_URL } from "@/config/wam";
import { useClerkAuth } from "@/hooks/useClerkAuth";

const VendorBeta = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fakeSignout = searchParams.get("fake_signout") === "true";
  const { isAuthenticated, isLoading: isAuthLoading } = useClerkAuth();
  const [showSignIn, setShowSignIn] = useState(false);
  const [totalReviews, setTotalReviews] = useState(500);
  const [totalWarnings, setTotalWarnings] = useState(100);

  // Signed-in users go straight to /vendors (unless ?fake_signout=true)
  useEffect(() => {
    if (!fakeSignout && !isAuthLoading && isAuthenticated) {
      navigate("/vendors", { replace: true });
    }
  }, [fakeSignout, isAuthLoading, isAuthenticated, navigate]);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await fetch(
          `${WAM_URL}/api/public/vendor-pulse/mentions?pageSize=1&page=1`,
        );
        if (res.ok) {
          const data = await res.json();
          if (typeof data.totalCount === "number")
            setTotalReviews(data.totalCount);
          if (typeof data.totalWarningCount === "number")
            setTotalWarnings(data.totalWarningCount);
        }
      } catch {
        // Use defaults
      }
    };
    fetchCounts();
  }, []);

  if (!fakeSignout && (isAuthLoading || isAuthenticated)) {
    return (
      <div className="min-h-screen bg-[hsl(var(--vendor-bg))] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Vendor Pulse | CDG Circles - Features & Pricing</title>
        <meta
          name="description"
          content="Monitor what dealers are saying about your company. Real-time vendor intelligence from verified automotive dealers. View pricing and features."
        />
      </Helmet>

      <div className="min-h-screen bg-[hsl(var(--vendor-bg))]">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/vendors")}
                  className="h-9 w-9"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Link to="/" className="flex items-center">
                  <img src={cdgPulseLogo} alt="CDG Pulse" className="h-7" />
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 sm:pt-8 sm:pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/20 border border-secondary/30 text-xs font-semibold text-yellow-800 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
            </span>
            Vendor Portal Beta
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground mb-4 leading-[1.1] tracking-tight">
            See What Dealers Are{" "}
            <span className="text-yellow-600">Really Saying</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mb-6 max-w-2xl leading-relaxed">
            Unfiltered vendor reviews from verified auto dealers. No paid
            placements—just honest experiences. Monitor your brand, respond to
            feedback, and grow.
          </p>
        </section>

        {/* Pricing Tiers */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <VendorPricingTiers
            totalReviews={totalReviews}
            totalWarnings={totalWarnings}
            onSignInClick={() => setShowSignIn(true)}
          />
        </section>

        {/* Footer */}
        <footer className="py-6 border-t border-border bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center gap-4">
              <Link
                to="/vendors"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back to Vendor Reviews
              </Link>
              <p className="text-xs text-muted-foreground/70">
                © {new Date().getFullYear()} Car Dealership Guy
              </p>
            </div>
          </div>
        </footer>
      </div>

      {/* Sign In Modal */}
      <Dialog open={showSignIn} onOpenChange={setShowSignIn}>
        <DialogContent
          className="p-0 border-0 bg-transparent shadow-none sm:max-w-md [&>button]:hidden"
          onPointerDownOutside={() => setShowSignIn(false)}
        >
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto">
            <SignIn
              appearance={{
                elements: {
                  rootBox: "w-full flex justify-center",
                  card: "w-full max-w-md border-0 shadow-none",
                },
              }}
              fallbackRedirectUrl="/vendors"
              signUpFallbackRedirectUrl="/vendors"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VendorBeta;
