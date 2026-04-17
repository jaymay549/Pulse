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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardSection } from "./VendorDashboardLayout";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVendorWebsites } from "@/hooks/useVendorWebsites";
import { useTierConfigReadonly, getVisibility } from "@/hooks/useTierConfig";
import type { VendorTier } from "@/types/tier-config";

interface VendorDashboardSidebarProps {
  vendorName: string;
  activeSection: DashboardSection;
  onNavigate: (section: DashboardSection) => void;
  tier?: string;
}


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
  const { configs: tierConfigs } = useTierConfigReadonly();

  return (
    <aside className="w-60 bg-white border-r border-slate-200 flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={vendorName}
              className="h-9 w-9 rounded-lg object-contain bg-white ring-1 ring-slate-200 shadow-sm"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <Activity className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">{vendorName}</p>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Control Center
            </p>
          </div>
        </div>
      </div>

      <Separator className="bg-slate-100" />

      {/* Nav */}
      <ScrollArea className="flex-1">
        <nav className="px-3 py-4 space-y-6">
          {navGroups.map((group) => {
            const filteredItems = group.items.filter((item) => {
              // No tier (admin mode) — show everything
              if (!tier) return true;
              const vis = getVisibility(tierConfigs, tier as VendorTier, item.id);
              return vis !== "hidden";
            });
            if (filteredItems.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {filteredItems.map(({ id, icon: Icon, label }) => {
                    const isActive = activeSection === id;
                    return (
                      <button
                        key={id}
                        onClick={() => onNavigate(id)}
                        className={cn(
                          "group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors text-left",
                          isActive
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 flex-shrink-0 transition-colors",
                            isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600",
                          )}
                        />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-slate-100 space-y-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={`/vendors/${encodeURIComponent(vendorName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              View as Member
            </a>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            Open public vendor profile
          </TooltipContent>
        </Tooltip>
        <a
          href="/vendors"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to CDG Pulse
        </a>
      </div>
    </aside>
  );
}
