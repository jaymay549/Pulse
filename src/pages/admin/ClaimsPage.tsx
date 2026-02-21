import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, XCircle } from "lucide-react";

interface VendorClaim {
  id: string;
  vendor_name: string;
  claimant_name: string;
  claimant_email: string;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  claimant_user_id: string;
  created_at: string;
}

export default function ClaimsPage() {
  const supabase = useClerkSupabase();
  const queryClient = useQueryClient();

  const { data: claims = [], isLoading } = useQuery<VendorClaim[]>({
    queryKey: ["admin-vendor-claims"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_vendor_claims" as never);
      if (error) throw error;
      return (data ?? []) as VendorClaim[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({
      claimId,
      vendorName,
      claimantUserId,
    }: {
      claimId: string;
      vendorName: string;
      claimantUserId: string;
    }) => {
      const { error } = await supabase.rpc("approve_vendor_claim" as never, {
        p_claim_id: claimId,
        p_vendor_name: vendorName,
        p_claimant_user_id: claimantUserId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Claim approved — vendor profile created.");
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-claims"] });
    },
    onError: () => toast.error("Failed to approve claim."),
  });

  const rejectMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const { error } = await supabase.rpc("reject_vendor_claim" as never, {
        p_claim_id: claimId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Claim rejected.");
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-claims"] });
    },
    onError: () => toast.error("Failed to reject claim."),
  });

  const pending = claims.filter(c => c.status === "pending");
  const resolved = claims.filter(c => c.status !== "pending");

  if (isLoading) {
    return (
      <div className="p-6 text-zinc-400 text-sm">Loading claims…</div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Vendor Claims</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Review and approve vendor ownership requests.
        </p>
      </div>

      {/* Pending */}
      <section>
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-zinc-500">No pending claims.</p>
        ) : (
          <div className="space-y-3">
            {pending.map(claim => (
              <div
                key={claim.id}
                className="border border-zinc-800 rounded-lg p-4 bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="font-medium text-zinc-100">{claim.vendor_name}</p>
                    <p className="text-sm text-zinc-400">
                      {claim.claimant_name} · {claim.claimant_email}
                    </p>
                    {claim.note && (
                      <p className="text-sm text-zinc-500 italic">
                        "{claim.note}"
                      </p>
                    )}
                    <p className="text-xs text-zinc-600">
                      {new Date(claim.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-400 border-red-900 hover:bg-red-950"
                      onClick={() => rejectMutation.mutate(claim.id)}
                      disabled={rejectMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        approveMutation.mutate({
                          claimId: claim.id,
                          vendorName: claim.vendor_name,
                          claimantUserId: claim.claimant_user_id,
                        })
                      }
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Resolved */}
      {resolved.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">
            Resolved ({resolved.length})
          </h2>
          <div className="space-y-2">
            {resolved.map(claim => (
              <div
                key={claim.id}
                className="border border-zinc-800 rounded-lg px-4 py-2.5 bg-zinc-900 flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-medium text-zinc-200">
                    {claim.vendor_name}
                  </span>
                  <span className="text-xs text-zinc-500 ml-2">
                    {claim.claimant_name}
                  </span>
                </div>
                <Badge
                  variant={claim.status === "approved" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {claim.status}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
