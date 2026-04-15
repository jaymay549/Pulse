import { Loader2 } from "lucide-react";
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

const VISIBILITY_COLOR: Record<ComponentVisibility, string> = {
  full: "text-emerald-400",
  gated: "text-amber-400",
  hidden: "text-red-400",
};

const TierConfigPage = () => {
  const { configs, isLoading, error, updateVisibility } = useTierConfig();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-red-400 text-sm">
          Failed to load tier configuration.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-sm hover:bg-zinc-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          Tier Component Configuration
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Control which dashboard sections each vendor tier can access
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider px-4 py-3">
                Component
              </th>
              {TIERS.map((tier) => (
                <th
                  key={tier}
                  className={`text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider px-4 py-3 ${
                    tier === "test"
                      ? "border-l border-dashed border-zinc-700"
                      : ""
                  }`}
                >
                  {TIER_LABELS[tier]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((group) => (
              <>
                <tr key={`group-${group}`}>
                  <td
                    colSpan={4}
                    className="bg-zinc-800/50 px-4 py-2 text-xs font-bold text-zinc-400 uppercase tracking-wider"
                  >
                    {group}
                  </td>
                </tr>
                {DASHBOARD_COMPONENTS.filter((c) => c.group === group).map(
                  (component) => (
                    <tr
                      key={component.key}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-zinc-200 font-medium">
                        {component.label}
                      </td>
                      {TIERS.map((tier) => {
                        const current = getVisibility(
                          configs,
                          tier,
                          component.key,
                        );
                        return (
                          <td
                            key={tier}
                            className={`px-4 py-2 ${
                              tier === "test"
                                ? "border-l border-dashed border-zinc-700"
                                : ""
                            }`}
                          >
                            <Select
                              value={current}
                              onValueChange={(val: ComponentVisibility) =>
                                updateVisibility.mutate({
                                  p_tier: tier,
                                  p_component_key: component.key,
                                  p_visibility: val,
                                })
                              }
                            >
                              <SelectTrigger
                                className={`w-28 bg-zinc-800 border-zinc-700 ${VISIBILITY_COLOR[current]}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="full">
                                  <span className="text-emerald-400">Full</span>
                                </SelectItem>
                                <SelectItem value="gated">
                                  <span className="text-amber-400">Gated</span>
                                </SelectItem>
                                <SelectItem value="hidden">
                                  <span className="text-red-400">Hidden</span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        );
                      })}
                    </tr>
                  ),
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TierConfigPage;
