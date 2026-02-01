import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AirtableRecord {
  id: string;
  fields: {
    email?: string;
    tier?: string;
    'First Name'?: string;
    'Last Name'?: string;
  };
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

// Normalize tier values from Airtable to match Supabase
function normalizeTier(tier: string | undefined): string {
  if (!tier) return 'free';
  
  const tierLower = tier.toLowerCase().trim();
  
  if (tierLower.includes('executive')) {
    return 'executive';
  }
  
  if (tierLower.includes('pro')) {
    return 'pro';
  }
  
  return 'free';
}

async function fetchAllAirtableRecords(apiKey: string, baseId: string): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;
  
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/Members`);
    if (offset) {
      url.searchParams.set('offset', offset);
    }
    
    console.log(`Fetching Airtable records${offset ? ` (offset: ${offset})` : ''}...`);
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
    }
    
    const data: AirtableResponse = await response.json();
    allRecords.push(...data.records);
    offset = data.offset;
    
    console.log(`Fetched ${data.records.length} records (total: ${allRecords.length})`);
    
  } while (offset);
  
  return allRecords;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting bulk import from Airtable...');

    // Get secrets
    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');
    const airtableBaseId = Deno.env.get('AIRTABLE_BASE_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!airtableApiKey || !airtableBaseId) {
      console.error('Missing Airtable credentials');
      return new Response(
        JSON.stringify({ error: 'Missing Airtable credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all records from Airtable
    const records = await fetchAllAirtableRecords(airtableApiKey, airtableBaseId);
    console.log(`Total records fetched from Airtable: ${records.length}`);

    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process each record
    const results = {
      total: records.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const record of records) {
      const email = record.fields.email?.toLowerCase().trim();
      
      if (!email) {
        results.skipped++;
        console.log(`Skipping record ${record.id}: no email`);
        continue;
      }

      const tier = normalizeTier(record.fields.tier);
      const firstName = record.fields['First Name']?.trim() || null;
      const lastName = record.fields['Last Name']?.trim() || null;

      try {
        // Check if profile already exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('email', email)
          .maybeSingle();

        if (existingProfile) {
          // Update existing profile
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
              tier,
              first_name: firstName,
              last_name: lastName,
            })
            .eq('email', email);

          if (updateError) {
            console.error(`Error updating ${email}:`, updateError);
            results.errors.push(`Update failed for ${email}: ${updateError.message}`);
          } else {
            results.updated++;
            console.log(`Updated profile for ${email} (tier: ${tier})`);
          }
        } else {
          // Create new profile with a placeholder UUID
          // When they sign up, handle_new_user will update this
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: crypto.randomUUID(),
              email,
              tier,
              first_name: firstName,
              last_name: lastName,
            });

          if (insertError) {
            // If duplicate email, try update instead
            if (insertError.code === '23505') {
              const { error: retryUpdateError } = await supabase
                .from('profiles')
                .update({ tier, first_name: firstName, last_name: lastName })
                .eq('email', email);
              
              if (!retryUpdateError) {
                results.updated++;
                console.log(`Updated profile for ${email} (retry, tier: ${tier})`);
              } else {
                results.errors.push(`Failed for ${email}: ${retryUpdateError.message}`);
              }
            } else {
              console.error(`Error inserting ${email}:`, insertError);
              results.errors.push(`Insert failed for ${email}: ${insertError.message}`);
            }
          } else {
            results.created++;
            console.log(`Created profile for ${email} (tier: ${tier})`);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Error processing ${email}:`, err);
        results.errors.push(`${email}: ${errorMsg}`);
      }
    }

    console.log('Bulk import complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Bulk import complete',
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Bulk import failed:', err);
    return new Response(
      JSON.stringify({ error: 'Bulk import failed', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
