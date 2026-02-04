import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface VendorData {
  name: string;
  category: string;
  positiveCount: number;
  warningCount: number;
  mentions: {
    title: string;
    type: "positive" | "warning";
    quote: string;
  }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, vendorData } = await req.json() as { 
      messages: Message[]; 
      vendorData: VendorData[];
    };
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build a comprehensive system prompt with vendor data context
    const vendorSummary = vendorData.map(v => 
      `- ${v.name} (${v.category}): ${v.positiveCount} positive, ${v.warningCount} warnings`
    ).join("\n");

    const detailedMentions = vendorData.flatMap(v => 
      v.mentions.slice(0, 3).map(m => 
        `[${v.name}] ${m.type.toUpperCase()}: "${m.title}" - ${m.quote.slice(0, 200)}...`
      )
    ).slice(0, 50).join("\n");

    const systemPrompt = `You are CDG Pulse AI, an expert automotive dealership vendor advisor. You help dealers make informed decisions about which vendors to use based on real dealer feedback data.

You have access to the following vendor data from real dealer reviews:

VENDOR SUMMARY (${vendorData.length} vendors):
${vendorSummary}

SAMPLE REVIEWS:
${detailedMentions}

Your capabilities:
1. **Recommend vendors** for specific needs (DMS, CRM, F&I, marketing, etc.)
2. **Compare vendors** side-by-side based on dealer feedback
3. **Identify problems** a vendor can solve based on their positive reviews
4. **Warn about issues** based on warning reviews
5. **Category expertise** - explain which vendors excel in each category

Guidelines:
- Be concise and actionable
- Always cite specific dealer feedback when making recommendations
- Be balanced - mention both pros and cons when comparing
- If asked about a vendor you don't have data on, say so
- Focus on helping dealers make better purchasing decisions
- Use specific numbers (positive/warning counts) to support recommendations`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Vendor AI chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
