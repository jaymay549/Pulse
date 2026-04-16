import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { VendorDashboardSidebar } from "./VendorDashboardSidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DashboardSection = "intelligence" | "overview" | "segments" | "mentions" | "profile" | "intel" | "dimensions" | "demo-requests" | "screenshots" | "categories" | "dealer-signals";

interface VendorDashboardLayoutProps {
  vendorName: string;
  activeSection: DashboardSection;
  onNavigate: (section: DashboardSection) => void;
  children: React.ReactNode;
  tier?: string;
}

export function VendorDashboardLayout({ vendorName, activeSection, onNavigate, children, tier }: VendorDashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (section: DashboardSection) => {
    onNavigate(section);
    setMobileOpen(false);
  };

  // Map section ID to a display label
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

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col font-sans antialiased text-slate-900">
      {/* Top Header — full width, always on top */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Mobile Menu Trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden -ml-2 text-slate-500">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <VendorDashboardSidebar vendorName={vendorName} activeSection={activeSection} onNavigate={handleNavigate} tier={tier} />
            </SheetContent>
          </Sheet>

          {/* Breadcrumb / Title */}
          <div className="flex items-center text-sm font-medium">
            <span className="text-slate-300">Dashboard</span>
            <span className="mx-2 text-slate-200">/</span>
            <span className="text-slate-900 font-semibold">{sectionLabels[activeSection]}</span>
          </div>
        </div>
      </header>

      {/* Body: sidebar + content side by side, below the header */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar — below header, scrolls independently */}
        <div className="hidden lg:flex fixed top-[53px] bottom-0 w-64 border-r bg-white shadow-sm z-30">
          <VendorDashboardSidebar vendorName={vendorName} activeSection={activeSection} onNavigate={handleNavigate} tier={tier} />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
          {/* Page Content */}
          <main className="flex-1 p-6 sm:p-8 lg:p-10">
            <div className="max-w-[1200px] mx-auto animate-in fade-in duration-300">
              {children}
            </div>
          </main>

          {/* Footer */}
          <footer className="px-8 py-5 text-[11px] text-slate-300 border-t bg-white">
            <p>© 2026 CDG Pulse · Vendor Control Center</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
