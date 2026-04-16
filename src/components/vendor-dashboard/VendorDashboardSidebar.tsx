import { 
  BarChart3, 
  MessageSquare, 
  Layers, 
  Pencil, 
  TrendingUp, 
  ExternalLink, 
  ArrowLeft, 
  Activity, 
  PieChart, 
  CalendarCheck, 
  Image, 
  Tags, 
  Users,
  LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardSection } from "./VendorDashboardLayout";
import { Separator } from "@/components/ui/separator";
import { useVendorWebsites } from "@/hooks/useVendorWebsites";

interface VendorDashboardSidebarProps {
  vendorName: string;
  activeSection: DashboardSection;
  onNavigate: (section: DashboardSection) => void;
  tier?: string; // 'unverified' | 'tier_1' | 'tier_2' | undefined (admin mode)
}

const T2_ONLY_SECTIONS: DashboardSection[] = [
  "mentions",
  "dimensions",
  "dealer-signals",
  "demo-requests",
];

interface NavGroup {
  label: string;
  items: { id: DashboardSection; icon: any; label: string }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Analytics & Insights",
    items: [
      { id: "intelligence", icon: Activity, label: "Intelligence" },
      { id: "overview", icon: BarChart3, label: "Overview" },
      { id: "segments", icon: PieChart, label: "Segments" },
      { id: "intel", icon: TrendingUp, label: "Market Intel" },
    ],
  },
  {
    label: "Engagement & Activity",
    items: [
      { id: "mentions", icon: MessageSquare, label: "Discussions" },
      { id: "dealer-signals", icon: Users, label: "Dealer Signals" },
      { id: "demo-requests", icon: CalendarCheck, label: "Demo Requests" },
    ],
  },
  {
    label: "Presence & Catalog",
    items: [
      { id: "dimensions", icon: Layers, label: "Dimensions" },
      { id: "categories", icon: Tags, label: "Categories" },
      { id: "screenshots", icon: Image, label: "Screenshots" },
      { id: "profile", icon: Pencil, label: "Edit Profile" },
    ],
  },
];

export function VendorDashboardSidebar({ vendorName, activeSection, onNavigate, tier }: VendorDashboardSidebarProps) {
  const { getLogoForVendor } = useVendorWebsites();
  const logoUrl = getLogoForVendor(vendorName);

  // When tier is provided and not tier_2, hide T2-only sections.
  // When tier is undefined (admin mode), show all sections.
  const shouldHideT2 = tier && tier !== "tier_2";

  return (
    <aside className="w-64 border-r bg-white flex flex-col h-full overflow-hidden">
      {/* Brand area */}
      <div className="px-6 py-5">
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt={vendorName} className="h-8 w-8 rounded-lg object-contain bg-white ring-1 ring-slate-200 shadow-sm" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-600/10">
              <LayoutDashboard className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 truncate leading-tight">{vendorName}</p>
            <p className="text-[10px] font-medium text-slate-300 uppercase tracking-wider mt-0.5">Control Center</p>
          </div>
        </div>
      </div>

      <Separator className="bg-slate-100" />

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-8 custom-scrollbar">
        {navGroups.map((group) => {
          const filteredItems = group.items.filter(
            item => !shouldHideT2 || !T2_ONLY_SECTIONS.includes(item.id)
          );
          if (filteredItems.length === 0) return null;
          return (
          <div key={group.label} className="space-y-1.5">
            <h3 className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              {group.label}
            </h3>
            <div className="space-y-0.5">
              {filteredItems.map(({ id, icon: Icon, label }) => {
                const isActive = activeSection === id;
                return (
                  <button
                    key={id}
                    onClick={() => onNavigate(id)}
                    className={cn(
                      "group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 text-left relative",
                      isActive
                        ? "bg-indigo-50/60 text-indigo-700 border-l-2 border-indigo-500 pl-[10px]"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-l-2 border-transparent pl-[10px]"
                    )}
                  >
                    <Icon className={cn(
                      "h-[18px] w-[18px] flex-shrink-0 transition-colors",
                      isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                    )} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          );
        })}
      </nav>

      {/* Footer area */}
      <div className="p-4 bg-slate-50/50 border-t border-slate-100 space-y-1">
        <a
          href={`/vendors/${encodeURIComponent(vendorName)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all duration-200"
        >
          <ExternalLink className="h-4 w-4 text-slate-400" />
          View as Member
        </a>
        <a
          href="/vendors"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all duration-200"
        >
          <ArrowLeft className="h-4 w-4 text-slate-400" />
          Back to CDG Pulse
        </a>
      </div>
    </aside>
  );
}
