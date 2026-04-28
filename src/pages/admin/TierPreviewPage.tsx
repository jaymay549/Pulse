import { useState, useEffect, useMemo, useRef } from "react";
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
  ExternalLink,
  Search,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
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

// Section order matching the real vendor dashboard sidebar
const SECTION_ORDER = [
  "intelligence",
  "overview",
  "segments",
  "intel",
  "mentions",
  "dealer-signals",
  "demo-requests",
  "dimensions",
  "categories",
  "screenshots",
  "profile",
];

const SECTION_LABELS: Record<string, string> = {
  intelligence: "Intelligence Hub",
  overview: "Dashboard Overview",
  segments: "Market Segments",
  intel: "Competitive Intelligence",
  mentions: "Discussions & Feedback",
  "dealer-signals": "Dealer Signals",
  "demo-requests": "Demo Requests",
  dimensions: "Feature Matrix",
  categories: "Market Positioning",
  screenshots: "Visual Gallery",
  profile: "Account Settings",
};

// ── Section wrapper with visibility overlay ──────────────────────────

function SectionPreview({
  sectionKey,
  vis,
  tierLabel,
  vendorName,
  vendorProfileId,
}: {
  sectionKey: string;
  vis: ComponentVisibility;
  tierLabel: string;
  vendorName: string;
  vendorProfileId: string;
}) {
  const Icon = COMPONENT_ICONS[sectionKey];
  const label = SECTION_LABELS[sectionKey] || sectionKey;

  const visColors = {
    full: { border: "border-emerald-500/20", bg: "bg-emerald-500/5", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    gated: { border: "border-amber-500/30", bg: "bg-amber-500/5", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    hidden: { border: "border-red-500/20", bg: "bg-red-500/5", badge: "bg-red-500/10 text-red-400/60 border-red-500/20" },
  };
  const colors = visColors[vis];
  const VisIcon = vis === "full" ? Eye : vis === "gated" ? Lock : EyeOff;

  return (
    <div className={`rounded-xl border ${colors.border} overflow-hidden`}>
      {/* Section header bar */}
      <div className={`flex items-center gap-2.5 px-4 py-2.5 ${colors.bg}`}>
        {Icon && <Icon className="h-4 w-4 text-zinc-400" />}
        <span className="text-sm font-medium text-zinc-200 flex-1">{label}</span>
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border ${colors.badge}`}>
          <VisIcon className="h-3 w-3" />
          {vis === "full" ? "Full Access" : vis === "gated" ? "Gated" : "Hidden"}
        </span>
      </div>

      {/* Section content */}
      {vis === "hidden" ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-600 bg-zinc-900/30">
          <EyeOff className="h-8 w-8 opacity-40" />
          <p className="text-xs">Hidden for {tierLabel}</p>
        </div>
      ) : (
        <div className="relative bg-[#F9FAFB] rounded-b-xl">
          {vis === "gated" && (
            <div className="absolute inset-0 z-10 bg-amber-500/[0.03] pointer-events-none border-t border-amber-500/10" />
          )}
          <div className="p-4">
            <SectionComponent sectionKey={sectionKey} vendorName={vendorName} vendorProfileId={vendorProfileId} />
          </div>
        </div>
      )}
    </div>
  );
}

function SectionComponent({
  sectionKey,
  vendorName,
  vendorProfileId,
}: {
  sectionKey: string;
  vendorName: string;
  vendorProfileId: string;
}) {
  // noop navigate for overview - just scrolls to the section concept
  const noop = () => {};

  switch (sectionKey) {
    case "intelligence": return <VendorCommandCenter vendorName={vendorName} />;
    case "overview": return <DashboardOverview vendorName={vendorName} onNavigate={noop} />;
    case "segments": return <DashboardSegments vendorName={vendorName} />;
    case "intel": return <DashboardIntel vendorName={vendorName} />;
    case "mentions": return <DashboardMentions vendorName={vendorName} vendorProfileId={vendorProfileId} />;
    case "dealer-signals": return <DashboardDealerSignals vendorName={vendorName} />;
    case "demo-requests": return <DashboardDemoRequests vendorName={vendorName} />;
    case "dimensions": return <DashboardDimensions vendorName={vendorName} />;
    case "screenshots": return <DashboardScreenshots vendorName={vendorName} />;
    case "categories": return <DashboardCategories vendorName={vendorName} />;
    case "profile": return <DashboardEditProfile vendorProfileId={vendorProfileId} />;
    default: return null;
  }
}

// ── Page ────────────────────────────────────────────────────────────────

const TierPreviewPage = () => {
  const { configs, isLoading, error } = useTierConfig();
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [tierOverride, setTierOverride] = useState<VendorTier | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const supabase = useClerkSupabase();

  // Fetch vendor tiers from admin RPC (vendor_logins has RLS)
  const { data: vendorLogins = [] } = useQuery({
    queryKey: ["admin-vendor-logins-tiers"],
    queryFn: async () => {
      const { data, error: rpcErr } = await supabase.rpc("admin_list_vendor_logins" as never);
      if (rpcErr) throw rpcErr;
      return (data ?? []) as { vendor_name: string; tier: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });

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

  const filteredVendors = useMemo(() => {
    if (!searchQuery.trim()) return vendors;
    const q = searchQuery.toLowerCase();
    return vendors.filter((v) => v.vendor_name.toLowerCase().includes(q));
  }, [vendors, searchQuery]);

  // Default to first vendor when vendors load
  useEffect(() => {
    if (vendors.length > 0 && !selectedVendorId) {
      setSelectedVendorId(vendors[0].id);
    }
  }, [vendors, selectedVendorId]);

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);
  const selectedVendorName = selectedVendor?.vendor_name ?? "";
  const selectedVendorProfileId = selectedVendor?.id ?? "";

  // Resolve vendor's actual tier from vendor_logins
  const vendorActualTier = useMemo(() => {
    if (!selectedVendorName) return null;
    const login = vendorLogins.find(
      (vl) => vl.vendor_name?.toLowerCase() === selectedVendorName.toLowerCase()
    );
    return (login?.tier as VendorTier) || null;
  }, [selectedVendorName, vendorLogins]);

  // Reset tier override when vendor changes
  useEffect(() => {
    setTierOverride(null);
  }, [selectedVendorId]);

  const previewTier: VendorTier = tierOverride ?? vendorActualTier ?? "tier_1";

  const dashboardUrl = selectedVendorName
    ? `/vendor-dashboard?vendor=${encodeURIComponent(selectedVendorName)}`
    : "";

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

  const tierLabel = TIER_LABELS[previewTier] || "Tier 1 ($12K)";

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Tier Preview</h1>
          <p className="text-sm text-zinc-500 mt-1">
            See what the vendor dashboard looks like for each tier
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <div className="flex items-center gap-2 h-9 bg-zinc-800 border border-zinc-700 rounded-md px-3 w-72">
              <Search className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Search vendors..."
                className="bg-transparent border-none outline-none text-sm text-zinc-300 placeholder:text-zinc-600 w-full"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setIsSearchOpen(false); }} className="text-zinc-500 hover:text-zinc-300">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {isSearchOpen && filteredVendors.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                {filteredVendors.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVendorId(v.id);
                      setSearchQuery("");
                      setIsSearchOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      v.id === selectedVendorId
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200"
                    }`}
                  >
                    {v.vendor_name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {dashboardUrl && (
            <a
              href={dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open dashboard
            </a>
          )}
        </div>
      </div>

      {/* Selected vendor indicator + tier selector */}
      {selectedVendorName && (
        <div className="flex items-center gap-3 mb-4 px-1">
          <span className="text-sm font-medium text-zinc-300">{selectedVendorName}</span>
          {vendorActualTier && (
            <span className="text-xs text-zinc-500">
              Actual tier: {TIER_LABELS[vendorActualTier] || vendorActualTier}
            </span>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-zinc-500 mr-1">Preview as:</span>
            {TIERS.map((t) => (
              <button
                key={t}
                onClick={() => setTierOverride(t === previewTier && !tierOverride ? null : t)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  t === previewTier
                    ? "bg-zinc-700 border-zinc-600 text-zinc-200"
                    : "bg-zinc-800/50 border-zinc-700/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
                }`}
              >
                {TIER_LABELS[t] || t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All sections stacked */}
      <motion.div
        className="flex-1 overflow-y-auto space-y-4 pb-8"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {!selectedVendorName ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-zinc-600">
            <BarChart3 className="h-10 w-10" />
            <p className="text-sm">Select a vendor to preview their dashboard</p>
          </div>
        ) : (
          SECTION_ORDER.map((sectionKey) => {
            const vis = getVisibility(configs, previewTier, sectionKey);
            return (
              <SectionPreview
                key={sectionKey}
                sectionKey={sectionKey}
                vis={vis}
                tierLabel={tierLabel}
                vendorName={selectedVendorName}
                vendorProfileId={selectedVendorProfileId}
              />
            );
          })
        )}
      </motion.div>
    </div>
  );
};

export default TierPreviewPage;
