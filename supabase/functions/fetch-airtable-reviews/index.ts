import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AirtableRecord {
  id: string;
  fields: {
    Title?: string;
    Quote?: string;
    Explanation?: string;
    Member?: string;
    Type?: string;
    Category?: string;
    VendorName?: string;
    [key: string]: string | undefined;
  };
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('AIRTABLE_API_KEY');
    const baseId = Deno.env.get('AIRTABLE_BASE_ID');
    const tableId = 'tblQ9nzGzgc8iOHbc'; // Table ID from Airtable URL

    if (!apiKey || !baseId) {
      console.error('Missing Airtable configuration');
      return new Response(
        JSON.stringify({ error: 'Airtable configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching from Airtable base: ${baseId}, table: ${tableId}`);

    // Fetch all records from Airtable (handles pagination)
    const allRecords: AirtableRecord[] = [];
    let offset: string | undefined;

    do {
      const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}`);
      if (offset) {
        url.searchParams.set('offset', offset);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Airtable API error: ${response.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ error: `Airtable API error: ${response.status}`, details: errorText }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data: AirtableResponse = await response.json();
      allRecords.push(...data.records);
      offset = data.offset;
      console.log(`Fetched ${data.records.length} records, total: ${allRecords.length}`);
    } while (offset);

    // Transform records to match expected format
    const reviews = allRecords.map((record, index) => ({
      id: index + 1,
      airtableId: record.id,
      title: record.fields.Title || record.fields.title || '',
      quote: record.fields.Quote || record.fields.quote || '',
      explanation: record.fields.Explanation || record.fields.explanation || '',
      member: record.fields.Member || record.fields.member || '',
      type: (record.fields.Type || record.fields.type || 'positive').toLowerCase() as 'positive' | 'warning',
      category: record.fields.Category || record.fields.category || 'dms-crm',
      vendorName: record.fields.VendorName || record.fields['Vendor Name'] || record.fields.vendorName || '',
    }));

    console.log(`Successfully processed ${reviews.length} reviews`);

    return new Response(
      JSON.stringify({ reviews, count: reviews.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching from Airtable:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch reviews', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
