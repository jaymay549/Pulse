import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { VendorDashboardSidebar } from "./VendorDashboardSidebar";
import { Button } from "@/components/ui/button";
import { VendorProductLineSwitcher } from "./VendorProductLineSwitcher";

export type DashboardSection = "intelligence" | "overview" | "segments" | "mentions" | "profile" | "intel" | "dimensions" | "demo-requests" | "screenshots" | "categories" | "dealer-signals";

interface VendorDashboardLayoutProps {
  vendorName: string;
  activeSection: DashboardSection;
  onNavigate: (section: DashboardSection) => void;
  children: React.ReactNode;
  tier?: string;
}

const sectionLabels: Record<DashboardSection, string> = {
  intelligence: "Intelligence Hub",
  overview: "Dashboard Overview",
  segments: "Market Segments",
  mentions: "Discussions & Feedback",
  intel: "Competitive Intelligence",
  dimensions: "Feature Matrix",
  "dealer-signals": "Dealer Signals",
  "demo-requests": "Demo Requests",
  screenshots: "Visual Gallery",
  categories: "Market Positioning",
  profile: "Account Settings",
};

export function VendorDashboardLayout({ vendorName, activeSection, onNavigate, children, tier }: VendorDashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (section: DashboardSection) => {
    onNavigate(section);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center gap-4">
        {/* Mobile menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-60 bg-white border-slate-200">
            <VendorDashboardSidebar vendorName={vendorName} activeSection={activeSection} onNavigate={handleNavigate} tier={tier} />
          </SheetContent>
        </Sheet>

        {/* Breadcrumb */}
        <div className="flex items-center text-sm">
          <span className="text-slate-400">Dashboard</span>
          <span className="mx-2 text-slate-300">/</span>
          <span className="text-slate-800 font-medium">{sectionLabels[activeSection]}</span>
        </div>

        {/* Product line switcher */}
        <div className="ml-auto">
          <VendorProductLineSwitcher />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 pt-14">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex fixed top-14 bottom-0 w-60 z-30">
          <VendorDashboardSidebar vendorName={vendorName} activeSection={activeSection} onNavigate={handleNavigate} tier={tier} />
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0 lg:pl-60">
          <main className="flex-1 p-6 sm:p-8">
            <div className="max-w-[1200px] mx-auto animate-in fade-in duration-300">
              {children}
            </div>
          </main>

          <footer className="px-8 py-4 text-[11px] text-slate-300 border-t border-slate-100 bg-white">
            © 2026 CDG Pulse · Vendor Control Center
          </footer>
        </div>
      </div>
    </div>
  );
}
