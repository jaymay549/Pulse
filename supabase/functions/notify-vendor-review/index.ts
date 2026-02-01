import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReviewPayload {
  id: number;
  vendor_name: string;
  title: string;
  quote: string;
  type: "positive" | "warning";
  category: string;
  created_at: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { record } = await req.json() as { record: ReviewPayload };
    
    if (!record || !record.vendor_name) {
      return new Response(
        JSON.stringify({ error: "Missing review data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find verified vendor profile with matching name
    const { data: vendorProfile, error: profileError } = await supabase
      .from("vendor_profiles")
      .select("id, vendor_name, contact_email")
      .ilike("vendor_name", record.vendor_name)
      .eq("is_approved", true)
      .single();

    if (profileError || !vendorProfile?.contact_email) {
      console.log("No verified vendor found or no contact email:", record.vendor_name);
      return new Response(
        JSON.stringify({ message: "No verified vendor to notify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isPositive = record.type === "positive";
    const typeLabel = isPositive ? "Recommendation" : "Warning";
    const typeColor = isPositive ? "#16a34a" : "#dc2626";
    const typeEmoji = isPositive ? "👍" : "⚠️";

    // Send notification email
    const emailResponse = await resend.emails.send({
      from: "CDG Circles <notifications@mail.cdgcircles.com>",
      to: [vendorProfile.contact_email],
      subject: `${typeEmoji} New ${typeLabel} About ${vendorProfile.vendor_name}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
        <!-- Header -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
          <tr>
            <td style="text-align: center;">
              <span style="font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px;">CDG Circles</span>
            </td>
          </tr>
        </table>

        <!-- Main Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px;">
              <!-- Badge -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="background: ${typeColor}15; border-radius: 6px; padding: 6px 12px;">
                    <span style="color: ${typeColor}; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${typeEmoji} New ${typeLabel}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Title -->
              <h1 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #0f172a; line-height: 1.4;">
                ${record.title}
              </h1>
              
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #64748b;">
                ${record.category} • Just posted
              </p>

              <!-- Quote -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="border-left: 3px solid ${typeColor}; padding-left: 16px;">
                    <p style="margin: 0; font-size: 16px; color: #334155; line-height: 1.6; font-style: italic;">
                      "${record.quote}"
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background: #0f172a; border-radius: 8px;">
                    <a href="https://cdg-circle-hub.lovable.app/vendor-dashboard" 
                       style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500;">
                      View in Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 32px;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">
                You're receiving this because you're a verified vendor on CDG Circles.
              </p>
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                Respond to reviews from your dashboard to build trust with dealers.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    console.log("Vendor notification sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-vendor-review:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
