import { useState, useMemo, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Check, ChevronRight, Search, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { VendorTierBadge } from "./VendorTierBadge";

function VendorAvatar({ name, logoUrl, size = "md" }: { name: string; logoUrl?: string | null; size?: "sm" | "md" }) {
  const [broken, setBroken] = useState(false);
  const px = size === "sm" ? "h-5 w-5" : "h-7 w-7";
  const textSize = size === "sm" ? "text-[9px]" : "text-[10px]";

  if (logoUrl && !broken) {
    return (
      <img
        src={logoUrl}
        alt=""
        onError={() => setBroken(true)}
        className={`${px} rounded-md object-contain bg-zinc-800 p-0.5 flex-shrink-0`}
      />
    );
  }

  return (
    <div className={`${px} rounded-md bg-zinc-800 flex items-center justify-center flex-shrink-0`}>
      <span className={`${textSize} font-semibold text-zinc-400`}>
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

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
  const [selectedProducts, setSelectedProducts] = useState<Record<string, string>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { fetchWithAuth } = useClerkAuth();
  const supabase = useClerkSupabase();

  interface VendorProfile {
    vendor_name: string;
    company_logo_url: string | null;
    category: string | null;
  }

  const { data: vendorProfiles = [] } = useQuery<VendorProfile[]>({
    queryKey: ["admin-vendor-profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_profiles")
        .select("vendor_name, company_logo_url, category")
        .order("vendor_name");
      if (error) throw error;
      return (data ?? []) as VendorProfile[];
    },
  });

  const filtered = useMemo(() => {
    if (!vendorSearch) return [];
    const q = vendorSearch.toLowerCase();
    return vendorProfiles.filter((v) => v.vendor_name.toLowerCase().includes(q)).slice(0, 3);
  }, [vendorSearch, vendorProfiles]);

  const selectedProfile = vendorProfiles.find((v) => v.vendor_name === vendorName);

  // Resolve entity ID from vendor name
  const { data: entityData } = useQuery({
    queryKey: ["wizard-vendor-entity", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resolve_vendor_family" as never, {
        p_vendor_name: vendorName,
      } as never);
      if (error) throw error;
      const rows = data as Array<{ vendor_entity_id: string | null; vendor_product_line_id: string | null }>;
      return rows?.[0]?.vendor_entity_id ?? null;
    },
    enabled: !!vendorName,
  });

  // Fetch product lines for the resolved entity
  const { data: productLines = [] } = useQuery({
    queryKey: ["wizard-product-lines", entityData],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_product_lines")
        .select("id, name, slug")
        .eq("vendor_entity_id", entityData!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; slug: string }>;
    },
    enabled: !!entityData,
  });

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

  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

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
            product_subscriptions: Object.entries(selectedProducts).map(([slug, productTier]) => ({
              product_line_slug: slug,
              tier: productTier,
            })),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to provision vendor");
      return data;
    },
    onSuccess: (data) => {
      setGeneratedPassword(data.password);
      onSuccess();
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
    setGeneratedPassword(null);
    setSelectedProducts({});
    onOpenChange(false);
  };

  const isEmailValid = EMAIL_REGEX.test(email);
  const isVendorNameValid = vendorName.trim() !== "" && vendorProfiles.some((v) => v.vendor_name === vendorName);

  const steps = ["Email", "Profile", "Tier", "Products", "Confirm"];

  const canAdvance =
    (step === 0 && isEmailValid) ||
    (step === 1 && isVendorNameValid) ||
    (step === 2 && !!tier) ||
    (step === 3 && (Object.keys(selectedProducts).length > 0 || productLines.length === 0));

  const advance = () => {
    if (step < steps.length - 1 && canAdvance) setStep(step + 1);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent className="max-w-sm p-0 bg-zinc-950 border-zinc-800 overflow-hidden">
        {/* Progress bar */}
        <div className="h-0.5 bg-zinc-800">
          <div
            className="h-full bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
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
                      className="absolute z-50 top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-[260px] overflow-y-auto"
                    >
                      {filtered.map((v) => (
                        <button
                          key={v.vendor_name}
                          type="button"
                          onClick={() => {
                            setVendorName(v.vendor_name);
                            setVendorSearch("");
                            setShowDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${
                            vendorName === v.vendor_name
                              ? "bg-blue-600/15 text-blue-300"
                              : "text-zinc-300 hover:bg-zinc-800/70"
                          }`}
                        >
                          <VendorAvatar name={v.vendor_name} logoUrl={v.company_logo_url} />
                          <div className="min-w-0">
                            <p className="text-sm truncate">{v.vendor_name}</p>
                            {v.category && (
                              <p className="text-[11px] text-zinc-500 truncate">{v.category}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {vendorName && selectedProfile && (
                  <div className="flex items-center gap-2 mt-1 px-1">
                    <VendorAvatar name={vendorName} logoUrl={selectedProfile.company_logo_url} size="sm" />
                    <span className="text-xs text-blue-400 flex items-center gap-1">
                      <Check className="h-3 w-3" /> {vendorName}
                    </span>
                  </div>
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

            {/* Step 3 — Products */}
            {step === 3 && (
              <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                <p className="text-sm text-zinc-400">Product line subscriptions</p>
                {productLines.length === 0 ? (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
                    <p className="text-sm text-zinc-500">
                      {entityData ? "No product lines configured for this vendor." : "Resolving vendor entity..."}
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">{entityData ? "Contact engineering to add product lines." : "You can skip this step — product lines can be added later."}</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {productLines.map((pl) => {
                      const isChecked = pl.slug in selectedProducts;
                      return (
                        <div
                          key={pl.slug}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${
                            isChecked
                              ? "border-blue-500/50 bg-blue-600/10"
                              : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                          }`}
                        >
                          <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setSelectedProducts((prev) => {
                                  if (e.target.checked) {
                                    return { ...prev, [pl.slug]: tier || "unverified" };
                                  } else {
                                    const { [pl.slug]: _, ...rest } = prev;
                                    return rest;
                                  }
                                });
                              }}
                              className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500/30"
                            />
                            <span className="text-sm text-zinc-200 truncate">{pl.name}</span>
                          </label>
                          {isChecked && (
                            <select
                              value={selectedProducts[pl.slug]}
                              onChange={(e) => setSelectedProducts((prev) => ({ ...prev, [pl.slug]: e.target.value }))}
                              className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-2 py-1 ml-2"
                            >
                              <option value="unverified">Unverified</option>
                              <option value="tier_1">Tier 1</option>
                              <option value="tier_2">Tier 2</option>
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {Object.keys(selectedProducts).length > 0 && (
                  <p className="text-xs text-blue-400">{Object.keys(selectedProducts).length} product line(s) selected</p>
                )}
              </div>
            )}

            {/* Step 4 — Confirm / Password result */}
            {step === 4 && !generatedPassword && (
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
                  <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">Products</span>
                    <span className="text-sm text-zinc-200">{Object.keys(selectedProducts).length} product line(s)</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">Tier</span>
                    <VendorTierBadge tier={tier} />
                  </div>
                </div>
                <p className="text-xs text-zinc-500 text-center">
                  A password will be generated for this vendor.
                </p>
              </div>
            )}

            {step === 4 && generatedPassword && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center space-y-1">
                  <Check className="h-8 w-8 text-green-400 mx-auto" />
                  <p className="text-sm text-zinc-200 font-medium">Vendor provisioned</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">Email</span>
                    <span className="text-sm text-zinc-200">{email}</span>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">Password</span>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-green-400 font-mono select-all">
                        {generatedPassword}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedPassword);
                          toast.success("Password copied");
                        }}
                        className="p-2 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors"
                      >
                        <Copy className="h-4 w-4 text-zinc-400" />
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 text-center">
                  Share these credentials with the vendor. This password won't be shown again.
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

            {generatedPassword ? (
              <Button
                size="sm"
                onClick={handleClose}
                className="bg-green-600 hover:bg-green-500 text-white text-xs px-5"
              >
                Done
              </Button>
            ) : step < steps.length - 1 ? (
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
