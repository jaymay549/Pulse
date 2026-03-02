import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-organization-id",
};

function verifyAdmin(token: string): { isAdmin: boolean; userId: string } {
  const payload = JSON.parse(atob(token.split(".")[1]));
  const userId = payload.sub || "";

  // Primary: check env-var allowlist of Clerk user IDs
  const adminIds = (Deno.env.get("ADMIN_CLERK_IDS") || "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  if (adminIds.length > 0 && adminIds.includes(userId)) {
    return { isAdmin: true, userId };
  }

  // Fallback: check JWT claims (if user_role is ever added to the template)
  if (payload.user_role === "admin") {
    return { isAdmin: true, userId };
  }

  return { isAdmin: false, userId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { vendor_name, _auth_token } = body;

    // Auth token passed in body (avoids Supabase gateway rejecting Clerk JWTs)
    const authToken = _auth_token || req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authToken) throw new Error("Missing auth token");

    const { isAdmin, userId } = verifyAdmin(authToken);
    if (!isAdmin) {
      throw new Error(
        `permission denied: admin role required (user: ${userId}). ` +
        `Add this ID to ADMIN_CLERK_IDS secret.`
      );
    }

    if (!vendor_name) throw new Error("vendor_name is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Try to find existing profile
    const { data: existing } = await supabase
      .from("vendor_profiles")
      .select("id, vendor_name, is_approved")
      .eq("vendor_name", vendor_name)
      .maybeSingle();

    // Fetch vendor_metadata for seeding
    const { data: meta } = await supabase
      .from("vendor_metadata")
      .select("website_url, company_logo_url, description, linkedin_url, banner_url, tagline, headquarters")
      .eq("vendor_name", vendor_name)
      .maybeSingle();

    if (existing) {
      // Backfill empty profiles from vendor_metadata
      const { data: full } = await supabase
        .from("vendor_profiles")
        .select("*")
        .eq("id", existing.id)
        .single();

      const isEmpty = full && !full.company_website && !full.company_logo_url
        && !full.tagline && !full.company_description && !full.banner_url;

      if (isEmpty && meta) {
        await supabase
          .from("vendor_profiles")
          .update({
            company_website: meta.website_url || null,
            company_logo_url: meta.company_logo_url || null,
            company_description: meta.description || null,
            linkedin_url: meta.linkedin_url || null,
            banner_url: meta.banner_url || null,
            tagline: meta.tagline || null,
            headquarters: meta.headquarters || null,
          })
          .eq("id", existing.id);
      }

      return new Response(JSON.stringify(existing), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create new profile seeded from vendor_metadata
    const { data: created, error: insertError } = await supabase
      .from("vendor_profiles")
      .insert({
        vendor_name,
        is_approved: true,
        approved_at: new Date().toISOString(),
        company_website: meta?.website_url || null,
        company_logo_url: meta?.company_logo_url || null,
        company_description: meta?.description || null,
        linkedin_url: meta?.linkedin_url || null,
        banner_url: meta?.banner_url || null,
        tagline: meta?.tagline || null,
        headquarters: meta?.headquarters || null,
      })
      .select("id, vendor_name, is_approved")
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify(created), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
