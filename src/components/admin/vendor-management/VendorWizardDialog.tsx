import { useState, useMemo, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Check, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { VendorTierBadge } from "./VendorTierBadge";

interface VendorWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const EMAIL_REGEX = /.+@.+\..+/;

const TIERS = [
  { value: "unverified", label: "Unverified", desc: "No data access" },
  { value: "tier_1", label: "Tier 1", desc: "$12K — Market intel, leaderboard" },
  { value: "tier_2", label: "Tier 2", desc: "$25K — Full insights + action plans" },
] as const;

export function VendorWizardDialog({ open, onOpenChange, onSuccess }: VendorWizardDialogProps) {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [tier, setTier] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { fetchWithAuth } = useClerkAuth();
  const supabase = useClerkSupabase();

  const { data: vendorProfiles = [] } = useQuery<string[]>({
    queryKey: ["admin-vendor-profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_profiles")
        .select("vendor_name")
        .order("vendor_name");
      if (error) throw error;
      return (data ?? []).map((row) => row.vendor_name);
    },
  });

  const filtered = useMemo(() => {
    if (!vendorSearch) return vendorProfiles.slice(0, 8);
    const q = vendorSearch.toLowerCase();
    return vendorProfiles.filter((n) => n.toLowerCase().includes(q)).slice(0, 8);
  }, [vendorSearch, vendorProfiles]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const provisionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/provision-vendor`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendor_email: email,
            vendor_name: vendorName,
            tier,
            action: "provision",
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to provision vendor");
      return data;
    },
    onSuccess: () => {
      toast.success(`Invite sent to ${email}`);
      onSuccess();
      handleClose();
    },
    onError: (err: Error) => {
      if (err.message.toLowerCase().includes("already")) {
        toast.error("Email already provisioned — use Resend Invite instead.");
      } else {
        toast.error(err.message);
      }
    },
  });

  const handleClose = () => {
    setStep(0);
    setEmail("");
    setVendorName("");
    setVendorSearch("");
    setTier("");
    setShowDropdown(false);
    onOpenChange(false);
  };

  const isEmailValid = EMAIL_REGEX.test(email);
  const isVendorNameValid = vendorName.trim() !== "" && vendorProfiles.includes(vendorName);

  const canAdvance =
    (step === 0 && isEmailValid) ||
    (step === 1 && isVendorNameValid) ||
    (step === 2 && !!tier);

  const advance = () => {
    if (step < 3 && canAdvance) setStep(step + 1);
  };

  const steps = ["Email", "Profile", "Tier", "Confirm"];

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent className="max-w-sm p-0 bg-zinc-950 border-zinc-800 overflow-hidden">
        {/* Progress bar */}
        <div className="h-0.5 bg-zinc-800">
          <div
            className="h-full bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${((step + 1) / 4) * 100}%` }}
          />
        </div>

        <div className="px-6 pt-4 pb-6">
          {/* Step labels */}
          <div className="flex items-center gap-1 mb-6">
            {steps.map((label, i) => (
              <div key={label} className="flex items-center">
                <span
                  className={`text-[11px] tracking-wide transition-colors duration-300 ${
                    i === step
                      ? "text-zinc-100 font-medium"
                      : i < step
                      ? "text-blue-400"
                      : "text-zinc-600"
                  }`}
                >
                  {i < step ? <Check className="inline h-3 w-3 -mt-0.5" /> : null}
                  {i < step ? "" : label}
                </span>
                {i < steps.length - 1 && (
                  <ChevronRight className="h-3 w-3 mx-1 text-zinc-700" />
                )}
              </div>
            ))}
          </div>

          {/* Step content with slide animation */}
          <div className="min-h-[120px]">
            {/* Step 0 — Email */}
            {step === 0 && (
              <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                <p className="text-sm text-zinc-400">Vendor email address</p>
                <Input
                  type="email"
                  placeholder="vendor@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canAdvance && advance()}
                  autoFocus
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-blue-500/30 focus-visible:border-zinc-700"
                />
              </div>
            )}

            {/* Step 1 — Profile selector */}
            {step === 1 && (
              <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                <p className="text-sm text-zinc-400">Link to vendor profile</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
                  <Input
                    ref={searchRef}
                    placeholder="Search vendors..."
                    value={vendorName || vendorSearch}
                    onChange={(e) => {
                      setVendorSearch(e.target.value);
                      setVendorName("");
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    autoFocus
                    className="pl-9 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-blue-500/30 focus-visible:border-zinc-700"
                  />
                  {showDropdown && filtered.length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute z-50 top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                    >
                      {filtered.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            setVendorName(name);
                            setVendorSearch("");
                            setShowDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            vendorName === name
                              ? "bg-blue-600/20 text-blue-300"
                              : "text-zinc-300 hover:bg-zinc-800"
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {vendorName && (
                  <p className="text-xs text-blue-400 flex items-center gap-1">
                    <Check className="h-3 w-3" /> {vendorName}
                  </p>
                )}
              </div>
            )}

            {/* Step 2 — Tier */}
            {step === 2 && (
              <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                <p className="text-sm text-zinc-400">Access tier</p>
                <div className="space-y-2">
                  {TIERS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTier(t.value)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-all duration-200 ${
                        tier === t.value
                          ? "border-blue-500/50 bg-blue-600/10"
                          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm text-zinc-200">{t.label}</span>
                          <p className="text-xs text-zinc-500 mt-0.5">{t.desc}</p>
                        </div>
                        {tier === t.value && (
                          <Check className="h-4 w-4 text-blue-400 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3 — Confirm */}
            {step === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">Email</span>
                    <span className="text-sm text-zinc-200">{email}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">Profile</span>
                    <span className="text-sm text-zinc-200">{vendorName}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">Tier</span>
                    <VendorTierBadge tier={tier} />
                  </div>
                </div>
                <p className="text-xs text-zinc-500 text-center">
                  An OTP invite will be sent automatically.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-800/50">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                disabled={provisionMutation.isPending}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <Button
                size="sm"
                onClick={advance}
                disabled={!canAdvance}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-5 disabled:opacity-30"
              >
                Continue
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => provisionMutation.mutate()}
                disabled={provisionMutation.isPending}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-5"
              >
                {provisionMutation.isPending ? (
                  <Loader2 className="animate-spin h-3.5 w-3.5" />
                ) : (
                  "Provision"
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
