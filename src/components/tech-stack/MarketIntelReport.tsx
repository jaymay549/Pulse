import { ArrowLeft, TrendingUp, Users, MessageSquare, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import {
  useMarketIntelReport,
  type MarketIntelVendor,
  type MarketIntelAlternative,
} from "@/hooks/useMarketIntelReport";
import { useTechStackEntries } from "@/hooks/useTechStackProfile";
import { computeTechStackCompletion } from "@/hooks/useTechStackCompletion";

export default function MarketIntelReport() {
  const { isAuthenticated } = useClerkAuth();
  const { data: techData } = useTechStackEntries();
  const completion = computeTechStackCompletion(techData?.entries || [], techData?.skippedCategories || []);
  const { data: report, isLoading, isError } = useMarketIntelReport(
    completion.isComplete
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Sign in to view your report.</p>
      </div>
    );
  }

  if (!completion.isComplete) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-slate-600 font-medium">
            Complete your stack to see how dealers like you compare
          </p>
          <p className="text-sm text-slate-400">
            {completion.percentage}% complete — {completion.missing[0]}
          </p>
          <Link to="/vendors">
            <Button size="sm" variant="outline" className="mt-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Vendors
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500">
            Finding dealers like you...
          </p>
        </div>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">
          Failed to load report. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Dealers Like You
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              See what dealers with similar stacks are using and how you compare
            </p>
          </div>
          <Link to="/vendors">
            <Button size="sm" variant="outline">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
        </div>

        {/* Section A: Your Stack vs. Peers */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-slate-900">
              How Your Stack Compares
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            Here's how the community rates each vendor you use, with your personal score alongside.
          </p>

          <div className="grid gap-3">
            {report.current_vendors.map((vendor) => (
              <VendorComparisonCard key={vendor.vendor_name} vendor={vendor} />
            ))}
          </div>
        </section>

        {/* Section B: Alternatives Worth Exploring */}
        {report.current_vendors.some(
          (v) => v.status === "exploring" && v.alternatives.length > 0
        ) && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-900">
                What Others Are Switching To
              </h2>
            </div>

            {report.current_vendors
              .filter(
                (v) => v.status === "exploring" && v.alternatives.length > 0
              )
              .map((vendor) => (
                <div key={vendor.vendor_name} className="space-y-2">
                  <p className="text-sm text-slate-600">
                    Dealers who left{" "}
                    <span className="font-medium">{vendor.vendor_name}</span>{" "}
                    for similar reasons switched to:
                  </p>
                  <div className="grid gap-2">
                    {vendor.alternatives.map((alt) => (
                      <AlternativeCard key={alt.vendor_name} alternative={alt} />
                    ))}
                  </div>
                </div>
              ))}
          </section>
        )}

        {/* Section C: Your Feedback Delivered */}
        <section className="rounded-xl bg-primary/5 border border-primary/10 p-6 text-center space-y-2">
          <MessageSquare className="h-8 w-8 text-primary mx-auto" />
          <h2 className="text-lg font-semibold text-slate-900">
            Your Feedback Delivered
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Your structured feedback has been anonymously contributed to vendor
            intelligence dashboards. Your insights are helping improve
            intelligence for{" "}
            <span className="font-semibold text-primary">
              {report.contribution_count} vendor
              {report.contribution_count !== 1 ? "s" : ""}
            </span>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function VendorComparisonCard({ vendor }: { vendor: MarketIntelVendor }) {
  const healthScore = vendor.health_score;
  const median = vendor.category_median;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-800">
            {vendor.vendor_name}
          </span>
          {vendor.category && (
            <Badge variant="outline" className="text-xs">
              {vendor.category}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={vendor.status === "stable" ? "default" : "secondary"}
            className="text-xs"
          >
            {vendor.status}
          </Badge>
          {vendor.sentiment_score && (
            <span className="text-xs text-slate-400">
              Your rating: {vendor.sentiment_score}/10
            </span>
          )}
        </div>
      </div>

      {healthScore !== null && median !== null && (
        <div className="space-y-1.5">
          {/* Vendor score bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-24 shrink-0">
              Health Score
            </span>
            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden relative">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  healthScore >= 70
                    ? "bg-emerald-500"
                    : healthScore >= 50
                      ? "bg-amber-500"
                      : "bg-red-500"
                )}
                style={{ width: `${healthScore}%` }}
              />
              {/* Category median marker */}
              <div
                className="absolute top-0 h-full w-0.5 bg-slate-800"
                style={{ left: `${median}%` }}
                title={`Category median: ${median}`}
              />
            </div>
            <span className="text-sm font-semibold text-slate-700 w-8 text-right">
              {healthScore}
            </span>
          </div>
          <div className="flex justify-between text-xs text-slate-400 pl-[calc(6rem+0.75rem)]">
            <span>
              Category median: {Math.round(median)}
            </span>
            {vendor.percentile !== null && (
              <span>Top {100 - vendor.percentile}%</span>
            )}
          </div>
        </div>
      )}

      {healthScore === null && (
        <p className="text-xs text-slate-400 italic">
          Not enough data to compute health score yet
        </p>
      )}
    </div>
  );
}

function AlternativeCard({
  alternative,
}: {
  alternative: MarketIntelAlternative;
}) {
  const metricLabel = alternative.highlight_metric
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <Link
      to={`/vendors/${encodeURIComponent(alternative.vendor_name)}`}
      className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-primary/30 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded bg-emerald-50 flex items-center justify-center text-xs font-semibold text-emerald-700 shrink-0">
            {alternative.health_score}
          </span>
          <div>
            <span className="font-medium text-sm text-slate-800">
              {alternative.vendor_name}
            </span>
            <p className="text-xs text-slate-400">
              {metricLabel}: {alternative.highlight_score}/100
            </p>
          </div>
        </div>
        <ExternalLink className="h-4 w-4 text-slate-400" />
      </div>
    </Link>
  );
}
