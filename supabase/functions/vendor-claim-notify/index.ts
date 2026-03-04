import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendSlack(webhookUrl: string, text: string): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook failed (${res.status})`);
  }
}

async function sendResendEmail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend failed (${res.status}): ${body}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return jsonResponse({ error: "token is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "missing Supabase env" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: link, error: linkError } = await supabase
      .from("vendor_claim_links")
      .select("id, vendor_name, admin_email, status, claim_token, submitted_at, last_notified_at")
      .eq("claim_token", token)
      .maybeSingle();

    if (linkError) throw linkError;
    if (!link) return jsonResponse({ error: "claim link not found" }, 404);
    if (link.status !== "submitted" && link.status !== "activated") {
      return jsonResponse({ ok: true, skipped: true, reason: "not submitted yet" });
    }

    const claimUrl = `${Deno.env.get("PUBLIC_APP_URL") || "https://app.cdgpulse.com"}/claim/${link.claim_token}`;
    const profileUrl = `${Deno.env.get("PUBLIC_APP_URL") || "https://app.cdgpulse.com"}/vendors/${encodeURIComponent(link.vendor_name)}`;

    const summary = `Vendor onboarding completed for ${link.vendor_name}.
Admin contact: ${link.admin_email}
Claim link: ${claimUrl}
Public profile: ${profileUrl}`;

    const slackWebhook = Deno.env.get("SLACK_WEBHOOK_URL");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") || "CDG Pulse <onboarding@cdgpulse.com>";

    const channels: string[] = [];
    const errors: string[] = [];

    if (slackWebhook) {
      try {
        await sendSlack(slackWebhook, `:white_check_mark: ${summary}`);
        channels.push("slack");
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "slack send failed");
      }
    }

    if (resendApiKey && link.admin_email) {
      try {
        await sendResendEmail(
          resendApiKey,
          resendFrom,
          link.admin_email,
          `Vendor onboarding completed: ${link.vendor_name}`,
          `<p>Vendor onboarding is complete for <strong>${link.vendor_name}</strong>.</p>
           <p><a href="${claimUrl}">Open claim link</a><br />
           <a href="${profileUrl}">View public profile</a></p>`
        );
        channels.push("email");
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "email send failed");
      }
    }

    await supabase
      .from("vendor_claim_links")
      .update({ last_notified_at: new Date().toISOString() })
      .eq("id", link.id);

    return jsonResponse({ ok: true, channels, errors });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "unknown error" },
      400
    );
  }
});
