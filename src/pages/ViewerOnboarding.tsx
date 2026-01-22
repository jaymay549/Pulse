import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Eye, CheckCircle, ArrowRight, Search, Bell, TrendingUp, Sparkles } from "lucide-react";
import cdgPulseLogo from "@/assets/cdg-pulse-logo.png";

const ViewerOnboarding = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative py-6 px-4 border-b border-border">
        <div className="max-w-4xl mx-auto flex items-center justify-center">
          <img src={cdgPulseLogo} alt="CDG Pulse" className="h-8" />
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-2xl mx-auto px-4 py-12 sm:py-20">
        {/* Success Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-100 border border-green-200 text-green-700 font-medium">
            <CheckCircle className="h-5 w-5" />
            <span>Payment Successful</span>
          </div>
        </div>

        {/* Welcome Message */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-secondary/10 border border-secondary/20 mb-6">
            <Eye className="h-10 w-10 text-secondary" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground mb-4 tracking-tight">
            Welcome to{" "}
            <span className="text-secondary">
              Vendor Pulse
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-md mx-auto leading-relaxed">
            You now have full access to dealer insights on automotive vendors and partners.
          </p>
        </div>

        {/* What's Included Card */}
        <div className="bg-card rounded-3xl border border-border p-8 sm:p-10 mb-10 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="h-5 w-5 text-secondary" />
            <h2 className="text-xl font-bold text-foreground">What's Included</h2>
          </div>
          <ul className="space-y-5">
            <li className="flex items-start gap-4 group">
              <div className="p-3 rounded-xl bg-secondary/10 border border-secondary/20 shrink-0 group-hover:scale-105 transition-transform">
                <Search className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">Full Search Access</p>
                <p className="text-muted-foreground">Search all vendor reviews, warnings, and dealer feedback</p>
              </div>
            </li>
            <li className="flex items-start gap-4 group">
              <div className="p-3 rounded-xl bg-secondary/10 border border-secondary/20 shrink-0 group-hover:scale-105 transition-transform">
                <Bell className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">Read All Reviews</p>
                <p className="text-muted-foreground">Access every dealer review, warning, and recommendation</p>
              </div>
            </li>
            <li className="flex items-start gap-4 group">
              <div className="p-3 rounded-xl bg-secondary/10 border border-secondary/20 shrink-0 group-hover:scale-105 transition-transform">
                <TrendingUp className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">Market Intelligence</p>
                <p className="text-muted-foreground">Track competitor mentions and industry trends</p>
              </div>
            </li>
          </ul>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button
            size="lg"
            variant="yellow"
            className="font-bold px-10 py-6 text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
            onClick={() => navigate("/vendors")}
          >
            Start Exploring Vendor Pulse
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
          <p className="text-sm text-muted-foreground mt-6">
            Check your email for login instructions
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative py-8 px-4 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            Questions? Email us at{" "}
            <a href="mailto:support@cdgcircles.com" className="text-secondary hover:underline">
              support@cdgcircles.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ViewerOnboarding;