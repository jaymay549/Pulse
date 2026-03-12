import { useState, useEffect } from "react";
import { CalendarCheck, Loader2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { supabase as anonSupabase } from "@/integrations/supabase/client";

interface RequestDemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorName: string;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  dealership_name: string;
  location: string;
  message: string;
}

export function RequestDemoModal({ open, onOpenChange, vendorName }: RequestDemoModalProps) {
  const { isAuthenticated, user } = useClerkAuth();
  const clerkSupabase = useClerkSupabase();

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    dealership_name: "",
    location: "",
    message: "",
  });
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Prefill from Clerk user + members table when modal opens
  useEffect(() => {
    if (!open) return;
    setSubmitted(false);

    if (!isAuthenticated || !user) {
      setForm({ name: "", email: "", phone: "", dealership_name: "", location: "", message: "" });
      return;
    }

    const prefill: FormState = {
      name: user.name || "",
      email: user.email || "",
      phone: "",
      dealership_name: "",
      location: "",
      message: "",
    };

    setForm(prefill);

    // Try to enrich from members table
    const fetchMember = async () => {
      setIsPrefilling(true);
      try {
        const { data } = await (clerkSupabase as any)
          .from("members")
          .select("phone, dealership_name, city, state")
          .eq("clerk_user_id", user.id)
          .maybeSingle();

        if (data) {
          setForm((prev) => ({
            ...prev,
            phone: data.phone || prev.phone,
            dealership_name: data.dealership_name || prev.dealership_name,
            location:
              data.city && data.state
                ? `${data.city}, ${data.state}`
                : data.city || data.state || prev.location,
          }));
        }
      } catch {
        // Silently ignore — prefill is best-effort
      } finally {
        setIsPrefilling(false);
      }
    };

    fetchMember();
  }, [open, isAuthenticated, user?.id]);

  const isValid = form.name.trim() && form.email.trim() && form.message.trim();

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const { error } = await (anonSupabase as any).from("vendor_demo_requests").insert({
        vendor_name: vendorName,
        requester_name: form.name.trim(),
        requester_email: form.email.trim(),
        requester_phone: form.phone.trim() || null,
        dealership_name: form.dealership_name.trim() || null,
        location: form.location.trim() || null,
        message: form.message.trim(),
        clerk_user_id: user?.id || null,
      });

      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      console.error("Demo request submit failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {submitted ? (
          <div className="flex flex-col items-center text-center py-6 px-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
            <h2 className="text-lg font-bold text-slate-900 mb-1">Request sent!</h2>
            <p className="text-sm text-slate-500 mb-5">
              {vendorName} will be notified and can follow up directly with you.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <CalendarCheck className="h-4 w-4 text-primary" />
                Request a Demo — {vendorName}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 mt-1">
              {isPrefilling && (
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading your info…
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={set("name")}
                    placeholder="Your name"
                    className="w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    placeholder="you@example.com"
                    className="w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={set("phone")}
                    placeholder="(555) 000-0000"
                    className="w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={set("location")}
                    placeholder="City, State"
                    className="w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Dealership Name</label>
                <input
                  type="text"
                  value={form.dealership_name}
                  onChange={set("dealership_name")}
                  placeholder="Your dealership"
                  className="w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">
                  What do you want to learn? <span className="text-red-400">*</span>
                </label>
                <Textarea
                  value={form.message}
                  onChange={set("message")}
                  placeholder={`Tell ${vendorName} what you're looking for or any specific questions…`}
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send Request"
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
