import { useState, useEffect } from "react";
import {
  Loader2,
  Eye,
  Lock,
  EyeOff,
  Activity,
  BarChart3,
  PieChart,
  TrendingUp,
  MessageSquare,
  Users,
  CalendarCheck,
  Layers,
  Tags,
  Image,
  Pencil,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useTierConfig, getVisibility } from "@/hooks/useTierConfig";
import {
  DASHBOARD_COMPONENTS,
  TIER_LABELS,
  type VendorTier,
  type ComponentVisibility,
} from "@/types/tier-config";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { VendorCommandCenter } from "@/components/vendor-dashboard/VendorCommandCenter";
import { DashboardOverview } from "@/components/vendor-dashboard/DashboardOverview";
import { DashboardSegments } from "@/components/vendor-dashboard/DashboardSegments";
import { DashboardIntel } from "@/components/vendor-dashboard/DashboardIntel";
import { DashboardMentions } from "@/components/vendor-dashboard/DashboardMentions";
import { DashboardDimensions } from "@/components/vendor-dashboard/DashboardDimensions";
import { DashboardDemoRequests } from "@/components/vendor-dashboard/DashboardDemoRequests";
import { DashboardDealerSignals } from "@/components/vendor-dashboard/DashboardDealerSignals";
import { DashboardScreenshots } from "@/components/vendor-dashboard/DashboardScreenshots";
import { DashboardCategories } from "@/components/vendor-dashboard/DashboardCategories";
import { DashboardEditProfile } from "@/components/vendor-dashboard/DashboardEditProfile";

const TIERS: VendorTier[] = ["tier_1", "tier_2", "test"];
const GROUPS = [...new Set(DASHBOARD_COMPONENTS.map((c) => c.group))];

const COMPONENT_ICONS: Record<string, any> = {
  intelligence: Activity,
  overview: BarChart3,
  segments: PieChart,
  intel: TrendingUp,
  mentions: MessageSquare,
  "dealer-signals": Users,
  "demo-requests": CalendarCheck,
  dimensions: Layers,
  categories: Tags,
  screenshots: Image,
  profile: Pencil,
};

const VIS_NAV_STYLE: Record<ComponentVisibility, string> = {
  full: "text-zinc-200",
  gated: "text-amber-400/80",
  hidden: "text-zinc-600 line-through",
};

const VIS_DOT: Record<ComponentVisibility, string> = {
  full: "bg-emerald-400",
  gated: "bg-amber-400",
  hidden: "bg-red-400/40",
};

type Vis = ComponentVisibility;

const VIS_WIRE: Record<Vis, { bg: string; border: string; text: string; badge: string }> = {
  full: {
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  gated: {
    bg: "bg-amber-500/5",
    border: "border-amber-500/20",
    text: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  hidden: {
    bg: "bg-red-500/5",
    border: "border-red-500/15",
    text: "text-red-400/40",
    badge: "bg-red-500/10 text-red-400/50 border-red-500/20",
  },
};

function VisBadge({ vis }: { vis: Vis }) {
  const Icon = vis === "full" ? Eye : vis === "gated" ? Lock : EyeOff;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border ${VIS_WIRE[vis].badge}`}>
      <Icon className="h-2.5 w-2.5" />
      {vis}
    </span>
  );
}

// ── Preview Content ────────────────────────────────────────────────────

function PreviewContent({
  componentKey,
  configs,
  tier,
  vendorName,
  vendorProfileId,
  onNavigate,
}: {
  componentKey: string;
  configs: any[];
  tier: VendorTier;
  vendorName: string;
  vendorProfileId: string;
  onNavigate: (section: string) => void;
}) {
  const component = DASHBOARD_COMPONENTS.find((c) => c.key === componentKey);
  if (!component) return null;

  const pageVis = getVisibility(configs, tier, component.key);
  const StatusIcon = pageVis === "full" ? Eye : pageVis === "gated" ? Lock : EyeOff;

  if (!vendorName) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-600">
        <BarChart3 className="h-10 w-10" />
        <p className="text-sm">Select a vendor to preview their dashboard</p>
      </div>
    );
  }

  if (pageVis === "hidden") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-600">
        <EyeOff className="h-10 w-10" />
        <p className="text-sm">This page is hidden for {TIER_LABELS[tier]}</p>
      </div>
    );
  }

  const renderComponent = () => {
    if (componentKey === "profile") {
      return <DashboardEditProfile vendorProfileId={vendorProfileId} />;
    }
    if (componentKey === "intelligence") {
      return <VendorCommandCenter vendorName={vendorName} />;
    }
    if (componentKey === "overview") {
      return <DashboardOverview vendorName={vendorName} onNavigate={onNavigate} />;
    }
    if (componentKey === "segments") {
      return <DashboardSegments vendorName={vendorName} />;
    }
    if (componentKey === "intel") {
      return <DashboardIntel vendorName={vendorName} />;
    }
    if (componentKey === "mentions") {
      return <DashboardMentions vendorName={vendorName} vendorProfileId={vendorProfileId} />;
    }
    if (componentKey === "dealer-signals") {
      return <DashboardDealerSignals vendorName={vendorName} />;
    }
    if (componentKey === "demo-requests") {
      return <DashboardDemoRequests vendorName={vendorName} />;
    }
    if (componentKey === "dimensions") {
      return <DashboardDimensions vendorName={vendorName} />;
    }
    if (componentKey === "screenshots") {
      return <DashboardScreenshots vendorName={vendorName} />;
    }
    if (componentKey === "categories") {
      return <DashboardCategories vendorName={vendorName} />;
    }
    return null;
  };

  const componentNode = renderComponent();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 mb-4">
        <StatusIcon className={`h-4 w-4 ${VIS_WIRE[pageVis].text}`} />
        <span className="text-lg font-medium text-zinc-200">{component.label}</span>
        <VisBadge vis={pageVis} />
      </div>

      {pageVis === "gated" ? (
        <div className="relative">
          <div className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border bg-amber-500/15 text-amber-400 border-amber-500/30">
            <Lock className="h-3 w-3" /> Gated
          </div>
          {componentNode}
        </div>
      ) : (
        componentNode
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

const TierPreviewPage = () => {
  const { configs, isLoading, error } = useTierConfig();
  const [previewTier, setPreviewTier] = useState<VendorTier>("tier_1");
  const [activeSection, setActiveSection] = useState<string>("intelligence");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");

  const supabase = useClerkSupabase();

  const { data: vendors = [] } = useQuery({
    queryKey: ["tier-preview-vendors"],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("vendor_profiles")
        .select("id, vendor_name")
        .order("vendor_name");
      if (queryError) throw queryError;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Default to first vendor when vendors load
  useEffect(() => {
    if (vendors.length > 0 && !selectedVendorId) {
      setSelectedVendorId(vendors[0].id);
    }
  }, [vendors, selectedVendorId]);

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);
  const selectedVendorName = selectedVendor?.vendor_name ?? "";
  const selectedVendorProfileId = selectedVendor?.id ?? "";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <p className="text-red-400 text-sm">Failed to load tier configuration.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Tier Preview</h1>
          <p className="text-sm text-zinc-500 mt-1">
            See what the vendor dashboard looks like for each tier
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
            <SelectTrigger className="w-56 h-9 bg-zinc-800 border-zinc-700 text-zinc-300">
              <SelectValue placeholder="Select vendor..." />
            </SelectTrigger>
            <SelectContent>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={previewTier} onValueChange={(v: VendorTier) => setPreviewTier(v)}>
            <SelectTrigger className="w-44 h-9 bg-zinc-800 border-zinc-700 text-zinc-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIERS.map((t) => (
                <SelectItem key={t} value={t}>{TIER_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <motion.div
        className="flex-1 rounded-xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden flex"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Sidebar */}
        <div className="w-52 border-r border-zinc-800/40 py-4 flex flex-col gap-1 bg-zinc-900/80 overflow-y-auto">
          {GROUPS.map((group) => {
            const components = DASHBOARD_COMPONENTS.filter((c) => c.group === group);
            return (
              <div key={group} className="px-3 mb-3">
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider px-2.5 mb-2">
                  {group}
                </p>
                {components.map((c) => {
                  const vis = getVisibility(configs, previewTier, c.key);
                  const Icon = COMPONENT_ICONS[c.key];
                  const isActive = activeSection === c.key;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setActiveSection(c.key)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] transition-all ${
                        isActive
                          ? "bg-zinc-800 " + VIS_NAV_STYLE[vis]
                          : VIS_NAV_STYLE[vis] + " hover:bg-zinc-800/50"
                      }`}
                    >
                      {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />}
                      <span className="truncate flex-1 text-left">{c.label}</span>
                      <div className="flex items-center gap-0.5 ml-auto">
                        {TIERS.map((t) => (
                          <div
                            key={t}
                            className={`h-1.5 w-1.5 rounded-full ${VIS_DOT[getVisibility(configs, t, c.key)]} ${t === previewTier ? "ring-1 ring-white/30" : ""}`}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeSection}-${previewTier}-${selectedVendorId}`}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
            >
              <PreviewContent
                componentKey={activeSection}
                configs={configs}
                tier={previewTier}
                vendorName={selectedVendorName}
                vendorProfileId={selectedVendorProfileId}
                onNavigate={setActiveSection}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default TierPreviewPage;
