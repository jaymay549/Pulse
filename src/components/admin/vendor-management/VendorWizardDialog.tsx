import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { VendorTierBadge } from "./VendorTierBadge";

interface VendorWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const EMAIL_REGEX = /.+@.+\..+/;

const STEP_LABELS = ["Email", "Link Profile", "Set Tier", "Confirm"];

export function VendorWizardDialog({ open, onOpenChange, onSuccess }: VendorWizardDialogProps) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [tier, setTier] = useState("");

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
      toast.success(`Vendor provisioned. OTP invite sent to ${email}.`);
      onSuccess();
      handleClose();
    },
    onError: (err: Error) => {
      if (err.message.toLowerCase().includes("already")) {
        toast.error("This email already has a vendor account. Use 'Resend Invite' to send a new link.");
      } else {
        toast.error(err.message || "Failed to provision vendor. Please try again.");
      }
    },
  });

  const handleClose = () => {
    setStep(1);
    setEmail("");
    setVendorName("");
    setTier("");
    onOpenChange(false);
  };

  const isEmailValid = EMAIL_REGEX.test(email);
  const isVendorNameValid = vendorName.trim() !== "" && vendorProfiles.includes(vendorName);

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent className="max-w-md bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Provision Vendor</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="flex items-center gap-3">
            {STEP_LABELS.map((_, i) => {
              const stepNum = i + 1;
              const isActive = stepNum === step;
              const isCompleted = stepNum < step;
              return (
                <div key={stepNum} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isActive || isCompleted
                        ? "bg-blue-500"
                        : "border border-zinc-600"
                    }`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-6">
            {STEP_LABELS.map((label, i) => {
              const stepNum = i + 1;
              const isActive = stepNum === step;
              return (
                <span
                  key={label}
                  className={`text-xs ${isActive ? "text-zinc-200" : "text-zinc-400"}`}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {/* Step 1 - Email */}
          {step === 1 && (
            <div className="space-y-2">
              <Label htmlFor="wizard-email" className="text-zinc-300">
                Vendor Email
              </Label>
              <Input
                id="wizard-email"
                type="email"
                placeholder="vendor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-800 border-zinc-700 text-zinc-200"
              />
            </div>
          )}

          {/* Step 2 - Link Profile */}
          {step === 2 && (
            <div className="space-y-2">
              <Label htmlFor="wizard-vendor-name" className="text-zinc-300">
                Vendor Profile
              </Label>
              <Input
                id="wizard-vendor-name"
                list="vendor-profiles-list"
                placeholder="Search vendor profile..."
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className="w-full bg-zinc-800 border-zinc-700 text-zinc-200"
              />
              <datalist id="vendor-profiles-list">
                {vendorProfiles.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <p className="text-xs text-zinc-500">
                Select the existing vendor profile this account belongs to
              </p>
            </div>
          )}

          {/* Step 3 - Set Tier */}
          {step === 3 && (
            <div className="space-y-2">
              <Label className="text-zinc-300">Access Tier</Label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-zinc-200">
                  <SelectValue placeholder="Select a tier..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="unverified" className="text-zinc-200">
                    Unverified
                  </SelectItem>
                  <SelectItem value="tier_1" className="text-zinc-200">
                    Tier 1 ($12K)
                  </SelectItem>
                  <SelectItem value="tier_2" className="text-zinc-200">
                    Tier 2 ($25K)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500">
                Tier determines what data the vendor can access
              </p>
            </div>
          )}

          {/* Step 4 - Confirm */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-zinc-800 rounded-lg p-4 space-y-2">
                <p className="text-sm text-zinc-300">Email: {email}</p>
                <p className="text-sm text-zinc-300">Profile: {vendorName}</p>
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <span>Tier:</span>
                  <VendorTierBadge tier={tier} />
                </div>
              </div>
              <p className="text-sm text-zinc-400">
                An OTP invite will be sent automatically when you click Provision.
              </p>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {step > 1 && (
                <Button
                  variant="ghost"
                  onClick={() => setStep((s) => s - 1)}
                  disabled={provisionMutation.isPending}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  Back
                </Button>
              )}
            </div>
            <div>
              {step < 4 ? (
                <Button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={
                    (step === 1 && !isEmailValid) ||
                    (step === 2 && !isVendorNameValid) ||
                    (step === 3 && !tier)
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={() => provisionMutation.mutate()}
                  disabled={provisionMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 w-full text-white"
                >
                  {provisionMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Provisioning...
                    </>
                  ) : (
                    "Provision Vendor"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
