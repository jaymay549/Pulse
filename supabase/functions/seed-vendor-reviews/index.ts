import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if data already exists
    const { count } = await supabase
      .from("vendor_reviews")
      .select("*", { count: "exact", head: true });
    
    if (count && count > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Database already has ${count} reviews. Clear first or use update endpoint.`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the request body to get vendor data
    const { vendorData } = await req.json();
    
    if (!vendorData || !Array.isArray(vendorData)) {
      return new Response(
        JSON.stringify({ error: "vendorData array is required in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform data for insertion (map vendorName to vendor_name)
    const reviewsToInsert = vendorData.map(({ id: _id, vendorName, airtableId: _airtableId, ...rest }: {
      id?: number;
      vendorName: string;
      airtableId?: string;
      title: string;
      quote: string;
      explanation?: string;
      member?: string;
      type: string;
      category: string;
    }) => ({
      vendor_name: vendorName,
      ...rest,
    }));

    // Insert in batches of 100
    const batchSize = 100;
    let insertedCount = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < reviewsToInsert.length; i += batchSize) {
      const batch = reviewsToInsert.slice(i, i + batchSize);
      const { error } = await supabase
        .from("vendor_reviews")
        .insert(batch);
      
      if (error) {
        console.error(`Batch ${Math.floor(i / batchSize) + 1} error:`, error);
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      } else {
        insertedCount += batch.length;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: errors.length === 0, 
        message: `Inserted ${insertedCount} of ${vendorData.length} reviews`,
        errors: errors.length > 0 ? errors : undefined,
        total: vendorData.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error seeding vendor reviews:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});