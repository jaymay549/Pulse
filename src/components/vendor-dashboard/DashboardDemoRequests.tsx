import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Loader2, ChevronDown } from "lucide-react";
import { useVendorDataClient } from "@/hooks/useVendorDataClient";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { GatedCard } from "./GatedCard";
import { AnimateOnScroll } from "./AnimateOnScroll";

interface DemoRequest {
  id: string;
  requester_name: string;
  requester_email: string;
  requester_phone: string | null;
  dealership_name: string | null;
  location: string | null;
  message: string;
  status: "new" | "contacted" | "completed" | "declined";
  created_at: string;
}

const STATUS_OPTIONS = ["new", "contacted", "completed", "declined"] as const;

const statusStyle: Record<DemoRequest["status"], string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  declined: "bg-slate-100 text-slate-500 border-slate-200",
};

function StatusDropdown({
  requestId,
  current,
  onUpdate,
}: {
  requestId: string;
  current: DemoRequest["status"];
  onUpdate: (id: string, status: DemoRequest["status"]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-colors",
          statusStyle[current]
        )}
      >
        {current.charAt(0).toUpperCase() + current.slice(1)}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-32 rounded-lg border border-border/50 bg-white shadow-lg py-1 text-xs">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  onUpdate(requestId, s);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 hover:bg-slate-50 transition-colors",
                  s === current && "font-semibold"
                )}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface DashboardDemoRequestsProps {
  vendorName: string;
}

export function DashboardDemoRequests({ vendorName }: DashboardDemoRequestsProps) {
  const supabase = useVendorDataClient();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["vendor-demo-requests", vendorName],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vendor_demo_requests")
        .select("id, requester_name, requester_email, requester_phone, dealership_name, location, message, status, created_at")
        .eq("vendor_name", vendorName)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DemoRequest[];
    },
    enabled: !!vendorName,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DemoRequest["status"] }) => {
      const { error } = await (supabase as any)
        .from("vendor_demo_requests")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-demo-requests", vendorName] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">Loading demo requests...</p>
      </div>
    );
  }

  const newCount = requests?.filter((r) => r.status === "new").length ?? 0;

  return (
    <div className="space-y-6">
      <AnimateOnScroll>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          Demo Requests
          {newCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-indigo-600 text-[10px] font-bold text-white">
              {newCount}
            </span>
          )}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Dealers who requested a demo from your vendor profile
        </p>
      </div>
      </AnimateOnScroll>

      <AnimateOnScroll delay={0.1}>
      {!requests?.length ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <CalendarCheck className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-500">No demo requests yet</p>
          <p className="text-xs text-slate-400 mt-1">
            When dealers request a demo on your profile page, they'll appear here.
          </p>
        </div>
      ) : (
        <GatedCard componentKey="demo-requests.request_cards">
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-xl border border-border/50 bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{req.requester_name}</span>
                    {req.dealership_name && (
                      <span className="text-[11px] text-slate-400">· {req.dealership_name}</span>
                    )}
                    {req.location && (
                      <span className="text-[11px] text-slate-400">· {req.location}</span>
                    )}
                  </div>
                  <GatedCard componentKey="demo-requests.contact_info">
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <a
                        href={`mailto:${req.requester_email}`}
                        className="text-xs text-primary hover:underline"
                      >
                        {req.requester_email}
                      </a>
                      {req.requester_phone && (
                        <span className="text-xs text-slate-400">{req.requester_phone}</span>
                      )}
                    </div>
                  </GatedCard>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[11px] text-slate-400">
                    {new Date(req.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <StatusDropdown
                    requestId={req.id}
                    current={req.status}
                    onUpdate={(id, status) => updateStatus.mutate({ id, status })}
                  />
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-lg px-3 py-2.5 border border-border/40">
                {req.message}
              </p>
            </div>
          ))}
        </div>
        </GatedCard>
      )}
      </AnimateOnScroll>
    </div>
  );
}
