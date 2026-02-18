import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Trash2, Plus, Key, Sparkles, RefreshCw, AlertCircle, CheckCircle2, Clock, Search, Linkedin, ImageIcon, MapPin, BotMessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { VendorIgnore, VendorMetadata } from "@/types/admin";

const AdminSettingsPage = () => {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Vendor ignore patterns, metadata, and API configuration.
        </p>
      </div>

      <WamPasswordSection />
      <Separator className="bg-zinc-800" />
      <VendorIgnoresSection />
      <Separator className="bg-zinc-800" />
      <VendorMetadataSection />
      <Separator className="bg-zinc-800" />
      <AIThemesSection />
    </div>
  );
};

// WAM Password
function WamPasswordSection() {
  const [password, setPassword] = useState(() => sessionStorage.getItem("wam_password") || "");
  const [saved, setSaved] = useState(!!sessionStorage.getItem("wam_password"));

  const handleSave = () => {
    if (password.trim()) {
      sessionStorage.setItem("wam_password", password.trim());
      setSaved(true);
      toast.success("WAM password saved to session");
    } else {
      sessionStorage.removeItem("wam_password");
      setSaved(false);
      toast.info("WAM password cleared");
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
        <Key className="h-4 w-4" /> WAM API Password
      </h2>
      <p className="text-xs text-zinc-600">
        Required for WAM API operations (process queue, trigger tasks). Stored in session only.
      </p>
      <div className="flex items-center gap-2 max-w-sm">
        <Input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setSaved(false); }}
          placeholder="Enter WAM API password"
          className="h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-300"
        />
        <Button size="sm" className="h-8 text-xs" onClick={handleSave}>
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
    </section>
  );
}

// Vendor Ignores
function VendorIgnoresSection() {
  const [ignores, setIgnores] = useState<VendorIgnore[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPattern, setNewPattern] = useState("");
  const [newReason, setNewReason] = useState("");

  const loadIgnores = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vendor_ignores")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setIgnores(data || []);
    setLoading(false);
  };

  useEffect(() => { loadIgnores(); }, []);

  const handleAdd = async () => {
    if (!newPattern.trim()) return;
    const { error } = await supabase.from("vendor_ignores").insert({
      pattern: newPattern.trim(),
      reason: newReason.trim() || null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Added "${newPattern}" to ignore list`);
      setNewPattern("");
      setNewReason("");
      loadIgnores();
    }
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("vendor_ignores").delete().eq("id", id);
    if (error) toast.error(error.message);
    else loadIgnores();
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-300">Vendor Ignore Patterns</h2>
      <p className="text-xs text-zinc-600">
        Vendor names matching these patterns will be skipped during processing.
      </p>

      {/* Add form */}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-[10px] text-zinc-500">Pattern</Label>
          <Input
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            placeholder="e.g. test_vendor"
            className="h-7 text-xs bg-zinc-900 border-zinc-700 text-zinc-300"
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-[10px] text-zinc-500">Reason</Label>
          <Input
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="Optional"
            className="h-7 text-xs bg-zinc-900 border-zinc-700 text-zinc-300"
          />
        </div>
        <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={!newPattern.trim()}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
      ) : ignores.length === 0 ? (
        <p className="text-xs text-zinc-600">No ignore patterns.</p>
      ) : (
        <div className="space-y-1">
          {ignores.map((ig) => (
            <div
              key={ig.id}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-zinc-900/60 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs text-zinc-200 font-mono">{ig.pattern}</span>
                {ig.reason && <span className="text-[10px] text-zinc-600">— {ig.reason}</span>}
                {ig.category && <span className="text-[10px] text-zinc-700">[{ig.category}]</span>}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100"
                onClick={() => handleDelete(ig.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Vendor Metadata
const ENRICHMENT_FUNCTION_URL = "https://nsfrxtpxzdmqlezvvjgg.supabase.co/functions/v1/vendor-enrich";

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  pending: { bg: "bg-zinc-700/50", text: "text-zinc-400", icon: Clock },
  enriching: { bg: "bg-blue-900/40", text: "text-blue-400", icon: Loader2 },
  enriched: { bg: "bg-emerald-900/40", text: "text-emerald-400", icon: CheckCircle2 },
  failed: { bg: "bg-red-900/40", text: "text-red-400", icon: AlertCircle },
};

function StatusBadge({ status }: { status: string | null }) {
  const s = STATUS_STYLES[status || "pending"] || STATUS_STYLES.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${s.bg} ${s.text}`}>
      <Icon className={`h-2.5 w-2.5 ${status === "enriching" ? "animate-spin" : ""}`} />
      {status || "pending"}
    </span>
  );
}

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-900/40 text-violet-400">
      {category}
    </span>
  );
}

function VendorMetadataSection() {
  const [metadata, setMetadata] = useState<VendorMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [enrichingVendor, setEnrichingVendor] = useState<string | null>(null);
  const [enrichProgress, setEnrichProgress] = useState("");
  const stopRef = useRef(false);

  const loadMetadata = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vendor_metadata")
      .select("*")
      .order("vendor_name");
    if (!error) setMetadata(data || []);
    setLoading(false);
  };

  useEffect(() => { loadMetadata(); }, []);

  const stats = {
    total: metadata.length,
    enriched: metadata.filter((m) => m.enrichment_status === "enriched").length,
    pending: metadata.filter((m) => m.enrichment_status === "pending" || !m.enrichment_status).length,
    failed: metadata.filter((m) => m.enrichment_status === "failed").length,
    enriching: metadata.filter((m) => m.enrichment_status === "enriching").length,
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from("vendor_metadata").insert({
      vendor_name: newName.trim(),
      website_url: newUrl.trim() || null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Added metadata for "${newName}"`);
      setNewName("");
      setNewUrl("");
      loadMetadata();
    }
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("vendor_metadata").delete().eq("id", id);
    if (error) toast.error(error.message);
    else loadMetadata();
  };

  const callEnrichFunction = async (body: Record<string, unknown>) => {
    const res = await fetch(ENRICHMENT_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const handleEnrichSingle = async (vendorName: string) => {
    setEnrichingVendor(vendorName);
    try {
      const result = await callEnrichFunction({ vendor_names: [vendorName] });
      if (result.enriched > 0) {
        toast.success(`Enriched "${vendorName}"`);
      } else {
        toast.error(result.results?.[0]?.error || "Enrichment failed");
      }
      loadMetadata();
    } catch (e) {
      toast.error("Failed to call enrichment function");
    }
    setEnrichingVendor(null);
  };

  const handleEnrichAll = useCallback(async () => {
    setEnriching(true);
    stopRef.current = false;
    let totalEnriched = 0;
    let remaining = stats.pending;

    while (remaining > 0 && !stopRef.current) {
      setEnrichProgress(`Enriching... ${totalEnriched} done, ${remaining} remaining`);
      try {
        const result = await callEnrichFunction({ batch_size: 5 });
        totalEnriched += result.enriched || 0;
        remaining = result.remaining || 0;

        if (result.rate_limited) {
          setEnrichProgress(`Rate limited. Waiting 30s... (${totalEnriched} done)`);
          await new Promise((r) => setTimeout(r, 30000));
        }
        if (result.enriched === 0 && !result.rate_limited) break;
        loadMetadata();
      } catch {
        toast.error("Enrichment batch failed");
        break;
      }
    }

    setEnriching(false);
    setEnrichProgress("");
    toast.success(`Enrichment complete. ${totalEnriched} vendors enriched.`);
    loadMetadata();
  }, [stats.pending]);

  const handleStopEnrich = () => {
    stopRef.current = true;
    setEnrichProgress("Stopping after current batch...");
  };

  const filtered = searchQuery
    ? metadata.filter((m) =>
        m.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.category && m.category.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : metadata;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">Vendor Metadata</h2>
          <p className="text-xs text-zinc-600">
            {stats.total} vendors — {stats.enriched} enriched, {stats.pending} pending, {stats.failed} failed
          </p>
        </div>
        <div className="flex items-center gap-2">
          {enriching ? (
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleStopEnrich}>
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 text-xs bg-violet-600 hover:bg-violet-700"
              onClick={handleEnrichAll}
              disabled={stats.pending === 0}
            >
              <Sparkles className="h-3 w-3 mr-1" /> Enrich All ({stats.pending})
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-500" onClick={loadMetadata}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {enrichProgress && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-900/20 border border-violet-800/30">
          <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
          <span className="text-xs text-violet-300">{enrichProgress}</span>
        </div>
      )}

      {/* Search + Add form */}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-[10px] text-zinc-500">Search</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-600" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter vendors..."
              className="h-7 text-xs bg-zinc-900 border-zinc-700 text-zinc-300 pl-7"
            />
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-[10px] text-zinc-500">Add Vendor</Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Vendor name"
            className="h-7 text-xs bg-zinc-900 border-zinc-700 text-zinc-300"
          />
        </div>
        <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={!newName.trim()}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
      ) : filtered.length === 0 ? (
        <p className="text-xs text-zinc-600">
          {searchQuery ? "No vendors match your search." : "No vendor metadata."}
        </p>
      ) : (
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-zinc-900/60 group"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-xs text-zinc-200 shrink-0">{m.vendor_name}</span>
                <CategoryBadge category={m.category} />
                <StatusBadge status={m.enrichment_status} />
                {m.website_url && (
                  <a
                    href={m.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-400 hover:underline truncate"
                  >
                    {m.website_url}
                  </a>
                )}
                {m.linkedin_url && (
                  <a
                    href={m.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0A66C2] hover:text-[#0A66C2]/80 shrink-0"
                    title={m.linkedin_url}
                  >
                    <Linkedin className="h-3 w-3" />
                  </a>
                )}
                {m.banner_url && (
                  <span className="text-emerald-500 shrink-0" title="Has banner image">
                    <ImageIcon className="h-3 w-3" />
                  </span>
                )}
                {m.headquarters && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-500 shrink-0" title={m.headquarters}>
                    <MapPin className="h-2.5 w-2.5" /> {m.headquarters}
                  </span>
                )}
                {m.description && (
                  <span className="text-[10px] text-zinc-500 truncate max-w-[200px]" title={m.description}>
                    {m.description}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {m.enrichment_status !== "enriched" && m.enrichment_status !== "enriching" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-zinc-600 hover:text-violet-400 opacity-0 group-hover:opacity-100"
                    onClick={() => handleEnrichSingle(m.vendor_name)}
                    disabled={enrichingVendor === m.vendor_name}
                  >
                    {enrichingVendor === m.vendor_name ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100"
                  onClick={() => handleDelete(m.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// AI Theme Summaries
const THEMES_FUNCTION_URL = "https://nsfrxtpxzdmqlezvvjgg.supabase.co/functions/v1/generate-vendor-themes";

function AIThemesSection() {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [summaryCount, setSummaryCount] = useState<number | null>(null);
  const stopRef = useRef(false);

  const loadCount = async () => {
    const { count } = await supabase
      .from("vendor_theme_summaries")
      .select("vendor_name", { count: "exact", head: true });
    setSummaryCount(count || 0);
  };

  useEffect(() => { loadCount(); }, []);

  const callThemesFunction = async (body: Record<string, unknown>) => {
    const res = await fetch(THEMES_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const handleGenerateAll = useCallback(async () => {
    setGenerating(true);
    stopRef.current = false;
    setProgress("Starting AI theme generation...");

    try {
      const result = await callThemesFunction({ all: true });
      setProgress("");
      toast.success(
        `Done: ${result.generated} generated, ${result.skipped} skipped, ${result.failed} failed`
      );
      loadCount();
    } catch {
      toast.error("Failed to call theme generation function");
      setProgress("");
    }

    setGenerating(false);
  }, []);

  const handleStop = () => {
    stopRef.current = true;
    setProgress("Stopping...");
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">AI Theme Summaries</h2>
          <p className="text-xs text-zinc-600">
            {summaryCount !== null
              ? `${summaryCount} vendors have AI-generated theme summaries`
              : "Loading..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {generating ? (
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleStop}>
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 text-xs bg-violet-600 hover:bg-violet-700"
              onClick={handleGenerateAll}
            >
              <BotMessageSquare className="h-3 w-3 mr-1" /> Generate All Themes
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-500" onClick={loadCount}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {progress && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-900/20 border border-violet-800/30">
          <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
          <span className="text-xs text-violet-300">{progress}</span>
        </div>
      )}
    </section>
  );
}

export default AdminSettingsPage;
