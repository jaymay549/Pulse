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
  const isAdmin = payload.user_role === "admin";
  return { isAdmin, userId };
}

const VALID_TIERS = ["unverified", "tier_1", "tier_2"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { vendor_email, vendor_name, tier, action = "provision", _auth_token } = body;

    // Auth token passed in body (avoids Supabase gateway rejecting Clerk JWTs)
    const authToken = _auth_token || req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authToken) throw new Error("Missing auth token");

    const { isAdmin, userId } = verifyAdmin(authToken);
    if (!isAdmin) {
      throw new Error(
        `permission denied: admin role required (user: ${userId}).`
      );
    }

    // Validate required fields
    if (!vendor_email || typeof vendor_email !== "string" || vendor_email.trim() === "") {
      return new Response(
        JSON.stringify({ error: "vendor_email is required and must be a non-empty string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "provision") {
      if (!vendor_name || typeof vendor_name !== "string" || vendor_name.trim() === "") {
        return new Response(
          JSON.stringify({ error: "vendor_name is required and must be a non-empty string" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!tier || !VALID_TIERS.includes(tier)) {
        return new Response(
          JSON.stringify({ error: `tier must be one of: ${VALID_TIERS.join(", ")}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const publicAppUrl = Deno.env.get("PUBLIC_APP_URL") || "https://app.cdgpulse.com";
    const redirectUrl = `${publicAppUrl}/vendor-dashboard`;

    // Step 1: Try inviteUserByEmail — works for both new and existing users
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      vendor_email,
      {
        data: { vendor_name },
        redirectTo: redirectUrl,
      }
    );

    let vendorUserId: string;

    if (inviteError) {
      const isAlreadyRegistered = inviteError.message.toLowerCase().includes("already been registered");
      if (!isAlreadyRegistered) {
        throw inviteError;
      }

      // User already exists — generate a magic link to get their user_id and send new auth link
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: vendor_email,
        options: { redirectTo: redirectUrl },
      });

      if (linkError) throw linkError;

      vendorUserId = linkData.user.id;
    } else {
      vendorUserId = inviteData.user.id;
    }

    if (action === "provision") {
      // Upsert vendor_logins row — handles re-provisioning gracefully
      const { error: upsertError } = await supabase
        .from("vendor_logins")
        .upsert(
          {
            user_id: vendorUserId,
            vendor_name,
            tier,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (upsertError) throw upsertError;

      return new Response(
        JSON.stringify({ ok: true, user_id: vendorUserId, action: "provisioned" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // action === "resend"
    return new Response(
      JSON.stringify({ ok: true, user_id: vendorUserId, action: "resend_sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
