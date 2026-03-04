import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import cdgPulseLogo from "@/assets/cdg-pulse-logo.png";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface ClaimLinkData {
  link_id: string;
  vendor_name: string;
  admin_email: string;
  status: "created" | "started" | "submitted" | "activated" | "archived";
  is_active: boolean;
  claim_token: string;
  company_website: string | null;
  company_description: string | null;
  contact_email: string | null;
  company_logo_url: string | null;
  tagline: string | null;
  linkedin_url: string | null;
  headquarters: string | null;
}

interface FormState {
  tagline: string;
  companyDescription: string;
  companyWebsite: string;
  contactEmail: string;
  linkedinUrl: string;
  headquarters: string;
}

export default function VendorClaimPage() {
  const { token } = useParams<{ token: string }>();
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const claimQuery = useQuery({
    queryKey: ["public-claim-link", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_get_vendor_claim_link" as never, {
        p_token: token,
      } as never);
      if (error) throw error;
      const row = ((data ?? [])[0] ?? null) as ClaimLinkData | null;
      return row;
    },
    enabled: !!token,
    retry: false,
  });

  const initialState = useMemo<FormState>(() => {
    const data = claimQuery.data;
    return {
      tagline: data?.tagline ?? "",
      companyDescription: data?.company_description ?? "",
      companyWebsite: data?.company_website ?? "",
      contactEmail: data?.contact_email ?? "",
      linkedinUrl: data?.linkedin_url ?? "",
      headquarters: data?.headquarters ?? "",
    };
  }, [claimQuery.data]);

  const [form, setForm] = useState<FormState>(initialState);

  useEffect(() => {
    setForm(initialState);
  }, [initialState]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("public_submit_vendor_claim_link" as never, {
        p_token: token,
        p_company_website: form.companyWebsite,
        p_company_description: form.companyDescription,
        p_contact_email: form.contactEmail,
        p_company_logo_url: claimQuery.data?.company_logo_url ?? null,
        p_tagline: form.tagline,
        p_linkedin_url: form.linkedinUrl,
        p_headquarters: form.headquarters,
      } as never);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as {
        link_id: string;
        vendor_name: string;
        admin_email: string;
      } | null;
    },
    onSuccess: async () => {
      setSubmitted(true);
      toast.success("Thanks - your profile was submitted for admin approval.");
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/vendor-claim-notify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ token }),
        });
      } catch {
        // Notification is best-effort; onboarding submit should still succeed.
      }
    },
    onError: (error: Error) => {
      toast.error(`Could not submit profile: ${error.message}`);
    },
  });

  const profileLink = claimQuery.data
    ? `/vendors/${encodeURIComponent(claimQuery.data.vendor_name)}`
    : "/vendors";

  const isLoading = claimQuery.isLoading;
  const link = claimQuery.data;
  const invalid = !isLoading && !link;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <img src={cdgPulseLogo} alt="CDG Pulse" className="h-8" />
          <div className="mt-8 rounded-xl border bg-white p-6">
            <h1 className="text-2xl font-semibold text-slate-900">Invalid claim link</h1>
            <p className="mt-2 text-sm text-slate-500">
              This claim URL is not active. Contact the CDG Pulse team for a new onboarding link.
            </p>
            <Link to="/vendors" className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
              Browse vendor profiles
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <img src={cdgPulseLogo} alt="CDG Pulse" className="h-8" />

        <div className="mt-6 rounded-xl border bg-white p-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            Claim and complete your vendor profile
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            You are onboarding for <strong>{link?.vendor_name}</strong>. This link is reusable, so you can return to it any time to update and resubmit.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-slate-50 p-4">
              <h2 className="text-sm font-semibold text-slate-800">What verified vendors get</h2>
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" /> Public profile ownership + updates</li>
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" /> Better brand presentation to dealers</li>
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" /> Priority visibility for verified status</li>
              </ul>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4">
              <h2 className="text-sm font-semibold text-slate-800">Current public profile</h2>
              <p className="mt-2 text-sm text-slate-600">
                Review your current listing, then complete the onboarding form below.
              </p>
              <Link
                to={profileLink}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                View public profile <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {!showForm && !submitted && (
            <div className="mt-6">
              <Button onClick={() => setShowForm(true)}>Start profile form</Button>
            </div>
          )}

          {(showForm || submitted) && (
            <form
              className="mt-6 space-y-4"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitMutation.mutate();
              }}
            >
              <div>
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={form.tagline}
                  onChange={(e) => setForm((prev) => ({ ...prev, tagline: e.target.value }))}
                  placeholder="A short one-line summary"
                />
              </div>
              <div>
                <Label htmlFor="description">Company description *</Label>
                <Textarea
                  id="description"
                  required
                  rows={4}
                  value={form.companyDescription}
                  onChange={(e) => setForm((prev) => ({ ...prev, companyDescription: e.target.value }))}
                  placeholder="What your company does, who you serve, and what makes you different."
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="website">Company website *</Label>
                  <Input
                    id="website"
                    required
                    value={form.companyWebsite}
                    onChange={(e) => setForm((prev) => ({ ...prev, companyWebsite: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label htmlFor="contact-email">Contact email *</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    required
                    value={form.contactEmail}
                    onChange={(e) => setForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
                    placeholder="team@company.com"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="linkedin-url">LinkedIn URL</Label>
                  <Input
                    id="linkedin-url"
                    value={form.linkedinUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, linkedinUrl: e.target.value }))}
                    placeholder="https://linkedin.com/company/..."
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="hq">Headquarters</Label>
                <Input
                  id="hq"
                  value={form.headquarters}
                  onChange={(e) => setForm((prev) => ({ ...prev, headquarters: e.target.value }))}
                  placeholder="City, State/Country"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={submitMutation.isPending || submitted}>
                  {submitMutation.isPending ? "Submitting..." : submitted ? "Submitted" : "Submit for admin approval"}
                </Button>
                <span className="text-xs text-slate-500">
                  Submission notifies the admin; assets can be finalized in verified profile editing.
                </span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
