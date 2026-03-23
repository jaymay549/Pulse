import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { VendorDashboardSidebar } from "./VendorDashboardSidebar";

export type DashboardSection = "intelligence" | "overview" | "segments" | "mentions" | "profile" | "intel" | "dimensions" | "demo-requests" | "screenshots" | "categories" | "dealer-signals";

interface VendorDashboardLayoutProps {
  vendorName: string;
  activeSection: DashboardSection;
  onNavigate: (section: DashboardSection) => void;
  children: React.ReactNode;
}

export function VendorDashboardLayout({ vendorName, activeSection, onNavigate, children }: VendorDashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (section: DashboardSection) => {
    onNavigate(section);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="hidden lg:flex">
        <VendorDashboardSidebar vendorName={vendorName} activeSection={activeSection} onNavigate={handleNavigate} />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b px-4 py-3 flex items-center justify-between">
          <SheetTrigger asChild>
            <button className="text-slate-500 hover:text-slate-900">
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <span className="text-sm font-semibold text-slate-900">{vendorName}</span>
          <div className="w-5" />
        </div>
        <SheetContent side="left" className="p-0 w-56">
          <VendorDashboardSidebar vendorName={vendorName} activeSection={activeSection} onNavigate={handleNavigate} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto p-6 lg:pt-6 pt-16">
          {children}
        </main>
      </div>
    </div>
  );
}
