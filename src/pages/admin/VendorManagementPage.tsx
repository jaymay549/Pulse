import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, Trash2, KeyRound, UserPlus, Copy, ChevronDown } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { VendorWizardDialog } from "@/components/admin/vendor-management/VendorWizardDialog";
import { VendorProductSubscriptionsPanel } from "@/components/admin/vendor-management/VendorProductSubscriptionsPanel";

interface VendorLogin {
  id: string;
  user_id: string;
  vendor_name: string;
  tier: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

const EMAIL_REGEX = /.+@.+\..+/;

const TIER_OPTIONS = [
  { value: "unverified", label: "Unverified", style: "text-zinc-400" },
  { value: "tier_1", label: "Tier 1", style: "text-green-400" },
  { value: "tier_2", label: "Tier 2", style: "text-purple-400" },
];

const TIER_TRIGGER_STYLE: Record<string, string> = {
  unverified: "bg-zinc-800 border-zinc-700 text-zinc-400",
  tier_1: "bg-green-900/30 border-green-700/40 text-green-300",
  tier_2: "bg-purple-900/30 border-purple-700/40 text-purple-300",
};

function TierSelect({
  tier,
  vendorName,
  supabase,
  queryClient,
}: {
  tier: string;
  vendorName: string;
  supabase: any;
  queryClient: any;
}) {
  const mutation = useMutation({
    mutationFn: async (newTier: string) => {
      const { error } = await supabase.rpc("admin_update_vendor_tier" as never, {
        p_vendor_name: vendorName,
        p_tier: newTier,
      } as never);
      if (error) throw error;
    },
    onMutate: async (newTier) => {
      await queryClient.cancelQueries({ queryKey: ["admin-vendor-logins"] });
      const previous = queryClient.getQueryData<VendorLogin[]>(["admin-vendor-logins"]);
      queryClient.setQueryData<VendorLogin[]>(["admin-vendor-logins"], (old = []) =>
        old.map((v) => (v.vendor_name === vendorName ? { ...v, tier: newTier } : v))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["admin-vendor-logins"], context.previous);
      toast.error("Failed to update tier");
    },
    onSuccess: () => {
      toast.success(`${vendorName} tier updated`);
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-logins"] });
    },
  });

  return (
    <Select value={tier} onValueChange={(v) => mutation.mutate(v)}>
      <SelectTrigger
        className={`w-28 h-7 text-xs border ${TIER_TRIGGER_STYLE[tier] ?? TIER_TRIGGER_STYLE.unverified}`}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-zinc-900 border-zinc-700">
        {TIER_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
            <span className={opt.style}>{opt.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const VendorManagementPage = () => {
  const supabase = useClerkSupabase();
  const queryClient = useQueryClient();
  const { fetchWithAuth } = useClerkAuth();

  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());

  // Add email dialog
  const [addEmailVendor, setAddEmailVendor] = useState<VendorLogin | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [addEmailResult, setAddEmailResult] = useState<{ email: string; password: string } | null>(null);

  // Password result dialog
  const [passwordResult, setPasswordResult] = useState<{ email: string; password: string } | null>(null);

  // Detail panel for product subscriptions
  const [detailVendor, setDetailVendor] = useState<string | null>(null);

  const { data: vendors = [], isLoading } = useQuery<VendorLogin[]>({
    queryKey: ["admin-vendor-logins"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_vendor_logins" as never);
      if (error) throw error;
      return (data ?? []) as VendorLogin[];
    },
  });

  // Product count per vendor — uses SECURITY DEFINER RPC to bypass RLS
  const { data: productCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["admin-vendor-product-counts", vendors.map((v) => v.vendor_name).join(",")],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      const uniqueNames = [...new Set(vendors.map((v) => v.vendor_name))];
      for (const name of uniqueNames) {
        const { data, error } = await supabase.rpc(
          "admin_list_product_subscriptions" as never,
          { p_vendor_name: name } as never
        );
        if (!error && data) counts[name] = (data as any[]).length;
      }
      return counts;
    },
    enabled: vendors.length > 0,
  });

  const filteredVendors = vendors.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return v.vendor_name.toLowerCase().includes(q) || v.email.toLowerCase().includes(q);
  });

  // Group vendors by vendor_name
  const groupedVendors = useMemo(() => {
    const map = new Map<string, VendorLogin[]>();
    for (const v of filteredVendors) {
      const list = map.get(v.vendor_name) || [];
      list.push(v);
      map.set(v.vendor_name, list);
    }
    return Array.from(map.entries());
  }, [filteredVendors]);

  const toggleExpand = (name: string) => {
    setExpandedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const callEdge = async (body: Record<string, string>) => {
    const res = await fetchWithAuth(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/provision-vendor`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const handleResetPassword = async (vendor: VendorLogin) => {
    setLoadingAction(`reset-${vendor.id}`);
    try {
      const data = await callEdge({ vendor_email: vendor.email, action: "reset-password" });
      setPasswordResult({ email: vendor.email, password: data.password });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = async (vendor: VendorLogin) => {
    if (!confirm(`Remove ${vendor.email} from ${vendor.vendor_name}?`)) return;
    setLoadingAction(`delete-${vendor.id}`);
    try {
      await callEdge({ vendor_email: vendor.email, action: "delete" });
      toast.success(`${vendor.email} removed.`);
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-logins"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAddEmail = async () => {
    if (!addEmailVendor || !EMAIL_REGEX.test(newEmail)) return;
    setLoadingAction("add-email");
    try {
      const data = await callEdge({
        vendor_email: newEmail,
        vendor_name: addEmailVendor.vendor_name,
        action: "add-email",
      });
      setAddEmailResult({ email: newEmail, password: data.password });
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-logins"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add email.");
    } finally {
      setLoadingAction(null);
    }
  };

  const closeAddEmail = () => {
    setAddEmailVendor(null);
    setNewEmail("");
    setAddEmailResult(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Vendor Management</h1>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => setWizardOpen(true)}
        >
          Provision Vendor
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-zinc-900 border-zinc-700 text-zinc-200"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          <span className="text-sm text-zinc-500">Loading vendor accounts...</span>
        </div>
      ) : filteredVendors.length === 0 && !search ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-lg text-zinc-300">No vendor accounts yet</p>
          <p className="text-sm text-zinc-500">
            Use 'Provision Vendor' to create the first vendor login.
          </p>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr className="text-xs text-zinc-400 uppercase tracking-wider">
                <th className="border-b border-zinc-800 px-4 py-3 text-left">Vendor</th>
                <th className="border-b border-zinc-800 px-4 py-3 text-left">Email</th>
                <th className="border-b border-zinc-800 px-4 py-3 text-left">Tier</th>
                <th className="border-b border-zinc-800 px-4 py-3 text-left">Last Login</th>
                <th className="border-b border-zinc-800 px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <LayoutGroup>
              <AnimatePresence initial={false}>
              {groupedVendors.length === 0 ? (
                <motion.tr
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500 text-sm">
                    No vendors match your search.
                  </td>
                </motion.tr>
              ) : (
                groupedVendors.map(([vendorName, logins]) => {
                  const hasMultiple = logins.length > 1;
                  const isExpanded = expandedVendors.has(vendorName);
                  const primary = logins[0];

                  return hasMultiple ? (
                    <React.Fragment key={vendorName}>
                      {/* Group header row */}
                      <motion.tr
                        layout
                        layoutId={`vendor-${vendorName}`}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.8 }}
                        className="border-b border-zinc-800/50 hover:bg-zinc-900/50 cursor-pointer"
                        onClick={() => toggleExpand(vendorName)}
                      >
                        <td className="px-4 py-3 text-sm text-zinc-200">
                          <div className="flex items-center gap-2">
                            <ChevronDown className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`} />
                            {vendorName}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-500">
                          {logins.length} emails
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <TierSelect tier={primary.tier} vendorName={vendorName} supabase={supabase} queryClient={queryClient} />
                            <button
                              onClick={(e) => { e.stopPropagation(); setDetailVendor(vendorName); }}
                              className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
                            >
                              {productCounts[vendorName] || 0} products
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500" />
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              title="Add email"
                              onClick={(e) => { e.stopPropagation(); setAddEmailVendor(primary); }}
                              className="p-1.5 rounded-md text-zinc-500 hover:text-green-400 hover:bg-zinc-800 transition-colors"
                            >
                              <UserPlus className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                      {/* Expanded email rows */}
                      <AnimatePresence>
                        {isExpanded && logins.map((vendor, i) => (
                          <motion.tr
                            layout
                            key={vendor.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto", transition: { delay: i * 0.04 } }}
                            exit={{ opacity: 0, height: 0, transition: { delay: (logins.length - 1 - i) * 0.03 } }}
                            className="border-b border-zinc-800/50 bg-zinc-900/30 overflow-hidden"
                          >
                            <td className="px-4 py-2 text-sm" />
                            <td className="px-4 py-2 text-sm text-zinc-400">{vendor.email}</td>
                            <td className="px-4 py-2" />
                            <td className="px-4 py-2 text-xs text-zinc-500">
                              {vendor.last_sign_in_at ? relativeDate(vendor.last_sign_in_at) : "Never"}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  title="Reset password"
                                  onClick={() => handleResetPassword(vendor)}
                                  disabled={loadingAction === `reset-${vendor.id}`}
                                  className="p-1.5 rounded-md text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                                >
                                  {loadingAction === `reset-${vendor.id}` ? <Loader2 className="animate-spin h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
                                </button>
                                <button
                                  title="Delete"
                                  onClick={() => handleDelete(vendor)}
                                  disabled={loadingAction === `delete-${vendor.id}`}
                                  className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                                >
                                  {loadingAction === `delete-${vendor.id}` ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </React.Fragment>
                  ) : (
                    /* Single email — flat row */
                    <motion.tr
                      layout
                      layoutId={`vendor-${primary.id}`}
                      key={primary.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.8 }}
                      className="border-b border-zinc-800/50 hover:bg-zinc-900/50"
                    >
                      <td className="px-4 py-3 text-sm text-zinc-200">{vendorName}</td>
                      <td className="px-4 py-3 text-sm text-zinc-400">{primary.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <TierSelect tier={primary.tier} vendorName={vendorName} supabase={supabase} queryClient={queryClient} />
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetailVendor(vendorName); }}
                            className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
                          >
                            {productCounts[vendorName] || 0} products
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {primary.last_sign_in_at ? relativeDate(primary.last_sign_in_at) : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="Reset password"
                            onClick={() => handleResetPassword(primary)}
                            disabled={loadingAction === `reset-${primary.id}`}
                            className="p-1.5 rounded-md text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                          >
                            {loadingAction === `reset-${primary.id}` ? <Loader2 className="animate-spin h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
                          </button>
                          <button
                            title="Add email"
                            onClick={() => setAddEmailVendor(primary)}
                            className="p-1.5 rounded-md text-zinc-500 hover:text-green-400 hover:bg-zinc-800 transition-colors"
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
                          <button
                            title="Delete"
                            onClick={() => handleDelete(primary)}
                            disabled={loadingAction === `delete-${primary.id}`}
                            className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                          >
                            {loadingAction === `delete-${primary.id}` ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
              </AnimatePresence>
              </LayoutGroup>
            </tbody>
          </table>
        </div>
      )}

      {/* Wizard Dialog */}
      <VendorWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-vendor-logins"] })}
      />

      {/* Product Subscriptions Detail Panel */}
      <VendorProductSubscriptionsPanel
        open={!!detailVendor}
        onOpenChange={(open) => { if (!open) setDetailVendor(null); }}
        vendorName={detailVendor || ""}
      />

      {/* Password Result Dialog */}
      <Dialog open={!!passwordResult} onOpenChange={() => setPasswordResult(null)}>
        <DialogContent className="max-w-sm bg-zinc-950 border-zinc-800">
          <div className="space-y-4">
            <p className="text-sm text-zinc-200 font-medium">New password generated</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-zinc-500 uppercase">Email</span>
                <span className="text-sm text-zinc-300">{passwordResult?.email}</span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 uppercase">Password</span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-green-400 font-mono select-all">
                    {passwordResult?.password}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(passwordResult?.password || "");
                      toast.success("Copied");
                    }}
                    className="p-2 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors"
                  >
                    <Copy className="h-4 w-4 text-zinc-400" />
                  </button>
                </div>
              </div>
            </div>
            <Button size="sm" onClick={() => setPasswordResult(null)} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Email Dialog */}
      <Dialog open={!!addEmailVendor} onOpenChange={() => closeAddEmail()}>
        <DialogContent className="max-w-sm bg-zinc-950 border-zinc-800">
          {!addEmailResult ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-200 font-medium">
                Add email to {addEmailVendor?.vendor_name}
              </p>
              <Input
                type="email"
                placeholder="new-user@company.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
                autoFocus
                className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={closeAddEmail} className="flex-1 text-zinc-400">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddEmail}
                  disabled={!EMAIL_REGEX.test(newEmail) || loadingAction === "add-email"}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30"
                >
                  {loadingAction === "add-email" ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : "Add"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-200 font-medium">Email added</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-zinc-500 uppercase">Email</span>
                  <span className="text-sm text-zinc-300">{addEmailResult.email}</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 uppercase">Password</span>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-green-400 font-mono select-all">
                      {addEmailResult.password}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(addEmailResult.password);
                        toast.success("Copied");
                      }}
                      className="p-2 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors"
                    >
                      <Copy className="h-4 w-4 text-zinc-400" />
                    </button>
                  </div>
                </div>
              </div>
              <Button size="sm" onClick={closeAddEmail} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200">
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorManagementPage;
