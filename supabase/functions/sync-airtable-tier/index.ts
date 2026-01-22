import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      console.error('Invalid method:', req.method);
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    console.log('Received webhook payload:', JSON.stringify(body));

    // Extract email and tier from payload
    // Airtable automations can send custom payloads
    const { email, tier, record_id } = body;

    if (!email) {
      console.error('Missing email in payload');
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tier) {
      console.error('Missing tier in payload');
      return new Response(
        JSON.stringify({ error: 'Tier is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize tier value (Airtable might send different formats)
    const normalizedTier = normalizeTier(tier);
    console.log(`Syncing tier for ${email}: ${tier} -> ${normalizedTier}`);

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update user's tier in profiles table
    const { data, error } = await supabase
      .from('profiles')
      .update({ tier: normalizedTier })
      .eq('email', email.toLowerCase().trim())
      .select();

    if (error) {
      console.error('Error updating profile:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update profile', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data || data.length === 0) {
      console.warn(`No profile found for email: ${email}`);
      return new Response(
        JSON.stringify({ 
          warning: 'No profile found for this email',
          email,
          message: 'User may not have signed up yet'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully updated tier for ${email} to ${normalizedTier}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        email,
        tier: normalizedTier,
        updated_profiles: data.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Normalize tier values from Airtable to match Supabase enum
// Airtable tiers:
// - "Circles Community" → free
// - "Circles Pro - Quarterly" → pro
// - "Circles Pro - Annual" → pro
// - "Circles Executive" → executive
// - "Circles Executive - Quarterly" → executive
// - "Circles Executive - Annual" → executive
function normalizeTier(tier: string): string {
  const tierLower = tier.toLowerCase().trim();
  
  // Check for executive first (before pro, in case of future "Executive Pro" tier)
  if (tierLower.includes('executive')) {
    return 'executive';
  }
  
  // Check for pro-related keywords
  if (tierLower.includes('pro')) {
    return 'pro';
  }
  
  // Community and anything else defaults to free
  return 'free';
}