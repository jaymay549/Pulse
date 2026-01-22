import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// Map Stripe price IDs or product metadata to tier names
async function getTierFromSubscription(stripe: Stripe, subscription: Stripe.Subscription): Promise<string> {
  const item = subscription.items.data[0];
  if (!item) {
    console.log('No subscription item found, defaulting to free');
    return 'free';
  }
  
  const price = item.price;
  let product: Stripe.Product | null = null;
  
  // Fetch the product if we only have an ID
  const productId = typeof price.product === 'string' ? price.product : price.product?.id;
  if (productId) {
    try {
      product = await stripe.products.retrieve(productId);
      console.log('Fetched product:', product.name);
      console.log('Product metadata:', JSON.stringify(product.metadata));
    } catch (err) {
      console.error('Failed to fetch product:', err);
    }
  }
  
  // Check product metadata for tier
  if (product?.metadata?.tier) {
    console.log('Found tier in product metadata:', product.metadata.tier);
    return product.metadata.tier;
  }
  
  // Check price metadata for tier
  if (price.metadata?.tier) {
    console.log('Found tier in price metadata:', price.metadata.tier);
    return price.metadata.tier;
  }
  
  // Fallback: check price nickname or product name for keywords
  const priceName = price.nickname?.toLowerCase() || '';
  const productName = product?.name?.toLowerCase() || '';
  const combined = `${priceName} ${productName}`;
  
  console.log('Fallback check - combined name:', combined);
  
  if (combined.includes('executive')) return 'executive';
  if (combined.includes('pro')) return 'pro';
  if (combined.includes('verified vendor') || combined.includes('verified_vendor')) return 'verified_vendor';
  if (combined.includes('viewer')) return 'viewer';
  
  return 'free';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');
    const airtableBaseId = Deno.env.get('AIRTABLE_BASE_ID');

    if (!stripeSecret || !webhookSecret) {
      console.error('Missing Stripe configuration');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!airtableApiKey || !airtableBaseId) {
      console.error('Missing Airtable configuration');
      return new Response(JSON.stringify({ error: 'Airtable configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('No stripe-signature header');
      return new Response(JSON.stringify({ error: 'No signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Webhook signature verification failed:', errorMessage);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing Stripe event: ${event.type}`);

    // Handle subscription events
    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      // Get customer email from Stripe
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        console.log('Customer was deleted, skipping');
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const email = customer.email;
      if (!email) {
        console.error('No email found for customer:', customerId);
        return new Response(JSON.stringify({ error: 'No customer email' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Determine tier based on subscription status and plan
      let tier = 'free';
      if (event.type === 'customer.subscription.deleted' || subscription.status === 'canceled') {
        tier = 'free';
      } else if (subscription.status === 'active' || subscription.status === 'trialing') {
        tier = await getTierFromSubscription(stripe, subscription);
      }

      console.log(`Updating Airtable for ${email} to tier: ${tier}`);

      // Find the record in Airtable by email
      const searchUrl = `https://api.airtable.com/v0/${airtableBaseId}/Members?filterByFormula={Email}="${email}"`;
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error('Airtable search failed:', errorText);
        return new Response(JSON.stringify({ error: 'Airtable search failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const searchData = await searchResponse.json();
      const records = searchData.records;

      if (!records || records.length === 0) {
        console.log(`No Airtable record found for email: ${email}`);
        // Optionally create a new record here
        return new Response(JSON.stringify({ received: true, message: 'No matching record' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const recordId = records[0].id;
      
      // Map tier to Airtable format (adjust based on your Airtable field values)
      const airtableTier = tier === 'executive' ? 'Circles Executive' : 
                          tier === 'pro' ? 'Circles Pro' : 
                          tier === 'verified_vendor' ? 'Verified Vendor' :
                          tier === 'viewer' ? 'Vendor Viewer' : 'Circles Free';

      // Update the Airtable record
      const updateUrl = `https://api.airtable.com/v0/${airtableBaseId}/Members/${recordId}`;
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            'Tier': airtableTier,
          },
        }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('Airtable update failed:', errorText);
        // Continue to Supabase sync even if Airtable fails
      } else {
        console.log(`Successfully updated Airtable record ${recordId} to tier: ${airtableTier}`);
      }

      // Also update Supabase profiles table directly for instant access
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // Check if profile exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single();
        
        if (existingProfile?.id) {
          // Update existing profile
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ tier: tier })
            .eq('email', email);
          
          if (profileError) {
            console.error('Supabase profile update failed:', profileError.message);
          } else {
            console.log(`Successfully updated Supabase profile for ${email} to tier: ${tier}`);
          }
          
          // Update user_roles table
          await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', existingProfile.id);
          
          await supabase
            .from('user_roles')
            .insert({ user_id: existingProfile.id, role: tier as 'free' | 'pro' | 'executive' | 'viewer' });
          
          console.log(`Successfully updated user_roles for ${email} to role: ${tier}`);
        } else {
          // Create new profile for this email (user hasn't signed up yet)
          // Generate a temporary UUID - will be replaced when user signs up
          const tempId = crypto.randomUUID();
          
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({ 
              id: tempId,
              email: email, 
              tier: tier 
            });
          
          if (insertError) {
            console.error('Supabase profile creation failed:', insertError.message);
          } else {
            console.log(`Successfully created Supabase profile for ${email} with tier: ${tier}`);
          }
          
          // Note: user_roles will be created when user actually signs up via handle_new_user trigger
        }
      } else {
        console.warn('Supabase configuration missing, skipping direct sync');
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
