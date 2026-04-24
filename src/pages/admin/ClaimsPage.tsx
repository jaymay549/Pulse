import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle, Copy, ExternalLink, Power, PowerOff } from "lucide-react";

interface VendorClaimLink {
  id: string;
  vendor_name: string;
  claim_token: string;
  admin_email: string;
  status: "created" | "started" | "submitted" | "activated" | "archived";
  is_active: boolean;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  submitted_at: string | null;
  activated_at: string | null;
  last_notified_at: string | null;
  company_website: string | null;
  company_description: string | null;
  contact_email: string | null;
  company_logo_url: string | null;
  is_approved: boolean;
  created_at: string;
}

interface VendorCandidateRow {
  vendor_name: string;
}

export default function ClaimsPage() {
  const supabase = useClerkSupabase();
  const queryClient = useQueryClient();
  const [vendorName, setVendorName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [latestClaimUrl, setLatestClaimUrl] = useState<string | null>(null);

  const { data: links = [], isLoading } = useQuery<VendorClaimLink[]>({
    queryKey: ["admin-vendor-claim-links"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_vendor_claim_links" as never);
      if (error) throw error;
      return (data ?? []) as VendorClaimLink[];
    },
  });

  const { data: vendorCandidates = [], isLoading: candidatesLoading } = useQuery<string[]>({
    queryKey: ["admin-unclaimed-vendor-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_unclaimed_vendor_candidates" as never, {
        p_query: null,
        p_limit: 250,
      } as never);
      if (error) throw error;
      const rows = (data ?? []) as VendorCandidateRow[];
      return rows.map((row) => row.vendor_name);
    },
  });

  const createLinkMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_create_vendor_claim_link" as never, {
        p_vendor_name: vendorName,
        p_admin_email: adminEmail,
      } as never);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as VendorClaimLink | null;
    },
    onSuccess: (link) => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-claim-links"] });
      setVendorName("");
      setAdminEmail("");
      if (link?.claim_token) {
        const url = `${window.location.origin}/claim/${link.claim_token}`;
        setLatestClaimUrl(url);
        navigator.clipboard.writeText(url).catch(() => {});
        toast.success("Claim link generated and copied.");
      } else {
        toast.success("Claim link generated.");
      }
    },
    onError: (err: Error) => toast.error(`Failed to create link: ${err.message}`),
  });

  const activateMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.rpc("admin_activate_vendor_claim_link" as never, {
        p_link_id: linkId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vendor activated.");
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-claim-links"] });
    },
    onError: (err: Error) => toast.error(`Failed to activate vendor: ${err.message}`),
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ linkId, isActive }: { linkId: string; isActive: boolean }) => {
      const { error } = await supabase.rpc("admin_set_vendor_claim_link_active" as never, {
        p_link_id: linkId,
        p_is_active: isActive,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-claim-links"] });
    },
    onError: (err: Error) => toast.error(`Failed to update link: ${err.message}`),
  });

  const completionPercent = (link: VendorClaimLink) => {
    const checks = [
      !!link.company_description,
    ];
    const complete = checks.filter(Boolean).length;
    return Math.round((complete / checks.length) * 100);
  };

  const submitted = useMemo(
    () => links.filter((link) => link.status === "submitted" || link.status === "activated"),
    [links]
  );
  const inProgress = useMemo(
    () => links.filter((link) => link.status === "created" || link.status === "started"),
    [links]
  );
  const archived = useMemo(() => links.filter((link) => link.status === "archived"), [links]);

  if (isLoading) {
    return <div className="p-6 text-zinc-400 text-sm">Loading claim links…</div>;
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Vendor Onboarding Claims</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Generate unique claim URLs, track onboarding status, and activate vendors after payment.
        </p>
      </div>

      <section className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/60 space-y-3">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
          Create claim link
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="vendor-name">Vendor name</Label>
            <Input
              id="vendor-name"
              list="unclaimed-vendor-candidates"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Select existing unclaimed vendor or type a new one"
            />
            <datalist id="unclaimed-vendor-candidates">
              {vendorCandidates.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <p className="text-[11px] text-zinc-500">
              {candidatesLoading
                ? "Loading unclaimed vendor suggestions..."
                : `Showing ${vendorCandidates.length} unclaimed vendor suggestions. You can also type a new vendor name.`}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-email">Admin notification email</Label>
            <Input
              id="admin-email"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="owner@cdgpulse.com"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => createLinkMutation.mutate()}
            disabled={createLinkMutation.isPending || !vendorName.trim() || !adminEmail.trim()}
          >
            {createLinkMutation.isPending ? "Generating..." : "Generate link"}
          </Button>
          {latestClaimUrl && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(latestClaimUrl).then(() => {
                  toast.success("Claim URL copied.");
                });
              }}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Copy latest URL
            </button>
          )}
        </div>
        {latestClaimUrl && (
          <p className="text-xs text-zinc-500 break-all">{latestClaimUrl}</p>
        )}
      </section>

      <section>
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">
          In Progress ({inProgress.length})
        </h2>
        {inProgress.length === 0 ? (
          <p className="text-sm text-zinc-500">No in-progress links.</p>
        ) : (
          <div className="space-y-3">
            {inProgress.map((link) => (
              <div
                key={link.id}
                className="border border-zinc-800 rounded-lg p-4 bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="font-medium text-zinc-100">{link.vendor_name}</p>
                    <p className="text-sm text-zinc-400">
                      Admin notify: {link.admin_email}
                    </p>
                    <p className="text-xs text-zinc-600">
                      Completion: {completionPercent(link)}% · Last opened:{" "}
                      {link.last_viewed_at
                        ? new Date(link.last_viewed_at).toLocaleString()
                        : "Not opened yet"}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100"
                      onClick={() => {
                        const url = `${window.location.origin}/claim/${link.claim_token}`;
                        navigator.clipboard.writeText(url).then(() => toast.success("Claim URL copied."));
                      }}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy link
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100"
                      onClick={() => archiveMutation.mutate({ linkId: link.id, isActive: false })}
                    >
                      <PowerOff className="h-4 w-4 mr-1" />
                      Archive
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">
          Submitted ({submitted.length})
        </h2>
        {submitted.length === 0 ? (
          <p className="text-sm text-zinc-500">No submitted profiles yet.</p>
        ) : (
          <div className="space-y-2">
            {submitted.map((link) => (
              <div
                key={link.id}
                className="border border-zinc-800 rounded-lg px-4 py-2.5 bg-zinc-900 flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-medium text-zinc-200">
                    {link.vendor_name}
                  </span>
                  <span className="text-xs text-zinc-500 ml-2">
                    Submitted {link.submitted_at ? new Date(link.submitted_at).toLocaleString() : "recently"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={link.status === "activated" ? "default" : "secondary"} className="text-xs">
                    {link.status}
                  </Badge>
                  {link.is_approved ? (
                    <Badge className="text-xs">approved</Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => activateMutation.mutate(link.id)}
                      disabled={activateMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Activate vendor
                    </Button>
                  )}
                  <LinkButton href={`/vendors/${encodeURIComponent(link.vendor_name)}`} label="Public profile" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {archived.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">
            Archived ({archived.length})
          </h2>
          <div className="space-y-2">
            {archived.map((link) => (
              <div
                key={link.id}
                className="border border-zinc-800 rounded-lg px-4 py-2.5 bg-zinc-900 flex items-center justify-between"
              >
                <span className="text-sm text-zinc-300">{link.vendor_name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100"
                  onClick={() => archiveMutation.mutate({ linkId: link.id, isActive: true })}
                >
                  <Power className="h-4 w-4 mr-1" />
                  Reopen
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
