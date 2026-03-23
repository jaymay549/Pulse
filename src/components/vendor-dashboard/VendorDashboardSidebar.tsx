import { BarChart3, MessageSquare, Layers, Pencil, TrendingUp, ExternalLink, ArrowLeft, Activity, PieChart, CalendarCheck, Image, Tags, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardSection } from "./VendorDashboardLayout";

interface VendorDashboardSidebarProps {
  vendorName: string;
  activeSection: DashboardSection;
  onNavigate: (section: DashboardSection) => void;
}

const navItems: { id: DashboardSection; icon: typeof BarChart3; label: string }[] = [
  { id: "intelligence", icon: Activity, label: "Intelligence" },
  { id: "overview", icon: BarChart3, label: "Overview" },
  { id: "segments", icon: PieChart, label: "Segments" },
  { id: "mentions", icon: MessageSquare, label: "Mentions" },
  { id: "dimensions", icon: Layers, label: "Dimensions" },
  { id: "dealer-signals", icon: Users, label: "Dealer Signals" },
  { id: "intel", icon: TrendingUp, label: "Market Intel" },
  { id: "demo-requests", icon: CalendarCheck, label: "Demo Requests" },
  { id: "screenshots", icon: Image, label: "Screenshots" },
  { id: "categories", icon: Tags, label: "Categories" },
  { id: "profile", icon: Pencil, label: "Edit Profile" },
];

export function VendorDashboardSidebar({ vendorName, activeSection, onNavigate }: VendorDashboardSidebarProps) {
  return (
    <aside className="w-56 border-r bg-white flex flex-col h-full">
      <div className="p-4 border-b">
        <p className="text-sm font-semibold text-slate-900 truncate">{vendorName}</p>
        <p className="text-xs text-slate-500 mt-0.5">Vendor Dashboard</p>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
              activeSection === id
                ? "bg-slate-100 text-slate-900"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      <div className="p-2 border-t space-y-0.5">
        <a
          href={`/vendors/${encodeURIComponent(vendorName)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          View as Member
        </a>
        <a
          href="/vendors"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to CDG Pulse
        </a>
      </div>
    </aside>
  );
}
