import { useState } from "react";
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
  Heart,
  Target,
  Zap,
  LineChart,
  Lightbulb,
  FileText,
  Upload,
  Globe,
  Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTierConfig, getVisibility } from "@/hooks/useTierConfig";
import {
  DASHBOARD_COMPONENTS,
  TIER_LABELS,
  type VendorTier,
  type ComponentVisibility,
} from "@/types/tier-config";

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

// ── Wireframe building blocks ──────────────────────────────────────────

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

function WireCard({
  label,
  vis,
  icon: Icon,
  h = "h-24",
  children,
  className = "",
}: {
  label: string;
  vis: Vis;
  icon?: any;
  h?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const s = VIS_WIRE[vis];
  return (
    <div
      className={`rounded-lg border ${s.border} ${s.bg} ${h} flex flex-col ${
        vis === "hidden" ? "opacity-30" : ""
      } ${className}`}
    >
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        {Icon && <Icon className={`h-3.5 w-3.5 ${s.text}`} />}
        <span className={`text-[11px] font-medium ${s.text} flex-1 ${vis === "hidden" ? "line-through" : ""}`}>
          {label}
        </span>
        <VisBadge vis={vis} />
      </div>
      {children && <div className="flex-1 px-3 pb-2.5">{children}</div>}
    </div>
  );
}

function WirePlaceholder({ type, className = "" }: { type: "chart" | "bars" | "list" | "donut" | "radar" | "grid"; className?: string }) {
  const shared = "rounded bg-zinc-700/20";
  if (type === "chart")
    return (
      <div className={`${shared} h-full flex items-end gap-0.5 px-2 pb-1 ${className}`}>
        {[40, 65, 50, 80, 60, 75, 55].map((h, i) => (
          <div key={i} className="flex-1 bg-zinc-600/20 rounded-t" style={{ height: `${h}%` }} />
        ))}
      </div>
    );
  if (type === "bars")
    return (
      <div className={`space-y-1.5 ${className}`}>
        {[75, 55, 40, 30].map((w, i) => (
          <div key={i} className={`${shared} h-2`} style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  if (type === "list")
    return (
      <div className={`space-y-1.5 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={`${shared} h-3 rounded`} style={{ width: `${100 - i * 10}%` }} />
        ))}
      </div>
    );
  if (type === "donut")
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="h-14 w-14 rounded-full border-4 border-zinc-600/30 border-t-emerald-500/30 border-r-amber-500/30" />
      </div>
    );
  if (type === "radar")
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="h-16 w-16 rotate-45 border-2 border-zinc-600/20 rounded-lg" />
      </div>
    );
  if (type === "grid")
    return (
      <div className={`grid grid-cols-3 gap-1 ${className}`}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className={`${shared} h-8 rounded`} />
        ))}
      </div>
    );
  return null;
}

// ── Page-specific wireframe layouts ────────────────────────────────────

function getSubVis(configs: any[], tier: VendorTier, key: string): Vis {
  return getVisibility(configs, tier, key);
}

function IntelligenceLayout({ configs, tier }: { configs: any[]; tier: VendorTier }) {
  const v = (k: string) => getSubVis(configs, tier, k);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <WireCard label="Health Score" vis={v("intelligence.health_score")} icon={Heart} h="h-36" className="col-span-2">
          <div className="flex items-center gap-4 h-full">
            <div className="text-3xl font-bold text-zinc-600/40">87</div>
            <WirePlaceholder type="chart" className="flex-1 h-16" />
          </div>
        </WireCard>
        <WireCard label="NPS Chart" vis={v("intelligence.nps_chart")} icon={PieChart} h="h-36">
          <WirePlaceholder type="donut" className="h-full" />
        </WireCard>
      </div>
      <WireCard label="Performance Metrics" vis={v("intelligence.performance_metrics")} icon={Target} h="h-24">
        <div className="grid grid-cols-3 gap-2 h-full">
          {["Stability", "Experience", "Value"].map((m) => (
            <div key={m} className="rounded bg-zinc-700/15 flex flex-col items-center justify-center gap-1 p-2">
              <span className="text-lg font-semibold text-zinc-600/30">4.2</span>
              <span className="text-[9px] text-zinc-600">{m}</span>
            </div>
          ))}
        </div>
      </WireCard>
      <WireCard label="Comparative Benchmarking" vis={v("intelligence.benchmarking")} icon={BarChart3} h="h-28">
        <WirePlaceholder type="chart" className="h-full" />
      </WireCard>
      <div className="grid grid-cols-2 gap-3">
        <WireCard label="Recommended Actions" vis={v("intelligence.recommended_actions")} icon={Lightbulb} h="h-28">
          <WirePlaceholder type="list" />
        </WireCard>
        <WireCard label="Historical Momentum" vis={v("intelligence.momentum")} icon={TrendingUp} h="h-28">
          <WirePlaceholder type="chart" className="h-full" />
        </WireCard>
      </div>
    </div>
  );
}

function OverviewLayout({ configs, tier }: { configs: any[]; tier: VendorTier }) {
  const v = (k: string) => getSubVis(configs, tier, k);
  return (
    <div className="space-y-3">
      <WireCard label="Pulse Briefing" vis={v("overview.pulse_briefing")} icon={Zap} h="h-20">
        <WirePlaceholder type="bars" />
      </WireCard>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-3">
          <WireCard label="Sentiment Trend" vis={v("overview.sentiment_trend")} icon={LineChart} h="h-32">
            <WirePlaceholder type="chart" className="h-full" />
          </WireCard>
          <WireCard label="Discussion Volume" vis={v("overview.discussion_volume")} icon={BarChart3} h="h-32">
            <WirePlaceholder type="chart" className="h-full" />
          </WireCard>
        </div>
        <div className="space-y-3">
          <WireCard label="NPS Chart" vis={v("overview.nps")} icon={PieChart} h="h-32">
            <WirePlaceholder type="donut" className="h-full" />
          </WireCard>
          <WireCard label="Recent Activity" vis={v("overview.recent_activity")} icon={MessageSquare} h="h-32">
            <WirePlaceholder type="list" />
          </WireCard>
        </div>
      </div>
    </div>
  );
}

function SegmentsLayout({ configs, tier }: { configs: any[]; tier: VendorTier }) {
  const v = (k: string) => getSubVis(configs, tier, k);
  return (
    <div className="space-y-3">
      <WireCard label="Axis Summary" vis={v("segments.axis_summary")} icon={BarChart3} h="h-16">
        <WirePlaceholder type="bars" />
      </WireCard>
      <WireCard label="Segment Cards" vis={v("segments.bucket_cards")} icon={PieChart} h="h-44">
        <div className="grid grid-cols-2 gap-2 h-full">
          {["Small", "Mid-size", "Enterprise", "Regional"].map((s) => (
            <div key={s} className="rounded bg-zinc-700/15 p-2 flex flex-col gap-1">
              <span className="text-[10px] font-medium text-zinc-500">{s}</span>
              <div className="h-1.5 rounded bg-zinc-600/20 w-3/4" />
              <WirePlaceholder type="bars" className="mt-auto" />
            </div>
          ))}
        </div>
      </WireCard>
    </div>
  );
}

function IntelLayout({ configs, tier }: { configs: any[]; tier: VendorTier }) {
  const v = (k: string) => getSubVis(configs, tier, k);
  return (
    <div className="space-y-3">
      <WireCard label="Your Position" vis={v("intel.your_position")} icon={Target} h="h-20">
        <div className="grid grid-cols-3 gap-2">
          {["Discussions", "Positive %", "Concerns"].map((m) => (
            <div key={m} className="rounded bg-zinc-700/15 p-2 text-center">
              <span className="text-sm font-semibold text-zinc-600/30">42</span>
              <p className="text-[9px] text-zinc-600">{m}</p>
            </div>
          ))}
        </div>
      </WireCard>
      <WireCard label="Competitor Comparison" vis={v("intel.competitor_table")} icon={Users} h="h-40">
        <div className="space-y-1.5">
          <div className="grid grid-cols-4 gap-2 text-[9px] text-zinc-600 font-medium px-1">
            <span>Vendor</span><span>Discussions</span><span>Positive %</span><span>Co-occur</span>
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="grid grid-cols-4 gap-2 rounded bg-zinc-700/10 px-1 py-1.5">
              <div className="h-2 rounded bg-zinc-600/20 w-16" />
              <div className="h-2 rounded bg-zinc-600/20 w-8" />
              <div className="h-2 rounded bg-zinc-600/20 w-10" />
              <div className="h-2 rounded bg-zinc-600/20 w-6" />
            </div>
          ))}
        </div>
      </WireCard>
    </div>
  );
}

function MentionsLayout({ configs, tier }: { configs: any[]; tier: VendorTier }) {
  const v = (k: string) => getSubVis(configs, tier, k);
  return (
    <div className="grid grid-cols-3 gap-3">
      <WireCard label="Community Sentiment" vis={v("mentions.sentiment_card")} icon={PieChart} h="h-48">
        <WirePlaceholder type="donut" className="h-20" />
        <WirePlaceholder type="bars" className="mt-2" />
      </WireCard>
      <div className="col-span-2 space-y-3">
        <WireCard label="Discussion Feed" vis={v("mentions.mention_cards")} icon={MessageSquare} h="h-48">
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded bg-zinc-700/10 p-2 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-12 rounded bg-emerald-500/20" />
                  <div className="h-2 w-20 rounded bg-zinc-600/20" />
                </div>
                <div className="h-2 rounded bg-zinc-600/15 w-full" />
                <div className="h-2 rounded bg-zinc-600/15 w-3/4" />
              </div>
            ))}
          </div>
        </WireCard>
        <WireCard label="Official Responses" vis={v("mentions.respond")} icon={FileText} h="h-16">
          <div className="rounded bg-zinc-700/10 p-2">
            <div className="h-2 rounded bg-zinc-600/15 w-full" />
            <div className="h-2 rounded bg-zinc-600/15 w-1/2 mt-1" />
          </div>
        </WireCard>
      </div>
    </div>
  );
}

function DealerSignalsLayout({ configs, tier }: { configs: any[]; tier: VendorTier }) {
  const v = (k: string) => getSubVis(configs, tier, k);
  return (
    <div className="space-y-3">
      <WireCard label="KPI Cards" vis={v("dealer-signals.kpi_cards")} icon={Target} h="h-20">
        <div className="grid grid-cols-4 gap-2">
          {["Dealers Using", "Avg Sentiment", "Switching Risk", "At Risk"].map((m) => (
            <div key={m} className="rounded bg-zinc-700/15 p-2 text-center">
              <span className="text-sm font-semibold text-zinc-600/30">12</span>
              <p className="text-[8px] text-zinc-600">{m}</p>
            </div>
          ))}
        </div>
      </WireCard>
      <WireCard label="Dealer Status Breakdown" vis={v("dealer-signals.status_breakdown")} icon={BarChart3} h="h-20">
        <div className="flex h-4 rounded-full overflow-hidden">
          <div className="bg-emerald-500/20 w-[60%]" />
          <div className="bg-amber-500/20 w-[25%]" />
          <div className="bg-red-500/20 w-[15%]" />
        </div>
        <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
          <span>Stable 60%</span><span>Exploring 25%</span><span>Left 15%</span>
        </div>
      </WireCard>
      <WireCard label="Exit Reasons" vis={v("dealer-signals.exit_reasons")} icon={Zap} h="h-24">
        <WirePlaceholder type="bars" />
      </WireCard>
      <WireCard label="Category Market Share" vis={v("dealer-signals.market_share")} icon={PieChart} h="h-20">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-zinc-600/30">34%</span>
          <div className="flex-1 h-3 rounded-full bg-zinc-700/20 overflow-hidden">
            <div className="h-full bg-zinc-600/20 rounded-full w-[34%]" />
          </div>
        </div>
      </WireCard>
    </div>
  );
}

function DemoRequestsLayout({ configs, tier }: { configs: any[]; tier: VendorTier }) {
  const v = (k: string) => getSubVis(configs, tier, k);
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="grid grid-cols-3 gap-3">
          <WireCard label={`Request Card ${i}`} vis={v("demo-requests.request_cards")} icon={CalendarCheck} h="h-28" className="col-span-2">
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <div className="h-2 rounded bg-zinc-600/20 w-24" />
                <div className="h-2 rounded bg-zinc-600/15 w-32" />
              </div>
              <div className="h-2 rounded bg-zinc-600/15 w-full" />
              <div className="h-2 rounded bg-zinc-600/15 w-3/4" />
              <div className="flex gap-2 mt-2">
                <div className="h-5 rounded bg-zinc-600/10 w-20 text-[8px] text-zinc-600 flex items-center justify-center">Status</div>
              </div>
            </div>
          </WireCard>
          <WireCard label="Contact Info" vis={v("demo-requests.contact_info")} icon={Globe} h="h-28">
            <div className="space-y-1.5">
              <div className="h-2 rounded bg-zinc-600/20 w-full" />
              <div className="h-2 rounded bg-zinc-600/15 w-3/4" />
              <div className="h-2 rounded bg-zinc-600/15 w-1/2" />
            </div>
          </WireCard>
        </div>
      ))}
    </div>
  );
}

function DimensionsLayout({ configs, tier }: { configs: any[]; tier: VendorTier }) {
  const v = (k: string) => getSubVis(configs, tier, k);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <WireCard label="Radar Overview" vis={v("dimensions.radar_chart")} icon={Layers} h="h-36">
          <WirePlaceholder type="radar" className="h-full" />
        </WireCard>
        <WireCard label="Discussion Breakdown" vis={v("dimensions.bar_chart")} icon={BarChart3} h="h-36">
          <WirePlaceholder type="chart" className="h-full" />
        </WireCard>
      </div>
      <WireCard label="Dimension Cards" vis={v("dimensions.dimension_cards")} icon={Layers} h="h-40">
        <div className="grid grid-cols-2 gap-2 h-full">
          {["Support", "Pricing", "Features", "UX"].map((d) => (
            <div key={d} className="rounded bg-zinc-700/10 p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500">{d}</span>
                <span className="text-[9px] text-emerald-500/50">78%</span>
              </div>
              <div className="h-1.5 rounded bg-zinc-600/20 mt-1 w-3/4" />
            </div>
          ))}
        </div>
      </WireCard>
    </div>
  );
}

function CategoriesLayout({ configs, tier }: { configs: any[]; tier: VendorTier }) {
  const pageVis = getVisibility(configs, tier, "categories");
  return (
    <WireCard label="Categories" vis={pageVis} icon={Tags} h="h-32">
      <div className="flex flex-wrap gap-2">
        {["DMS", "CRM", "F&I", "Digital Retail", "Service"].map((c) => (
          <div key={c} className="rounded-full bg-zinc-700/20 px-3 py-1 text-[10px] text-zinc-500">{c}</div>
        ))}
      </div>
    </WireCard>
  );
}

function ScreenshotsLayout({ configs, tier }: { configs: any[]; tier: VendorTier }) {
  const v = (k: string) => getSubVis(configs, tier, k);
  return (
    <div className="space-y-3">
      <WireCard label="Upload Area" vis={v("screenshots.upload")} icon={Upload} h="h-20">
        <div className="h-full rounded border border-dashed border-zinc-700/50 flex items-center justify-center">
          <span className="text-[10px] text-zinc-600">Drop files here</span>
        </div>
      </WireCard>
      <WireCard label="Screenshot Gallery" vis={v("screenshots.gallery")} icon={Image} h="h-36">
        <WirePlaceholder type="grid" />
      </WireCard>
    </div>
  );
}

function ProfileLayout({ configs, tier }: { configs: any[]; tier: VendorTier }) {
  const v = (k: string) => getSubVis(configs, tier, k);
  return (
    <div className="space-y-3">
      <WireCard label="Banner & Logo" vis={v("profile.banner_logo")} icon={Camera} h="h-28">
        <div className="h-12 rounded bg-zinc-700/15 relative">
          <div className="absolute -bottom-3 left-3 h-10 w-10 rounded-full bg-zinc-700/30 border-2 border-zinc-800" />
        </div>
      </WireCard>
      <WireCard label="Profile Details" vis={v("profile.details_form")} icon={FileText} h="h-40">
        <div className="space-y-2">
          {["Tagline", "Description", "Website", "LinkedIn", "Email"].map((f) => (
            <div key={f} className="flex items-center gap-2">
              <span className="text-[9px] text-zinc-600 w-16">{f}</span>
              <div className="h-2.5 rounded bg-zinc-700/15 flex-1" />
            </div>
          ))}
        </div>
      </WireCard>
      <WireCard label="Screenshots Gallery" vis={v("profile.screenshots")} icon={Image} h="h-20">
        <WirePlaceholder type="grid" />
      </WireCard>
    </div>
  );
}

// ── Layout router ──────────────────────────────────────────────────────

const LAYOUT_MAP: Record<string, React.FC<{ configs: any[]; tier: VendorTier }>> = {
  intelligence: IntelligenceLayout,
  overview: OverviewLayout,
  segments: SegmentsLayout,
  intel: IntelLayout,
  mentions: MentionsLayout,
  "dealer-signals": DealerSignalsLayout,
  "demo-requests": DemoRequestsLayout,
  dimensions: DimensionsLayout,
  screenshots: ScreenshotsLayout,
  profile: ProfileLayout,
};

function PreviewContent({
  componentKey,
  configs,
  tier,
}: {
  componentKey: string;
  configs: any[];
  tier: VendorTier;
}) {
  const component = DASHBOARD_COMPONENTS.find((c) => c.key === componentKey);
  if (!component) return null;

  const pageVis = getVisibility(configs, tier, component.key);
  const StatusIcon = pageVis === "full" ? Eye : pageVis === "gated" ? Lock : EyeOff;

  if (pageVis === "hidden") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-600">
        <EyeOff className="h-10 w-10" />
        <p className="text-sm">This page is hidden for {TIER_LABELS[tier]}</p>
      </div>
    );
  }

  const Layout = LAYOUT_MAP[componentKey];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 mb-4">
        <StatusIcon className={`h-4 w-4 ${VIS_WIRE[pageVis].text}`} />
        <span className="text-lg font-medium text-zinc-200">{component.label}</span>
        <VisBadge vis={pageVis} />
      </div>

      {Layout ? (
        <Layout configs={configs} tier={tier} />
      ) : (
        <CategoriesLayout configs={configs} tier={tier} />
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

const TierPreviewPage = () => {
  const { configs, isLoading, error } = useTierConfig();
  const [previewTier, setPreviewTier] = useState<VendorTier>("tier_1");
  const [activeSection, setActiveSection] = useState<string>("intelligence");

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
              key={`${activeSection}-${previewTier}`}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
            >
              <PreviewContent componentKey={activeSection} configs={configs} tier={previewTier} />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default TierPreviewPage;
