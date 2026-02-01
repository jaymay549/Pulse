import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  email: string;
  token_hash: string;
  type: string;
  redirect_to?: string;
}

// Simple email validation
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Send confirmation email function invoked");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Webhook secret is required for authentication
    if (!hookSecret) {
      console.error("SEND_EMAIL_HOOK_SECRET is not configured - rejecting request");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify webhook signature
    const signature = req.headers.get("webhook-signature");
    if (!signature || signature !== hookSecret) {
      console.error("Invalid or missing webhook signature");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const payload: EmailRequest = await req.json();
    
    // Validate email format
    if (!isValidEmail(payload.email)) {
      console.error("Invalid email format:", payload.email);
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    console.log("Received valid payload:", { email: payload.email, type: payload.type });

    const { email, token_hash, type, redirect_to } = payload;
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const confirmationLink = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${type}&redirect_to=${redirect_to || supabaseUrl}`;

    const emailResponse = await resend.emails.send({
      from: "CDG Circles <noreply@mail.cdgcircles.com>",
      to: [email],
      subject: "Welcome to CDG Circles - Confirm Your Email",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Confirm Your Email - CDG Circles</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 700;">CDG Circles</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Welcome to the Community</p>
            </div>
            
            <div style="background: #ffffff; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin-top: 0; font-size: 24px;">Confirm Your Email Address</h2>
              
              <p style="font-size: 16px; color: #555; line-height: 1.8;">
                Thank you for joining CDG Circles! We're excited to have you as part of our exclusive community.
              </p>
              
              <p style="font-size: 16px; color: #555; line-height: 1.8;">
                To complete your registration and access all member benefits, please confirm your email address:
              </p>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="${confirmationLink}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 16px 40px; 
                          text-decoration: none; 
                          border-radius: 8px; 
                          font-weight: 600;
                          font-size: 16px;
                          display: inline-block;
                          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                  Confirm My Email
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 35px;">
                Or copy and paste this link into your browser:
              </p>
              <p style="font-size: 12px; color: #667eea; word-break: break-all; background: #f8f9ff; padding: 15px; border-radius: 6px; border-left: 3px solid #667eea;">
                ${confirmationLink}
              </p>
              
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 35px 0;">
              
              <p style="font-size: 13px; color: #999; margin-bottom: 0; line-height: 1.6;">
                If you didn't create an account with CDG Circles, you can safely ignore this email. Your email address will not be used without confirmation.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding: 20px;">
              <p style="color: #666; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">CDG Circles</p>
              <p style="color: #999; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} CDG Circles. All rights reserved.
              </p>
              <p style="color: #999; font-size: 12px; margin: 10px 0 0 0;">
                The Premier Network for Car Dealership Professionals
              </p>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-confirmation-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
