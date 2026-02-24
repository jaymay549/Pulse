import { useState } from "react";
import { Loader2, Flag, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  useAdminFlaggedMentions,
  useUpholdFlag,
  useDismissFlag,
} from "@/hooks/useAdminFlags";

export default function FlaggedMentionsView() {
  const { data: flaggedMentions, isLoading } = useAdminFlaggedMentions();
  const upholdMutation = useUpholdFlag();
  const dismissMutation = useDismissFlag();
  const [expandedFlags, setExpandedFlags] = useState<Set<string>>(new Set());

  const toggleExpanded = (flagId: string) => {
    const next = new Set(expandedFlags);
    if (next.has(flagId)) next.delete(flagId);
    else next.add(flagId);
    setExpandedFlags(next);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!flaggedMentions || flaggedMentions.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-8 text-center">
        <Flag className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-sm text-zinc-400">No flagged mentions pending review</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">
          Pending Flags ({flaggedMentions.length})
        </h2>
      </div>

      {flaggedMentions.map((flag) => {
        const isExpanded = expandedFlags.has(flag.flag_id);
        const isProcessing = upholdMutation.isPending || dismissMutation.isPending;

        return (
          <div
            key={flag.flag_id}
            className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-zinc-200">
                    {flag.vendor_name}
                  </span>
                  <Badge
                    variant={flag.mention_type === "positive" ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {flag.mention_type}
                  </Badge>
                  {flag.mention_source === "external" && (
                    <Badge variant="outline" className="text-xs">
                      External
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-zinc-400">
                  Flagged by {flag.flagged_by_vendor} &middot;{" "}
                  {new Date(flag.flagged_at).toLocaleDateString()}
                </p>
              </div>

              <button
                type="button"
                onClick={() => toggleExpanded(flag.flag_id)}
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                {isExpanded ? "Collapse" : "Expand"}
              </button>
            </div>

            {/* Mention preview */}
            <div className="mb-3 p-3 rounded-md bg-zinc-800/50 border border-zinc-700">
              {flag.headline && (
                <p className="text-sm font-medium text-zinc-300 mb-1">
                  {flag.headline}
                </p>
              )}
              <p className="text-xs text-zinc-400 italic">
                &ldquo;{flag.quote}&rdquo;
              </p>
            </div>

            {/* Flag details (expanded) */}
            {isExpanded && (
              <div className="mb-3 space-y-2">
                <div>
                  <span className="text-xs font-medium text-zinc-400">Reason: </span>
                  <span className="text-sm text-zinc-200 capitalize">
                    {flag.flag_reason.replace(/_/g, " ")}
                  </span>
                </div>
                {flag.flag_note && (
                  <div>
                    <span className="text-xs font-medium text-zinc-400">Vendor note: </span>
                    <span className="text-sm text-zinc-200">{flag.flag_note}</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => upholdMutation.mutate(flag.flag_id)}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <CheckCircle className="h-3 w-3" />
                Uphold (Hide)
              </button>
              <button
                type="button"
                onClick={() => dismissMutation.mutate(flag.flag_id)}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                <XCircle className="h-3 w-3" />
                Dismiss
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
