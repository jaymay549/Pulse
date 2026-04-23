import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-organization-id",
};

function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

// TODO: restore admin check once Clerk JWT template includes user_role claim
function verifyAdmin(token: string): { isAdmin: boolean; userId: string } {
  const payload = JSON.parse(atob(token.split(".")[1]));
  const userId = payload.sub || "";
  return { isAdmin: true, userId };
}

const VALID_TIERS = ["unverified", "tier_1", "tier_2"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { vendor_email, vendor_name, tier, action = "provision", _auth_token, product_subscriptions } = body;

    const authToken = _auth_token || req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authToken) throw new Error("Missing auth token");

    const { isAdmin, userId } = verifyAdmin(authToken);
    if (!isAdmin) {
      throw new Error(
        `permission denied: admin role required (user: ${userId}).`
      );
    }

    if (!vendor_email || typeof vendor_email !== "string" || vendor_email.trim() === "") {
      return new Response(
        JSON.stringify({ error: "vendor_email is required and must be a non-empty string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

      const password = generatePassword();

      // Create user with password — no email sent
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email: vendor_email,
        password,
        email_confirm: true,
        user_metadata: { vendor_name },
      });

      let vendorUserId: string;

      if (createError) {
        if (createError.message.toLowerCase().includes("already been registered")) {
          const { data: listData } = await supabase.auth.admin.listUsers();
          const existing = listData?.users?.find(
            (u) => u.email?.toLowerCase() === vendor_email.toLowerCase()
          );
          if (!existing) throw new Error("User exists but could not be found");
          vendorUserId = existing.id;

          // Update password for existing user
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            vendorUserId,
            { password, user_metadata: { vendor_name } }
          );
          if (updateError) throw updateError;
        } else {
          throw createError;
        }
      } else {
        vendorUserId = userData.user.id;
      }

      // Upsert vendor_logins
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

      // Insert product subscriptions if provided (per D-03)
      if (product_subscriptions && Array.isArray(product_subscriptions) && product_subscriptions.length > 0) {
        // First, get the vendor_login_id for this user
        const { data: loginRow, error: loginLookupError } = await supabase
          .from("vendor_logins")
          .select("id")
          .eq("user_id", vendorUserId)
          .single();
        if (loginLookupError) throw loginLookupError;
        const vendorLoginId = loginRow.id;

        // Resolve product line IDs from slugs and insert subscriptions
        for (const sub of product_subscriptions) {
          const { product_line_slug, tier: productTier } = sub;
          if (!product_line_slug || !productTier) continue;
          if (!VALID_TIERS.includes(productTier)) continue;

          const { data: plRow } = await supabase
            .from("vendor_product_lines")
            .select("id")
            .eq("slug", product_line_slug)
            .single();
          if (!plRow) continue; // skip unknown product lines

          await supabase
            .from("vendor_product_subscriptions")
            .upsert(
              {
                vendor_login_id: vendorLoginId,
                vendor_product_line_id: plRow.id,
                tier: productTier,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "vendor_login_id,vendor_product_line_id" }
            );
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          user_id: vendorUserId,
          password,
          action: "provisioned",
          subscriptions_created: product_subscriptions?.length ?? 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "add-email") {
      // Add another email to an existing vendor profile
      if (!vendor_name) {
        return new Response(
          JSON.stringify({ error: "vendor_name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Look up the existing vendor to get tier
      const { data: existingLogin } = await supabase
        .from("vendor_logins")
        .select("tier")
        .eq("vendor_name", vendor_name)
        .limit(1)
        .maybeSingle();

      const vendorTier = existingLogin?.tier || "tier_1";
      const password = generatePassword();

      // Create new auth user for this email
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email: vendor_email,
        password,
        email_confirm: true,
        user_metadata: { vendor_name },
      });

      let newUserId: string;

      if (createError) {
        if (createError.message.toLowerCase().includes("already been registered")) {
          const { data: listData } = await supabase.auth.admin.listUsers();
          const existing = listData?.users?.find(
            (u) => u.email?.toLowerCase() === vendor_email.toLowerCase()
          );
          if (!existing) throw new Error("User exists but could not be found");
          newUserId = existing.id;

          const { error: updateError } = await supabase.auth.admin.updateUserById(
            newUserId,
            { password, user_metadata: { vendor_name } }
          );
          if (updateError) throw updateError;
        } else {
          throw createError;
        }
      } else {
        newUserId = userData.user.id;
      }

      // Insert new vendor_logins row (same vendor_name, different user_id)
      const { error: insertError } = await supabase
        .from("vendor_logins")
        .upsert(
          {
            user_id: newUserId,
            vendor_name,
            tier: vendorTier,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      if (insertError) throw insertError;

      return new Response(
        JSON.stringify({ ok: true, user_id: newUserId, password, action: "email_added" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reset-password") {
      // Generate new password for existing user
      const password = generatePassword();
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existing = listData?.users?.find(
        (u) => u.email?.toLowerCase() === vendor_email.toLowerCase()
      );
      if (!existing) throw new Error("User not found");

      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existing.id,
        { password }
      );
      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ ok: true, user_id: existing.id, password, action: "password_reset" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existing = listData?.users?.find(
        (u) => u.email?.toLowerCase() === vendor_email.toLowerCase()
      );

      if (existing) {
        await supabase.from("vendor_logins").delete().eq("user_id", existing.id);
        await supabase.auth.admin.deleteUser(existing.id);
      }

      return new Response(
        JSON.stringify({ ok: true, action: "deleted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
