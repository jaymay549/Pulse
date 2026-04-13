import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { VendorTierBadge } from "@/components/admin/vendor-management/VendorTierBadge";
import { VendorWizardDialog } from "@/components/admin/vendor-management/VendorWizardDialog";

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
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

const VendorManagementPage = () => {
  const supabase = useClerkSupabase();
  const queryClient = useQueryClient();
  const { fetchWithAuth } = useClerkAuth();

  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const { data: vendors = [], isLoading } = useQuery<VendorLogin[]>({
    queryKey: ["admin-vendor-logins"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_vendor_logins" as never);
      if (error) throw error;
      return (data ?? []) as VendorLogin[];
    },
  });

  const filteredVendors = vendors.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.vendor_name.toLowerCase().includes(q) ||
      v.email.toLowerCase().includes(q)
    );
  });

  const handleResend = async (vendor: VendorLogin) => {
    setResendingId(vendor.id);
    try {
      const res = await fetchWithAuth(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/provision-vendor`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendor_email: vendor.email,
            action: "resend",
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend invite");
      toast.success(`OTP invite resent to ${vendor.email}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend invite. Please try again.");
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Vendor Management</h1>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => setWizardOpen(true)}
        >
          Provision Vendor
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-zinc-900 border-zinc-700 text-zinc-200"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          <span className="text-sm text-zinc-500">Loading vendor accounts...</span>
        </div>
      ) : filteredVendors.length === 0 && !search ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-lg text-zinc-300">No vendor accounts yet</p>
          <p className="text-sm text-zinc-500">
            Use 'Provision Vendor' to create the first vendor login and send an OTP invite.
          </p>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr className="text-xs text-zinc-400 uppercase tracking-wider">
                <th className="border-b border-zinc-800 px-4 py-3 text-left">Vendor Name</th>
                <th className="border-b border-zinc-800 px-4 py-3 text-left">Email</th>
                <th className="border-b border-zinc-800 px-4 py-3 text-left">Tier</th>
                <th className="border-b border-zinc-800 px-4 py-3 text-left">Created</th>
                <th className="border-b border-zinc-800 px-4 py-3 text-left">Last Login</th>
                <th className="border-b border-zinc-800 px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500 text-sm">
                    No vendors match your search.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((vendor) => (
                  <tr
                    key={vendor.id}
                    className="border-b border-zinc-800/50 hover:bg-zinc-900/50"
                  >
                    <td className="px-4 py-3 text-sm text-zinc-200">{vendor.vendor_name}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{vendor.email}</td>
                    <td className="px-4 py-3 text-sm">
                      <VendorTierBadge tier={vendor.tier} />
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {relativeDate(vendor.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {vendor.last_sign_in_at ? relativeDate(vendor.last_sign_in_at) : "Never"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        onClick={() => handleResend(vendor)}
                        disabled={resendingId === vendor.id}
                      >
                        {resendingId === vendor.id ? (
                          <Loader2 className="animate-spin h-3 w-3" />
                        ) : (
                          "Resend Invite"
                        )}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
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
    </div>
  );
};

export default VendorManagementPage;
