import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a vendor review parser for automotive dealerships. Extract vendor reviews from the provided content into structured JSON.

For each review, output this exact structure:
{
  "vendorName": "[exact vendor name being reviewed - the PRIMARY vendor]",
  "title": "[5-8 word summary, action-oriented]",
  "quote": "[exact dealer quote, 1-3 sentences, preserve authenticity]",
  "explanation": "[1 sentence takeaway for other dealers]",
  "type": "[positive OR warning]",
  "category": "[category ID from list]"
}

CATEGORIES (use exact ID):
- "dms-crm" - DMS & CRM systems (Tekion, CDK, DriveCentric, VinSolutions, etc.)
- "digital-retailing" - Online buying tools, chat (Gubagoo, Podium, CarNow, etc.)
- "marketing" - Ads, mailers, SEO, attribution (PureCars, Force Marketing, etc.)
- "fixed-ops" - Service, parts, warranty (Dynatron, Xtime, DealerFX, etc.)
- "equity-mining" - Customer mining, conquest (AutoAlert, Mastermind, etc.)
- "recon" - Reconditioning, detailing (Rapid Recon, iRecon, etc.)
- "ai-automation" - AI tools, chatbots, automation (Numa, Impel, Matador, etc.)
- "inventory" - Appraisals, listings, acquisition (vAuto, Carfax, etc.)
- "training" - Sales training, consultants
- "accounting" - Accounting software
- "hr-payroll" - HR, payroll systems
- "service-products" - Chemicals, accessories, F&I products
- "diagnostics" - Diagnostic tools
- "security" - GPS, theft prevention
- "lead-providers" - Third-party leads
- "call-management" - Phone systems
- "it-support" - IT vendors

RULES:
1. vendorName = the SPECIFIC vendor being reviewed (not just mentioned in passing)
2. type = "positive" if recommending/praising, "warning" if cautioning/negative/mixed
3. title = action-oriented, starts with verb or adjective, captures the key insight
4. quote = actual dealer words, keep authentic voice
5. explanation = what OTHER dealers can learn from this review
6. If multiple vendors are discussed, create separate entries for each
7. Skip content that isn't a vendor review

Return a JSON array of review objects. If no valid reviews found, return empty array [].`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, startingId = 1 } = await req.json();

    if (!content || typeof content !== 'string') {
      console.error('Invalid content provided');
      return new Response(
        JSON.stringify({ error: 'Content is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Parsing vendor reviews, content length: ${content.length} chars, starting ID: ${startingId}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Parse the following content and extract vendor reviews:\n\n${content}` }
        ],
        temperature: 0.3, // Lower temperature for more consistent parsing
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to parse reviews' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content;

    if (!aiContent) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ error: 'No response from AI', reviews: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI response received, parsing JSON...');

    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = aiContent;
    const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let reviews;
    try {
      reviews = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Raw content:', jsonStr.substring(0, 500));
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse AI response as JSON',
          rawResponse: aiContent.substring(0, 1000),
          reviews: [] 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure it's an array
    if (!Array.isArray(reviews)) {
      reviews = [reviews];
    }

    // Add IDs and validate structure
    const formattedReviews = reviews.map((review: any, index: number) => ({
      id: startingId + index,
      vendorName: review.vendorName || 'Unknown',
      title: review.title || 'Untitled Review',
      quote: review.quote || '',
      explanation: review.explanation || '',
      type: review.type === 'warning' ? 'warning' : 'positive',
      category: review.category || 'dms-crm',
    }));

    console.log(`Successfully parsed ${formattedReviews.length} reviews`);

    // Generate TypeScript code for easy copy-paste
    const tsCode = formattedReviews.map((r: any) => 
      `  { id: ${r.id}, vendorName: "${r.vendorName}", title: "${r.title.replace(/"/g, '\\"')}", quote: "${r.quote.replace(/"/g, '\\"')}", explanation: "${r.explanation.replace(/"/g, '\\"')}", type: "${r.type}", category: "${r.category}" },`
    ).join('\n');

    return new Response(
      JSON.stringify({
        success: true,
        count: formattedReviews.length,
        reviews: formattedReviews,
        typescript: tsCode,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
