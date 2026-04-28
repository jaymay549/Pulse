import { useState } from "react";
import { Loader2, ChevronRight } from "lucide-react";
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
  type DashboardComponent,
} from "@/types/tier-config";

const TIERS: VendorTier[] = ["tier_1", "tier_2", "test"];

const GROUPS = [...new Set(DASHBOARD_COMPONENTS.map((c) => c.group))];

const VIS_COLOR: Record<ComponentVisibility, string> = {
  full: "text-emerald-400",
  gated: "text-amber-400",
  hidden: "text-red-400",
};

const VIS_BG: Record<ComponentVisibility, string> = {
  full: "bg-emerald-500/10 border-emerald-500/20",
  gated: "bg-amber-500/10 border-amber-500/20",
  hidden: "bg-red-500/10 border-red-500/20",
};

const MIXED_STYLE = "bg-transparent border-zinc-700 text-zinc-500";

type UpdateFn = (tier: VendorTier, key: string, vis: ComponentVisibility) => void;

// ── Shared select ──────────────────────────────────────────────────────

function VisSelect({
  value,
  onChange,
  size = "sm",
}: {
  value: ComponentVisibility;
  onChange: (val: ComponentVisibility) => void;
  size?: "sm" | "xs";
}) {
  const dim = size === "xs" ? "w-[88px] h-7 text-[11px]" : "w-24 h-8 text-xs";
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`${dim} border ${VIS_BG[value]} ${VIS_COLOR[value]} bg-transparent`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="full"><span className="text-emerald-400">Full</span></SelectItem>
        <SelectItem value="gated"><span className="text-amber-400">Gated</span></SelectItem>
        <SelectItem value="hidden"><span className="text-red-400">Hidden</span></SelectItem>
      </SelectContent>
    </Select>
  );
}

function MixedSelect({ onChange, size = "sm" }: { onChange: (val: ComponentVisibility) => void; size?: "sm" | "xs" }) {
  const dim = size === "xs" ? "w-[88px] h-7 text-[11px]" : "w-24 h-8 text-xs";
  return (
    <Select value="" onValueChange={onChange}>
      <SelectTrigger className={`${dim} border ${MIXED_STYLE}`}>
        <span className="italic">Mixed</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="full"><span className="text-emerald-400">Set all Full</span></SelectItem>
        <SelectItem value="gated"><span className="text-amber-400">Set all Gated</span></SelectItem>
        <SelectItem value="hidden"><span className="text-red-400">Set all Hidden</span></SelectItem>
      </SelectContent>
    </Select>
  );
}

// ── Tier selects row ───────────────────────────────────────────────────

function TierSelects({
  keys,
  configs,
  onUpdate,
  size = "sm",
}: {
  keys: string[];
  configs: any[];
  onUpdate: UpdateFn;
  size?: "sm" | "xs";
}) {
  return (
    <div className="flex items-center gap-6" onClick={(e) => e.stopPropagation()}>
      {TIERS.map((tier) => {
        const visibilities = keys.map((k) => getVisibility(configs, tier, k));
        const unique = [...new Set(visibilities)];
        const resolved = unique.length === 1 ? unique[0] : null;

        const handleSet = (val: ComponentVisibility) => {
          keys.forEach((k) => onUpdate(tier, k, val));
        };

        return (
          <div key={tier} className={size === "xs" ? "w-[88px]" : "w-24"}>
            {resolved ? (
              <VisSelect value={resolved} onChange={handleSet} size={size} />
            ) : (
              <MixedSelect onChange={handleSet} size={size} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Component row (expandable if it has children) ──────────────────────

function ComponentRow({
  component,
  configs,
  onUpdate,
}: {
  component: DashboardComponent;
  configs: any[];
  onUpdate: UpdateFn;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = component.children && component.children.length > 0;

  const allKeys = hasChildren
    ? [component.key, ...component.children!.map((c) => c.key)]
    : [component.key];

  return (
    <div>
      <div
        className={`flex items-center px-5 py-2.5 transition-colors ${
          hasChildren ? "cursor-pointer hover:bg-zinc-800/30" : "hover:bg-zinc-800/20"
        }`}
        onClick={hasChildren ? () => setExpanded(!expanded) : undefined}
      >
        <div className="flex items-center gap-2 flex-1 pl-7">
          {hasChildren && (
            <motion.div
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
            </motion.div>
          )}
          <span className="text-sm text-zinc-300">{component.label}</span>
          {hasChildren && (
            <span className="text-[10px] text-zinc-600 ml-1">
              {component.children!.length}
            </span>
          )}
        </div>
        <TierSelects keys={allKeys} configs={configs} onUpdate={onUpdate} />
      </div>

      {hasChildren && (
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              {component.children!.map((sub) => (
                <div
                  key={sub.key}
                  className="flex items-center px-5 py-2 hover:bg-zinc-800/15 transition-colors"
                >
                  <span className="text-[13px] text-zinc-500 flex-1 pl-16">
                    {sub.label}
                  </span>
                  <TierSelects
                    keys={[sub.key]}
                    configs={configs}
                    onUpdate={onUpdate}
                    size="xs"
                  />
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

// ── Group section ──────────────────────────────────────────────────────

function GroupSection({
  group,
  configs,
  onUpdate,
}: {
  group: string;
  configs: any[];
  onUpdate: UpdateFn;
}) {
  const [open, setOpen] = useState(true);
  const components = DASHBOARD_COMPONENTS.filter((c) => c.group === group);

  const allKeys = components.flatMap((c) => [
    c.key,
    ...(c.children?.map((s) => s.key) ?? []),
  ]);

  return (
    <div className="rounded-lg border border-zinc-800/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3 bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
      >
        <motion.div
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronRight className="h-4 w-4 text-zinc-500" />
        </motion.div>
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex-1 text-left">
          {group}
        </span>
        <TierSelects keys={allKeys} configs={configs} onUpdate={onUpdate} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-zinc-800/30">
              {components.map((component) => (
                <ComponentRow
                  key={component.key}
                  component={component}
                  configs={configs}
                  onUpdate={onUpdate}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

const TierConfigPage = () => {
  const { configs, isLoading, error, updateVisibility } = useTierConfig();

  const handleUpdate: UpdateFn = (tier, key, vis) => {
    updateVisibility.mutate({
      p_tier: tier,
      p_component_key: key,
      p_visibility: vis,
    });
  };

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
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Tier Configuration</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Control which dashboard sections each vendor tier can access
        </p>
      </div>

      {/* Tier column labels */}
      <div className="flex items-center px-5">
        <div className="flex-1" />
        <div className="flex items-center gap-6">
          {TIERS.map((tier) => (
            <div key={tier} className="w-24 text-center">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                {TIER_LABELS[tier]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <motion.div
        className="space-y-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {GROUPS.map((group) => (
          <GroupSection
            key={group}
            group={group}
            configs={configs}
            onUpdate={handleUpdate}
          />
        ))}
      </motion.div>
    </div>
  );
};

export default TierConfigPage;
