import { useState, useEffect } from "react";
import { Loader2, Trash2, Plus, Key } from "lucide-react";
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
function VendorMetadataSection() {
  const [metadata, setMetadata] = useState<VendorMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

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

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-300">Vendor Metadata</h2>
      <p className="text-xs text-zinc-600">
        Additional vendor information like websites and logos.
      </p>

      {/* Add form */}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-[10px] text-zinc-500">Vendor Name</Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Vendor name"
            className="h-7 text-xs bg-zinc-900 border-zinc-700 text-zinc-300"
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-[10px] text-zinc-500">Website URL</Label>
          <Input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://..."
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
      ) : metadata.length === 0 ? (
        <p className="text-xs text-zinc-600">No vendor metadata.</p>
      ) : (
        <div className="space-y-1">
          {metadata.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-zinc-900/60 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs text-zinc-200">{m.vendor_name}</span>
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
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100"
                onClick={() => handleDelete(m.id)}
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

export default AdminSettingsPage;
